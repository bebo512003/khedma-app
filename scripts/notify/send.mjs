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
/** The default reminder texts said to a girl. */
const femBody = t => t.replace('خد ', 'خدي ').replaceAll('وراجع ', 'وراجعي ').replace('متنساش', 'متنسيش');
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

// Keep in sync with monthDue / daysLeftInMonth in src/data/logic.ts.
const monthDue = (hymns, month) => (hymns ?? []).flatMap(h => {
  const parts = (h.parts ?? []).filter(p => p.month === month && (h.partStatus?.[p.id] ?? 0) < 2).map(p => ({ hymnId: h.id, name: `${h.nameAr} (${p.name})`, partId: p.id }));
  if (parts.length) return parts;
  return !(h.parts ?? []).some(p => p.month) && h.month === month && h.status < 2 ? [{ hymnId: h.id, name: h.nameAr }] : [];
});
const daysLeft = date => { const [y, m, d] = date.split('-').map(Number); return new Date(y, m, 0).getDate() - d + 1; };
/** This month's parts not memorized yet: a reminder 7 days before the month ends, and again 2 days before, from 6pm. */
const DUE_STAGES = [[7, 1], [2, 2]];

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
  // The lead's own reminders: weekly on their days, or once on their date; to members, servants or both, in some levels.
  const custom = (Array.isArray(s.custom) ? s.custom : []).filter(r => r && r.on && r.id && r.title && r.body
    && (r.date ? r.date === now.date : (r.days ?? []).includes(now.day))
    && now.hour >= r.hour && now.hour < r.hour + LATE && log[`c:${r.id}`] !== now.date);
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
  // A time from the future (a wrong clock or a forged recording) would stop all later pushes, so it doesn't count.
  const sent0 = log.subAt === undefined ? [] : (await c.collection('submissions').where('at', '>', subAt0).get()).docs.map(d => d.data())
    .filter(x => typeof x.at === 'number' && x.at <= Date.now());
  // The member's name from their record, not the one the phone sent.
  for (const x of sent0) { const m = await c.collection('members').doc(String(x.memberId)).get(); x.memberName = m.get('name') ?? x.memberName; x.gender = m.get('gender'); }
  const reviews = log.revAt === undefined ? [] : (await c.collection('submissions').where('reviewAt', '>', revAt0).get()).docs.map(d => d.data())
    .filter(x => typeof x.reviewAt === 'number' && x.reviewAt <= Date.now());
  const subAt = Math.max(subAt0, ...sent0.map(x => x.at)), revAt = Math.max(revAt0, ...reviews.map(x => x.reviewAt));
  if (log.subAt === undefined || log.revAt === undefined) await logRef.set({ ...log, summaryAt, subAt, revAt }, { merge: true });
  const month = now.date.slice(0, 7), left = daysLeft(now.date);
  await cleanSubmissions(c, month);
  const dueStage = now.hour >= 18 ? (DUE_STAGES.find(([d]) => left <= d) ? Math.max(...DUE_STAGES.filter(([d]) => left <= d).map(([, k]) => k)) : 0) : 0;
  // Recitations waiting for a reply this month already count as an answer to the reminder.
  const waiting = dueStage ? (await c.collection('submissions').where('at', '>=', new Date(`${month}-01T00:00:00+02:00`).getTime()).get()).docs.map(d => d.data()).filter(x => x.pending) : [];
  const dueSent = [];
  if (!dueStage && !due.length && !custom.length && !monthly && !test && !summaries.length && !sent0.length && !reviews.length) { console.log(`${c.id}: nothing due at ${now.date} ${now.hour}:00 (day ${now.day}).`); return; }

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

  const sent = { custom: 0, month: 0, hymn: 0, session: 0, test: 0, summary: 0, submission: 0, review: 0, peers: 0, due: 0 };
  const peered = [];
  for (const sub of subs) {
    // One bad phone record never stops the rest.
    try {
      const d = sub.data();
      const p = await whoIs(d.uid);
      if (!p) { await sub.ref.delete(); continue; }
      const msgs = [];
      for (const k of due) {
        if (k === 'hymn' && p.kind !== 'member') continue;
        const r = s[k];
        const fem = p.kind === 'member' && p.view?.gender === 'f' && r.body === DEFAULTS[k]?.body;
        msgs.push([k, { title: r.title, body: (fem ? femBody(r.body) : r.body).replaceAll(HYMNS_TAG, p.kind === 'member' ? hymnList(p.view) : 'ألحان الترم'), tag: k, url: p.kind === 'member' ? './#/me/home' : './#/' }]);
      }
      for (const r of custom) {
        const levels = r.levelIds ?? [];
        const to = r.to ?? 'members';
        if (p.kind === 'member' ? to === 'servants' || (levels.length && !levels.includes(p.levelId))
          : to === 'members' || (levels.length && !(p.levelIds ?? []).some(l => l === '*' || levels.includes(l)))) continue;
        msgs.push(['custom', { title: r.title, body: r.body.replaceAll(HYMNS_TAG, p.kind === 'member' ? hymnList(p.view) : 'ألحان الترم'), tag: `c-${r.id}`, url: p.kind === 'member' ? './#/me/home' : './#/' }]);
      }
      if (p.kind === 'member') for (const x of summaries.filter(x => x.levelId === p.levelId)) {
        const what = x.summary ? x.summary.split('\n')[0].slice(0, 90) : 'تسجيلات الحصة نزلت، اسمعها وراجع عليها';
        msgs.push(['summary', { title: 'ملخص الحصة نزل 🎧', body: what, tag: `summary-${x.id}`, url: './#/me/sessions' }]);
      }
      if (p.kind === 'member') for (const x of reviews.filter(x => x.memberId === p.memberId)) {
        msgs.push(['review', { title: `${x.review?.byName ?? 'الخادم'} سمع تسميعك ✓`, body: `${x.hymnName}${x.review?.note ? `: ${x.review.note.slice(0, 80)}` : ''}`, tag: `review-${x.id}`, url: `./#/me/hymn/${encodeURIComponent(x.hymnId ?? '')}` }]);
      }
      // Others in the same level sent a recitation: a nudge to send theirs too, at most once a day.
      if (p.kind === 'member' && log[`peer:${p.memberId}`] !== now.date && !sent0.some(x => x.memberId === p.memberId)) {
        const peers = sent0.filter(x => x.levelId === p.levelId && x.memberId !== p.memberId);
        const names = [...new Map(peers.map(x => [x.memberId, x])).values()];
        if (names.length) {
          const f = p.view?.gender === 'f', one = names[0];
          msgs.push(['peers', {
            title: names.length === 1 ? `${one.memberName} ${one.gender === 'f' ? 'بعتت' : 'بعت'} تسميع «${one.hymnName}» 🎙️` : `${names.length} من زمايلك بعتوا تسميع 🎙️`,
            body: f ? 'يلا سمّعي انتي كمان وابعتي تسميعك 💪' : 'يلا سمّع انت كمان وابعت تسميعك 💪', tag: 'peers', url: './#/me/recite',
          }]);
          peered.push(p.memberId);
        }
      }
      if (dueStage && p.kind === 'member' && log[`due:${p.memberId}`] !== `${month}:${dueStage}`) {
        const items = monthDue(p.view?.hymns, month).filter(i => !waiting.some(w => w.memberId === p.memberId && w.hymnId === i.hymnId && (w.partId ?? '') === (i.partId ?? '')));
        if (items.length) {
          const f = p.view?.gender === 'f';
          msgs.push(['due', {
            title: left === 1 ? '⏳ النهاردة آخر يوم في الشهر' : `⏳ فاضل ${left} أيام على آخر الشهر`,
            body: `لسه ${items.slice(0, 3).map(i => `«${i.name}»`).join('، ')}. ${f ? 'احفظيه وسمّعيه' : 'احفظه وسمّعه'} قبل آخر الشهر عشان ${items.length > 1 ? 'نقطهم ما تروحش' : 'نقطه ما تروحش'}`,
            tag: 'due', url: './#/me/recite',
          }]);
        }
        dueSent.push(p.memberId);
      }
      const listens = p.kind === 'servant' && (['admin', 'lead'].includes(p.role) || !p.perms || p.perms.includes('sessions'));
      const mine = listens ? sent0.filter(x => (p.levelIds ?? []).some(l => l === '*' || l === x.levelId)) : [];
      if (mine.length) msgs.push(['submission', { title: mine.length === 1 ? `${mine[0].memberName} ${mine[0].gender === 'f' ? 'سمّعت' : 'سمّع'} ${mine[0].hymnName}` : `${mine.length} تسميعات جديدة`, body: mine.length > 1 ? 'اسمعهم وابعتلهم رأيك' : mine[0].gender === 'f' ? 'اسمعها وابعتلها رأيك' : 'اسمعه وابعتله رأيك', tag: 'submissions', url: './#/reviews' }]);
      if (monthly && p.kind === 'servant') msgs.push(['month', { title: 'تقرير الشهر اللي فات جاهز 📊', body: 'الحضور والأوائل ومين مستواه نزل، ورسايل أولياء الأمور جاهزة تتبعت', tag: `month-${pastMonth}`, url: `./#/month/${pastMonth}` }]);
      if (test && d.uid === s.testUid) msgs.push(['test', { title: 'تنبيه تجربة', body: 'التنبيهات شغالة على الموبايل ده ✓', tag: 'test', url: './#/notify' }]);
      for (const [k, payload] of msgs) {
        try {
          await webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, JSON.stringify(payload), { TTL: 6 * 3600, timeout: 10_000 });
          sent[k]++;
        } catch (e) {
          // The phone unsubscribed or the app was removed: forget it.
          if (e.statusCode === 404 || e.statusCode === 410) { await sub.ref.delete(); break; }
          console.warn(`${c.id}: push failed (${e.statusCode ?? e.message})`);
        }
      }
    } catch (e) { console.warn(`${c.id}: skipped a phone (${e.message})`); }
  }
  const next = { ...log };
  for (const k of due) next[k] = now.date;
  for (const r of custom) next[`c:${r.id}`] = now.date;
  if (test) next.testAt = s.testAt;
  if (monthly) next.month = pastMonth;
  next.summaryAt = summaryAt;
  for (const id of dueSent) next[`due:${id}`] = `${month}:${dueStage}`;
  for (const id of peered) next[`peer:${id}`] = now.date;
  next.subAt = subAt;
  next.revAt = revAt;
  await logRef.set(next);
  console.log(`${c.id}: sent`, sent, `to ${subs.length} phones.`);
}

