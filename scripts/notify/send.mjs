// Sends the reminders the lead servant scheduled (settings/notify), in Cairo time.
// Runs hourly from .github/workflows/notify.yml; each reminder goes out once on its day, at or after its hour.
// The Web Push key pair is made on the first run and kept at /private/vapid, which no app user can read.
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import webpush from 'web-push';

// Keep in sync with src/data/notify.ts.
const HYMNS_TAG = '{الألحان}';
const DEFAULTS = {
  hymn: { on: true, days: [0, 2], hour: 19, title: 'وقت المراجعة 🎶', body: `خد ١٠ دقايق النهاردة وراجع ${HYMNS_TAG}` },
  session: { on: true, days: [4], hour: 21, title: 'بكرة حصة الألحان', body: `متنساش حصة بكرة، وراجع ${HYMNS_TAG} قبلها 🙏` },
};
/** A reminder that missed its hour (the job was delayed or down) still goes out within this many hours. */
const LATE = 3;

// Tests point FIRESTORE_EMULATOR_HOST at the local emulator, which needs no credentials.
initializeApp(process.env.FIRESTORE_EMULATOR_HOST ? { projectId: process.env.GCLOUD_PROJECT } : { credential: applicationDefault() });
const db = getFirestore();

function cairoNow() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(new Date()).map(p => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: +parts.hour, day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday) };
}

async function vapid() {
  const ref = db.doc('private/vapid');
  let k = (await ref.get()).data();
  if (!k) { k = webpush.generateVAPIDKeys(); await ref.set(k); console.log('Made a new Web Push key pair.'); }
  webpush.setVapidDetails('https://khedma-app-190d3.web.app', k.publicKey, k.privateKey);
  return k.publicKey;
}

const hymnList = view => {
  const names = (view?.hymns ?? []).filter(h => h.status < 3).map(h => h.nameAr).slice(0, 3);
  return names.length ? names.join('، ') : 'ألحان الترم';
};

async function runChurch(church, publicKey, now) {
  if (church.get('pushKey') !== publicKey) await church.ref.update({ pushKey: publicKey });
  const c = church.ref;
  const settings = (await c.collection('settings').doc('notify').get()).data() ?? {};
  const s = { ...settings, hymn: { ...DEFAULTS.hymn, ...settings.hymn }, session: { ...DEFAULTS.session, ...settings.session } };
  const logRef = c.collection('settings').doc('notifyLog');
  const log = (await logRef.get()).data() ?? {};

  const due = ['hymn', 'session'].filter(k => {
    const r = s[k];
    return r.on && r.days.includes(now.day) && now.hour >= r.hour && now.hour < r.hour + LATE && log[k] !== now.date;
  });
  const test = s.testAt && s.testAt > (log.testAt ?? 0) && s.testUid;
  if (!due.length && !test) { console.log(`${c.id}: nothing due at ${now.date} ${now.hour}:00 (day ${now.day}).`); return; }

  const subs = (await c.collection('pushSubs').get()).docs;
  const who = new Map();
  const whoIs = async uid => {
    if (!who.has(uid)) who.set(uid, (async () => {
      if ((await c.collection('servants').doc(uid).get()).exists) return { kind: 'servant' };
      const memberId = (await c.collection('accounts').doc(uid).get()).get('memberId');
      if (!memberId) return null;
      return { kind: 'member', view: (await c.collection('memberViews').doc(memberId).get()).data() };
    })());
    return who.get(uid);
  };

  const sent = { hymn: 0, session: 0, test: 0 };
  for (const sub of subs) {
    const d = sub.data();
    const p = await whoIs(d.uid);
    if (!p) { await sub.ref.delete(); continue; }
    const msgs = [];
    for (const k of due) {
      if (k === 'hymn' && p.kind !== 'member') continue;
      const r = s[k];
      msgs.push([k, { title: r.title, body: r.body.replaceAll(HYMNS_TAG, p.kind === 'member' ? hymnList(p.view) : 'ألحان الترم'), tag: k, url: p.kind === 'member' ? './#/me/home' : './#/' }]);
    }
    if (test && d.uid === s.testUid) msgs.push(['test', { title: 'تنبيه تجربة', body: 'التنبيهات شغالة على الموبايل ده ✓', tag: 'test', url: './#/notify' }]);
    for (const [k, payload] of msgs) {
      try {
        await webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, JSON.stringify(payload), { TTL: 6 * 3600 });
        sent[k]++;
      } catch (e) {
        // The phone unsubscribed or the app was removed: forget it.
        if (e.statusCode === 404 || e.statusCode === 410) { await sub.ref.delete(); break; }
        console.warn(`${c.id}: push failed (${e.statusCode ?? e.message})`);
      }
    }
  }
  const next = { ...log };
  for (const k of due) next[k] = now.date;
  if (test) next.testAt = s.testAt;
  await logRef.set(next);
  console.log(`${c.id}: sent`, sent, `to ${subs.length} phones.`);
}

const now = cairoNow();
const publicKey = await vapid();
for (const church of (await db.collection('churches').get()).docs) await runChurch(church, publicKey, now);
