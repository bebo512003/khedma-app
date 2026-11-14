import type { AppData, Hymn, Member, Session } from './types';

export const POINTS = { attendance: 2, memorized: 5, solo: 12 } as const;
/**
 * From this day (the lead's change, 2026-11-13): no session ratings in points; coming gives 5 points,
 * less one for every full 10 minutes late (by the QR arrival time). Earlier sessions keep the old rule
 * (2 for coming + the rating average), so ended months and their coupons don't change.
 */
export const NEW_POINTS_FROM = '2026-11-01';
export const ATTEND_PTS = 5, LATE_STEP_MIN = 10;
/** Points taken off for arriving late to a session under the new rule. */
export const lateOff = (s: Session, memberId: string) => s.date >= NEW_POINTS_FROM && s.attendance[memberId] === 'p' ? Math.min(ATTEND_PTS, Math.floor((lateBy(s, memberId) ?? 0) / LATE_STEP_MIN)) : 0;
/** What coming to a session gave this member. */
export const attendPts = (s: Session, memberId: string) => s.attendance[memberId] !== 'p' ? 0 : s.date >= NEW_POINTS_FROM ? ATTEND_PTS - lateOff(s, memberId) : POINTS.attendance;
/** A session's rating counts toward points only before the new rule. */
const ratingPts = (s: Session, memberId: string) => s.date >= NEW_POINTS_FROM ? 0 : sessionAverage(s, memberId) ?? 0;

/** A hymn's milestone points: the lead's own for it, else the usual ones. */
export const hymnPoints = (h?: Pick<Hymn, 'points'>) => ({ memorized: h?.points?.memorized ?? POINTS.memorized, solo: h?.points?.solo ?? POINTS.solo });
/** A hymn with a month gives its points only when reached within that month (the lead's choice: months don't mix). */
export const hymnPointsOn = (h: Pick<Hymn, 'points' | 'month'> | undefined, date: string) => h?.month && date.slice(0, 7) !== h.month ? { memorized: 0, solo: 0 } : hymnPoints(h);

/** Consecutive absences counting back from the latest session of the member's level. Excused breaks the streak. */
export function absenceStreak(data: AppData, member: Member, extra?: Session): number {
  const sessions = [...data.sessions, ...(extra ? [extra] : [])]
    .filter(s => s.levelId === member.levelId && s.attendance[member.id] !== undefined)
    .sort((a, b) => b.date.localeCompare(a.date));
  let n = 0;
  for (const s of sessions) {
    if (s.attendance[member.id] === 'a') n++;
    else break;
  }
  return n;
}

export const needsFollowUp = (streak: number) => streak > 2;

/**
 * Members to keep an eye on before they need a visit: missing sessions lately, or stuck on the same hymn.
 * Members already due a visit (needsFollowUp) are left to the follow-up list.
 */
export function watchList(data: AppData, allowed: (levelId: string) => boolean) {
  const out: { member: Member; reasons: string[] }[] = [];
  for (const m of data.members) {
    if (!allowed(m.levelId) || needsFollowUp(absenceStreak(data, m))) continue;
    const mine = data.sessions.filter(s => s.levelId === m.levelId && s.attendance[m.id] !== undefined).sort((a, b) => b.date.localeCompare(a.date));
    const reasons: string[] = [];
    const recent = mine.slice(0, 4);
    const missed = recent.filter(s => s.attendance[m.id] === 'a').length;
    if (recent.length >= 3 && missed >= 2) reasons.push(`${fx(m, 'غاب', 'غابت')} ${missed} من آخر ${recent.length} حصص`);
    // Present for the last three sessions on the same hymn and still hasn't memorized it.
    const present = mine.filter(s => s.attendance[m.id] === 'p').slice(0, 3);
    const h = present[0]?.hymnIds[0];
    if (present.length === 3 && h && present.every(s => s.hymnIds[0] === h) && (data.progress[m.id]?.[h] ?? 0) < 2) {
      reasons.push(`لسه ما حفظش «${data.hymns.find(x => x.id === h)?.nameAr ?? 'لحن الحصة'}» بعد 3 حصص`);
    }
    if (reasons.length) out.push({ member: m, reasons });
  }
  return out;
}

export function sessionAverage(s: Session, memberId: string): number | null {
  const r = s.ratings[memberId];
  return r ? (r[0] + r[1] + r[2]) / 3 : null;
}

/**
 * Where a member's points for a month (YYYY-MM) came from: attendance, each session's average rating,
 * and milestone points recorded on the session when a hymn reached حافظه or بيقوله لوحده.
 */