// Home recordings are big; a month after the servant replied, the audio goes and the reply stays.
async function cleanSubmissions(c, month) {
  const old = await c.collection('submissions').where('reviewAt', '<', Date.now() - 30 * 86400_000).get();
  const hymns = new Map();
  for (const d of old.docs) {
    const x = d.data();
    if (x.audioGone || x.pending) continue;
    // Servants keep listening through the hymn's (or part's) month, so its audio stays until that month ends.
    if (!hymns.has(x.hymnId)) hymns.set(x.hymnId, (await c.collection('hymns').doc(String(x.hymnId)).get()).data());
    const h = hymns.get(x.hymnId);
    const own = (x.partId && h?.parts?.find(p => p.id === x.partId)?.month) || h?.month;
    if (own && own >= month) continue;
    for (let i = 0; i < (x.recording?.parts ?? 0); i++) await c.collection('recordings').doc(`${x.recording.id}-${i}`).delete();
    await d.ref.update({ audioGone: true });
  }
}

/**
 * Today's synaxarium titles from St-Takla.org's Arabic synaxarium: one page read a day (their robots.txt allows it),
 * titles only (the saints and occasions), with a link back to their page for the full text.
 */
const SYNAX_WORDS = /^(استشهاد|نياحة|تذكار|عيد|تكريس|ظهور|اجتماع|نقل|رجوع|دخول|بشارة|ميلاد|صعود|حلول|تجلي|البشارة|تقديم|اعتراف|شهادة|وجود|إصعاد|اصعاد|ختان|معمودية|انعقاد|مجمع|سيامة|تملك)/;
async function synaxarium(now) {
  const ref = db.doc('public/synaxarium');
  if ((await ref.get()).data()?.date === now.date) return;
  const [y, m, d] = now.date.split('-');
  const url = `https://st-takla.org/zJ/index.php/ar-synaxarium?view=synaxarium-arabic&dbl=ar&iday=${d}&imonth=${m}&iyear=${y}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'St-Stephan-SCH/1.0 (church school app; reads the day\'s synaxarium titles once a day)' }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`synaxarium ${res.status}`);
  const html = await res.text();
  const clean = t => t.replace(/<[^>]+>/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  // Each entry is headed by its title in a dark red paragraph: "استشهاد القديس لوقا الانجيلي", "نياحة البابا ...".
  const heads = [
    ...[...html.matchAll(/<p[^>]*color:\s*#8b0000[^>]*>([\s\S]*?)<\/p>/gi)].map(x => clean(x[1])),
    ...[...html.matchAll(/<(h[1-6]|strong|b)[^>]*>([\s\S]*?)<\/\1>/gi)].map(x => clean(x[2])),
  ];
  const titles = [...new Set(heads.filter(t => SYNAX_WORDS.test(t) && t.length < 140))].slice(0, 8);
  if (!titles.length) {
    console.log('Synaxarium: no titles found on', url, html.length, 'bytes');
    return;
  }
  await ref.set({ date: now.date, titles, url, at: Date.now() });
  console.log('Synaxarium', now.date, titles);
}

const now = cairoNow();
await synaxarium(now).catch(e => console.log('Synaxarium skipped:', e.message));
const publicKey = await vapid();
const churches = (await db.collection('churches').get()).docs;
console.log('Churches:', churches.map(c => c.id).join(', ') || 'none');
for (const church of churches) {
  // How much each church holds, so a log shows at a glance that its data is there.
  const n = await Promise.all(['servants', 'members', 'sessions', 'hymns', 'levels'].map(async k => `${k} ${(await church.ref.collection(k).count().get()).data().count}`));
  console.log(church.id, 'holds:', n.join(', '));
  await runChurch(church, publicKey, now);
}
