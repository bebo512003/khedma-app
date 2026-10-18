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
export const formatDay = (iso: string) => dayFmt.format(new Date(`${iso}T12:00:00`));

/** Member PINs are stored only as a salted SHA-256 hash. Real verification moves server-side with Firebase. */
export async function hashPin(memberId: string, pin: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${memberId}:${pin}`));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export const newPin = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 10000).padStart(4, '0');

/** Arabic counting: 1 → لحن واحد, 2 → لحنين, 3–10 → 3 ألحان, 11+ → 11 لحن. */
export function count(n: number, one: string, two: string, few: string) {
  if (n === 1) return `${one} واحد`;
  if (n === 2) return two;
  return n >= 3 && n <= 10 ? `${n} ${few}` : `${n} ${one}`;
}
export const hymnsCount = (n: number) => count(n, 'لحن', 'لحنين', 'ألحان');
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

export const birthdayWhen = (daysAway: number) =>
  daysAway === 0 ? 'النهارده' : daysAway === 1 ? 'بكرة' : `بعد ${daysAway} أيام`;
export const yearsCount = (n: number) => n === 1 ? 'سنة واحدة' : n === 2 ? 'سنتين' : n >= 3 && n <= 10 ? `${n} سنين` : `${n} سنة`;

/** Who gets WhatsApp messages about a member: their own number if they have one, otherwise the parent's. */
export function contact(m: Member): { phone?: string; who: 'self' | 'parent' | null } {
  if (waNumber(m.phone)) return { phone: m.phone, who: 'self' };
  if (waNumber(m.parentPhone)) return { phone: m.parentPhone, who: 'parent' };
  return { who: null };
}