export function monthBreakdown(data: AppData, memberId: string, month: string) {
  const b = { attended: 0, attendance: 0, lateOff: 0, rating: 0, memorized: 0, solo: 0, memorizedPts: 0, soloPts: 0, partsM: 0, partsS: 0, partsMPts: 0, partsSPts: 0, total: 0 };
  for (const s of data.sessions) {
    if (!s.date.startsWith(month)) continue;
    if (s.attendance[memberId] === 'p') { b.attended++; b.attendance += attendPts(s, memberId); b.lateOff += lateOff(s, memberId); }
    b.rating += ratingPts(s, memberId);
    const ms = s.milestones?.[memberId];
    if (ms) { b.memorized += ms.memorized; b.solo += ms.solo; b.memorizedPts += ms.mPts ?? ms.memorized * POINTS.memorized; b.soloPts += ms.sPts ?? ms.solo * POINTS.solo;
      if (ms.parts) { b.partsM += ms.parts.m; b.partsS += ms.parts.s; b.partsMPts += ms.parts.mPts; b.partsSPts += ms.parts.sPts; } }
  }
  // Milestones reached outside sessions: a live recitation, or a reply to one sent from home.
  for (const a of data.members.find(m => m.id === memberId)?.awards ?? []) {
    if (!a.date.startsWith(month)) continue;
    if (a.partId) { if (a.kind === 'm') { b.partsM++; b.partsMPts += a.pts; } else { b.partsS++; b.partsSPts += a.pts; } }
    else if (a.kind === 'm') { b.memorized++; b.memorizedPts += a.pts; } else { b.solo++; b.soloPts += a.pts; }
  }
  // Points use whole numbers; the ranking breaks ties on the exact ratings (exactRating), so rounding never hides a difference.
  const exactRating = b.rating;
  b.rating = Math.round(b.rating);
  b.total = b.attendance + b.rating + b.memorizedPts + b.soloPts + b.partsMPts + b.partsSPts;
  return { ...b, exactRating };
}

/** One session's points for a member, the same pieces the month adds up (the month rounds the ratings once at the end). */
export function sessionPoints(s: Session, memberId: string) {
  if (s.attendance[memberId] === undefined) return undefined;
  const att = attendPts(s, memberId), late = lateOff(s, memberId);
  const rating = Math.round(ratingPts(s, memberId) * 10) / 10;
  const ms = s.milestones?.[memberId];
  const memorized = (ms?.mPts ?? (ms?.memorized ?? 0) * POINTS.memorized) + (ms?.parts?.mPts ?? 0), solo = (ms?.sPts ?? (ms?.solo ?? 0) * POINTS.solo) + (ms?.parts?.sPts ?? 0);
  return { att, late, rating, memorized, solo, total: Math.round((att + rating + memorized + solo) * 10) / 10 };
}

export const monthPoints = (data: AppData, memberId: string, month: string) => monthBreakdown(data, memberId, month).total;

/** A level's month ranking. Anyone who attended that level's sessions that month counts, so an old month keeps its
 * learners after some move up a level; this month also lists the level's current learners who have no points yet. */
export function ranking(data: AppData, levelId: string, month: string) {
  const took = new Set(data.sessions.filter(s => s.levelId === levelId && s.date.startsWith(month)).flatMap(s => Object.keys(s.attendance)));
  const now = month === todayISO().slice(0, 7);
  // The hymns this level was learning that month, for the third tie-break.
  const term = currentTerm(data, `${month}-15`);
  const hymns = term ? data.curricula[curriculumKey(term.id, levelId)] ?? [] : [];
  const rows = data.members
    .filter(m => took.has(m.id) || (now && m.levelId === levelId))
    .map(m => {
      const b = monthBreakdown(data, m.id, month);
      const hymnLevel = hymns.reduce((n, h) => n + (data.progress[m.id]?.[h] ?? 0), 0);
      // Fewer late arrivals ranks higher, so it counts negatively.
      const late = data.sessions.filter(x => x.levelId === levelId && x.date.startsWith(month) && (lateBy(x, m.id) ?? 0) > LATE_GRACE_MIN).length;
      return { member: m, points: b.total, attended: b.attended, hymnLevel, rating: b.exactRating, onTime: -late, place: 0 };
    });
  // Same points: more sessions attended first, then further along in this term's hymns, then better session ratings, then fewer late arrivals.
  const keys = (r: typeof rows[number]) => [r.points, r.attended, r.hymnLevel, r.rating, r.onTime];
  const cmp = (a: typeof rows[number], b: typeof rows[number]) => { const x = keys(a), y = keys(b); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return y[i] - x[i]; return 0; };
  rows.sort(cmp);
  // Only a tie on every measure shares a place; the next learner takes the next place (1, 1, 1, 2), so silver and bronze stay given.
  rows.forEach((r, i) => { r.place = !i ? 1 : cmp(rows[i - 1], r) === 0 ? rows[i - 1].place : rows[i - 1].place + 1; });
  return rows;
}

