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
  // On the 1st (from 10am), servants hear the past month's report is ready.
  const pastMonth = (() => { const [y, m] = now.date.split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`; })();
  const monthly = now.date.endsWith('-01') && now.hour >= 10 && log.month !== pastMonth;
  const test = s.testAt && s.testAt > (log.testAt ?? 0) && s.testUid;
  // Session summaries saved since the last run go to that level's members. The first run only marks the time.
  const since = log.summaryAt ?? Date.now();
  const summaries = log.summaryAt === undefined ? [] : (await c.collection('sessions').where('summaryAt', '>', since).get()).docs.map(d => d.data());
  const summaryAt = Math.max(since, ...summaries.map(x => x.summaryAt));
  if (log.summaryAt === undefined) await logRef.set({ ...log, summaryAt }, { merge: true });
  // Home recordings sent by members (to servants of that level) and servants' replies (to that member).
  const subAt0 = log.subAt ?? Date.now(), revAt0 = log.revAt ?? Date.now();
  const sent0 = log.subAt === undefined ? [] : (await c.collection('submissions').where('at', '>', subAt0).get()).docs.map(d => d.data());
  const reviews = log.revAt === undefined ? [] : (await c.collection('submissions').where('reviewAt', '>', revAt0).get()).docs.map(d => d.data());
  const subAt = Math.max(subAt0, ...sent0.map(x => x.at)), revAt = Math.max(revAt0, ...reviews.map(x => x.reviewAt));
  if (log.subAt === undefined || log.revAt === undefined) await logRef.set({ ...log, summaryAt, subAt, revAt }, { merge: true });
  await cleanSubmissions(c);
  if (!due.length && !monthly && !test && !summaries.length && !sent0.length && !reviews.length) { console.log(`${c.id}: nothing due at ${now.date} ${now.hour}:00 (day ${now.day}).`); return; }

  const subs = (await c.collection('pushSubs').get()).docs;
  const who = new Map();
  const whoIs = async uid => {
    if (!who.has(uid)) who.set(uid, (async () => {
      const sv = await c.collection('servants').doc(uid).get();
      if (sv.exists) return { kind: 'servant', ...sv.data() };
      const memberId = (await c.collection('accounts').doc(uid).get()).get('memberId');
      if (!memberId) return null;
      const levelId = (await c.collection('members').doc(memberId).get()).get('levelId');
      return { kind: 'member', memberId, levelId, view: (await c.collection('memberViews').doc(memberId).get()).data() };
    })());
    return who.get(uid);
  };

  const sent = { month: 0, hymn: 0, session: 0, test: 0, summary: 0, submission: 0, review: 0 };
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
    if (p.kind === 'member') for (const x of summaries.filter(x => x.levelId === p.levelId)) {
      const what = x.summary ? x.summary.split('\n')[0].slice(0, 90) : 'تسجيلات الحصة نزلت، اسمعها وراجع عليها';
      msgs.push(['summary', { title: 'ملخص الحصة نزل 🎧', body: what, tag: `summary-${x.id}`, url: './#/me/sessions' }]);
    }
    if (p.kind === 'member') for (const x of reviews.filter(x => x.memberId === p.memberId)) {
      msgs.push(['review', { title: `${x.review?.byName ?? 'الخادم'} سمع تسميعك ✓`, body: `${x.hymnName}${x.review?.note ? `: ${x.review.note.slice(0, 80)}` : ''}`, tag: `review-${x.id}`, url: `./#/me/hymn/${x.hymnId}` }]);
    }
    const listens = p.kind === 'servant' && (['admin', 'lead'].includes(p.role) || !p.perms || p.perms.includes('sessions'));
    const mine = listens ? sent0.filter(x => (p.levelIds ?? []).some(l => l === '*' || l === x.levelId)) : [];
    if (mine.length) msgs.push(['submission', { title: mine.length === 1 ? `${mine[0].memberName} سمّع ${mine[0].hymnName}` : `${mine.length} تسميعات جديدة`, body: 'اسمعه وابعتله رأيك', tag: 'submissions', url: './#/reviews' }]);
    if (monthly && p.kind === 'servant') msgs.push(['month', { title: 'تقرير الشهر اللي فات جاهز 📊', body: 'الحضور والأوائل ومين مستواه نزل، قبل ما تبدأ الشهر الجديد', tag: `month-${pastMonth}`, url: `./#/month/${pastMonth}` }]);
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
  if (monthly) next.month = pastMonth;
  next.summaryAt = summaryAt;
  next.subAt = subAt;
  next.revAt = revAt;
  await logRef.set(next);
  console.log(`${c.id}: sent`, sent, `to ${subs.length} phones.`);
}

// Home recordings are big; a month after the servant replied, the audio goes and the reply stays.
async function cleanSubmissions(c) {
  const old = await c.collection('submissions').where('reviewAt', '<', Date.now() - 30 * 86400_000).get();
  for (const d of old.docs) {
    const x = d.data();
    if (x.audioGone || x.pending) continue;
    for (let i = 0; i < (x.recording?.parts ?? 0); i++) await c.collection('recordings').doc(`${x.recording.id}-${i}`).delete();
    await d.ref.update({ audioGone: true });
  }
}

const now = cairoNow();
const publicKey = await vapid();
for (const church of (await db.collection('churches').get()).docs) await runChurch(church, publicKey, now);
