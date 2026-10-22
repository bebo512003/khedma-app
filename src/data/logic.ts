import type { AppData, Member, Session } from './types';

export const POINTS = { attendance: 2, memorized: 5, solo: 10 } as const;

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
    if (recent.length >= 3 && missed >= 2) reasons.push(`غاب ${missed} من آخر ${recent.length} حصص`);
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
  const b = { attended: 0, attendance: 0, rating: 0, memorized: 0, solo: 0, total: 0 };
  for (const s of data.sessions) {
    if (!s.date.startsWith(month)) continue;
    if (s.attendance[memberId] === 'p') { b.attended++; b.attendance += POINTS.attendance; }
    b.rating += sessionAverage(s, memberId) ?? 0;
    const ms = s.milestones?.[memberId];
    if (ms) { b.memorized += ms.memorized; b.solo += ms.solo; }
  }
  b.rating = Math.round(b.rating);
  b.total = b.attendance + b.rating + b.memorized * POINTS.memorized + b.solo * POINTS.solo;
  return b;
}

export const monthPoints = (data: AppData, memberId: string, month: string) => monthBreakdown(data, memberId, month).total;

export function ranking(data: AppData, levelId: string, month: string) {
  return data.members
    .filter(m => m.levelId === levelId)
    .map(m => ({ member: m, points: monthPoints(data, m.id, month) }))
    .sort((a, b) => b.points - a.points);
}

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

/** Minutes of grace after the session's start before a scanned arrival counts as late. */
export const LATE_GRACE_MIN = 10;
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
export const pointsCount = (n: number) => n === 1 ? 'نقطة واحدة' : count(n, 'نقطة', 'نقطتين', 'نقط');
export const pagesCount = (n: number) => n === 1 ? 'صفحة واحدة' : count(n, 'صفحة', 'صفحتين', 'صفحات');
/** Searches match whatever hamza or ta marbuta spelling was typed. */
export const fold = (s: string) => s.trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[ً-ْ]/g, '').replace(/\s+/g, ' ');
export const sessionsCount = (n: number) => n === 1 ? 'حصة واحدة' : count(n, 'حصة', 'حصتين', 'حصص');

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

export const GRADES = [
  'أولى ابتدائي', 'تانية ابتدائي', 'تالتة ابتدائي', 'رابعة ابتدائي', 'خامسة ابتدائي', 'سادسة ابتدائي',
  'أولى إعدادي', 'تانية إعدادي', 'تالتة إعدادي', 'أولى ثانوي', 'تانية ثانوي', 'تالتة ثانوي', 'جامعة', 'خريج', 'خدام',
];
/** Default level from school grade: grades 1-2 → ابتدائي 1, 3-6 → ابتدائي 2, prep and up → شباب, servants → the level named خدام if there is one. */
export const levelForGrade = (g: string, levels: { id: string; name: string }[] = []) => {
  if (g === 'خدام') return levels.find(l => /خدا?م|خادم/.test(l.name))?.id ?? 'l3';
  const i = GRADES.indexOf(g); return i < 2 ? 'l1' : i < 6 ? 'l2' : 'l3';
};