/** Where a month's points came from, written out: «حضور 4 حصص (8) + تقييم الحصص (7) + حافظ لحنين (10) = 25». */
export function pointsWhy(b: { attended: number; attendance: number; lateOff?: number; rating: number; memorized: number; solo: number; memorizedPts: number; soloPts: number; partsM?: number; partsS?: number; partsMPts?: number; partsSPts?: number; total: number }, female = false) {
  const hafez = female ? 'حافظة' : 'حافظ', bi = female ? 'بتقول' : 'بيقول', alone = female ? 'لوحدها' : 'لوحده';
  const parts = [`${b.attended ? `حضور ${sessionsCount(b.attended)}` : 'لسه مفيش حضور'} (${b.attendance}${b.lateOff ? `، اتخصم ${pointsCount(b.lateOff)} تأخير` : ''})`];
  if (b.rating) parts.push(`تقييم الحصص (${b.rating})`);
  if (b.memorized) parts.push(`${hafez} ${hymnsCount(b.memorized)} (${b.memorizedPts})`);
  if (b.solo) parts.push(`${bi} ${hymnsCount(b.solo)} ${alone} (${b.soloPts})`);
  if (b.partsM) parts.push(`${hafez} ${partsCount(b.partsM)} (${b.partsMPts})`);
  if (b.partsS) parts.push(`${bi} ${partsCount(b.partsS)} ${alone} (${b.partsSPts})`);
  return `${parts.join(' + ')} = ${b.total}`;
}

/** 🥇🥈🥉 and their names for places 1–3, once a learner has points. */
export const MEDALS = [{ icon: '🥇', name: 'ذهبي', cls: 'gold' }, { icon: '🥈', name: 'فضي', cls: 'silver' }, { icon: '🥉', name: 'برونزي', cls: 'bronze' }] as const;
export const medal = (place: number, points: number) => (points > 0 && place >= 1 && place <= 3 ? MEDALS[place - 1] : null);

/** 01xxxxxxxxx → 201xxxxxxxxx for wa.me links. Returns null when it doesn't look like an Egyptian mobile. */
export function waNumber(phone?: string): string | null {
  if (!phone) return null;
  const d = phone.replace(/\D/g, '');
  if (/^01\d{9}$/.test(d)) return '2' + d;
  if (/^201\d{9}$/.test(d)) return d;
  return null;
}

export function waLink(phone: string | undefined, text: string): string {
  const n = waNumber(phone);
  return `https://wa.me/${n ?? ''}?text=${encodeURIComponent(text)}`;
}

export function fillTemplate(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{([^}]+)\}/g, (all, k) => (k in vars ? String(vars[k]) : all));
}

/** Local calendar date as YYYY-MM-DD (toISOString would give UTC, which is yesterday before 2–3am in Egypt). */
export const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const todayISO = () => isoDate(new Date());
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/** The term whose date range contains `date`; otherwise the most recently started one. */
export function currentTerm(data: AppData, date = todayISO()) {
  const sorted = [...data.terms].sort((a, b) => b.start.localeCompare(a.start));
  return sorted.find(t => t.start <= date && date <= t.end) ?? sorted.find(t => t.start <= date) ?? sorted[sorted.length - 1];
}

export const curriculumKey = (termId: string, levelId: string) => `${termId}:${levelId}`;

/** The coming Friday (today if today is Friday), when classes meet. */
export function nextFriday(from = new Date()) {
  const d = new Date(from); d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7)); return d;
}

const dayFmt = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long' });
/** A session's recordings, including the single one older sessions kept. */
export const sessionRecordings = (s: Session) => s.recordings ?? (s.recording ? [s.recording] : []);

export const formatDay = (iso: string) => dayFmt.format(new Date(`${iso}T12:00:00`));
const timeFmt = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { hour: 'numeric', minute: '2-digit' });
export const formatTime = (ms: number) => timeFmt.format(new Date(ms));

/** Minutes of grace after the session's start before a scanned arrival counts as late: from 10 minutes, the first point off. */
export const LATE_GRACE_MIN = 9;
/** Minutes a member arrived after the session started, or null when their card wasn't scanned. */
export function lateBy(s: Session, memberId: string): number | null {
  const at = s.arrivals?.[memberId];
  if (at === undefined || !s.startedAt) return null;
  return minutesLate(at, s.startedAt);
}
/** Compared by time of day, so a session whose date was corrected afterwards still counts right. */
export function minutesLate(at: number, start: number) {
  const mins = (ms: number) => { const d = new Date(ms); return d.getHours() * 60 + d.getMinutes(); };
  return Math.max(0, mins(at) - mins(start));
}
export const isLate = (s: Session, memberId: string) => (lateBy(s, memberId) ?? 0) > LATE_GRACE_MIN;
/** "HH:MM" on the session's day as epoch ms, for the start-time field. */
export function atTime(dateISO: string, hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(`${dateISO}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`).getTime();
}
export const hhmm = (ms: number) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

/** Member PINs are stored only as a salted SHA-256 hash. Real verification moves server-side with Firebase. */
export async function hashPin(memberId: string, pin: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${memberId}:${pin}`));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
/** Only http(s) links are opened from hymn and book records. */
export const safeUrl = (u?: string) => (u && /^https?:\/\//i.test(u.trim()) ? u.trim() : undefined);

/** Six digits: a million guesses per member instead of ten thousand. Older 4-digit PINs keep working. */
export const newPin = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');

/** Arabic counting: 1 → لحن واحد, 2 → لحنين, 3–10 → 3 ألحان, 11+ → 11 لحن. */
export function count(n: number, one: string, two: string, few: string) {
  if (n === 1) return `${one} واحد`;
  if (n === 2) return two;
  return n >= 3 && n <= 10 ? `${n} ${few}` : `${n} ${one}`;
}
export const hymnsCount = (n: number) => count(n, 'لحن', 'لحنين', 'ألحان');
export const partsCount = (n: number) => count(n, 'جزء', 'جزئين', 'أجزاء');
export const pointsCount = (n: number) => n === 1 ? 'نقطة واحدة' : count(n, 'نقطة', 'نقطتين', 'نقط');
export const pagesCount = (n: number) => n === 1 ? 'صفحة واحدة' : count(n, 'صفحة', 'صفحتين', 'صفحات');
/** Searches match whatever hamza or ta marbuta spelling was typed. */
export const fold = (s: string) => s.trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[ً-ْ]/g, '').replace(/\s+/g, ' ');
export const sessionsCount = (n: number) => n === 1 ? 'حصة واحدة' : count(n, 'حصة', 'حصتين', 'حصص');

/** He or she: fx(m, 'غاب', 'غابت'). */
export const fx = (m: { gender?: string } | undefined, male: string, female: string) => m?.gender === 'f' ? female : male;
/** A message the servant wrote for anyone, turned to a girl: the usual words that change. */
const FEM: [RegExp, string][] = [[/(^|\s)تكون(\s|$)/g, '$1تكوني$2'], [/(^|\s)أنت(\s|$)/g, '$1انتي$2'], [/(^|\s)انت(\s|$)/g, '$1انتي$2'], [/وحشتنا/g, 'وحشتينا'], [/(^|\s)طيب(\s|[!،.]|$)/g, '$1طيبة$2'], [/(^|\s)بتيجي(\s|$)/g, '$1بتيجي$2'], [/(^|\s)خليك(\s|$)/g, '$1خليكي$2'], [/(^|\s)عامل(\s|$)/g, '$1عاملة$2']];
export const toFem = (text: string) => FEM.reduce((t, [re, to]) => t.replace(re, to), text);

export const DEFAULT_BIRTHDAY = 'كل سنة وأنت {طيب} يا {الاسم}! مدرسة الشهيد اسطفانوس للشمامسة بتتمنالك سنة جديدة مليانة فرح وألحان.';

/** Members whose birthday falls within the next `days` days (today included), soonest first. */
export function upcomingBirthdays(members: Member[], days = 7, from = new Date()) {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return members.flatMap(m => {
    if (!m.birthdate) return [];
    const [y, mo, d] = m.birthdate.split('-').map(Number);
    let next = new Date(today.getFullYear(), mo - 1, d);
    if (next < today) next = new Date(today.getFullYear() + 1, mo - 1, d);
    const daysAway = Math.round((next.getTime() - today.getTime()) / 86400000);
    return daysAway < days ? [{ member: m, daysAway, age: next.getFullYear() - y }] : [];
  }).sort((a, b) => a.daysAway - b.daysAway);
}

export const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

/** Members with only a birth month, whose month this is. */
export const monthBirthdays = (members: Member[], from = new Date()) =>
  members.filter(m => !m.birthdate && m.birthMonth === from.getMonth() + 1);

export const birthdayWhen = (daysAway: number) =>
  daysAway === 0 ? 'النهارده' : daysAway === 1 ? 'بكرة' : daysAway === 2 ? 'بعد يومين' : `بعد ${count(daysAway, 'يوم', 'يومين', 'أيام')}`;
export const yearsCount = (n: number) => n === 1 ? 'سنة واحدة' : n === 2 ? 'سنتين' : n >= 3 && n <= 10 ? `${n} سنين` : `${n} سنة`;

/** Who gets WhatsApp messages about a member: their own number if they have one, otherwise the parent's. */
export function contact(m: Member): { phone?: string; who: 'self' | 'parent' | null } {
  if (waNumber(m.phone)) return { phone: m.phone, who: 'self' };
  if (waNumber(m.parentPhone)) return { phone: m.parentPhone, who: 'parent' };
  return { who: null };
}

/** Servants learning in the خدام level are called تاسوني (girls) and باصون (boys) before their name. */
export const isServantsLevel = (name?: string) => !!name && /خدا?م|خادم/.test(name);
export function titled(m: { name: string; gender?: 'm' | 'f' | null; levelId: string }, levels: { id: string; name: string }[] | string) {
  const level = typeof levels === 'string' ? levels : levels.find(l => l.id === m.levelId)?.name;
  if (!isServantsLevel(level) || !m.gender || /^(تاسوني|باصون|أبونا|ابونا)\s/.test(m.name)) return m.name;
  return `${m.gender === 'f' ? 'تاسوني' : 'باصون'} ${m.name}`;
}

export const GRADES = [
  'أولى ابتدائي', 'تانية ابتدائي', 'تالتة ابتدائي', 'رابعة ابتدائي', 'خامسة ابتدائي', 'سادسة ابتدائي',
  'أولى إعدادي', 'تانية إعدادي', 'تالتة إعدادي', 'أولى ثانوي', 'تانية ثانوي', 'تالتة ثانوي', 'جامعة', 'خريج', 'خدام',
];
/** Default level from school grade: grades 1-2 → ابتدائي 1, 3-6 → ابتدائي 2, prep and up → شباب, servants → the level named خدام if there is one. */
export const levelForGrade = (g: string, levels: { id: string; name: string }[] = []) => {
  if (g === 'خدام') return levels.find(l => /خدا?م|خادم/.test(l.name))?.id ?? 'l3';
  const i = GRADES.indexOf(g); return i < 2 ? 'l1' : i < 6 ? 'l2' : 'l3';
};

/**
 * Sessions attended in a row in the member's level, now and at best.
 * Excused sessions neither count nor break the run; sessions before they joined or with no attendance taken are skipped.
 */
export function attendStreak(data: AppData, member: Member): { now: number; best: number } {
  const sessions = data.sessions
    .filter(s => s.levelId === member.levelId && s.attendance[member.id] !== undefined)
    .sort((a, b) => a.date.localeCompare(b.date));
  let now = 0, best = 0;
  for (const s of sessions) {
    const a = s.attendance[member.id];
    if (a === 'p') best = Math.max(best, ++now);
    else if (a === 'a') now = 0;
  }
  return { now, best };
}
/** Streaks worth a word: from 3 sessions in a row. */
export const STREAK_MIN = 3;

type DueHymn = { id: string; nameAr: string; month?: string; status: number; parts?: { id: string; name: string; month?: string }[]; partStatus?: Record<string, number> };
/** This month's hymns or parts the member hasn't memorized yet: their points end with the month. */
export function monthDue(hymns: DueHymn[], month: string): { hymnId: string; name: string; partId?: string; partName?: string }[] {
  return hymns.flatMap(h => {
    const parts = (h.parts ?? []).filter(p => p.month === month && (h.partStatus?.[p.id] ?? 0) < 2)
      .map(p => ({ hymnId: h.id, name: h.nameAr, partId: p.id, partName: p.name }));
    if (parts.length) return parts;
    const monthed = (h.parts ?? []).some(p => p.month);
    return !monthed && h.month === month && h.status < 2 ? [{ hymnId: h.id, name: h.nameAr }] : [];
  });
}
/** Days left in the month, today included (the 30th of a 30-day month = 1). */
export const daysLeftInMonth = (date = todayISO()) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m, 0).getDate() - d + 1;
};
/** Reminders about the month's parts start a week before it ends. */
export const DUE_WINDOW = 7;
