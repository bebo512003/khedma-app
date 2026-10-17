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
 * Points for a month (YYYY-MM): attendance + each session's average rating,
 * plus milestone points recorded on the session when a hymn status reached حافظه or بيقوله لوحده.
 */
export function monthPoints(data: AppData, memberId: string, month: string): number {
  let total = 0;
  for (const s of data.sessions) {
    if (!s.date.startsWith(month)) continue;
    if (s.attendance[memberId] === 'p') total += POINTS.attendance;
    const avg = sessionAverage(s, memberId);
    if (avg) total += avg;
    const ms = s.milestones?.[memberId];
    if (ms) total += ms.memorized * POINTS.memorized + ms.solo * POINTS.solo;
  }
  return Math.round(total);
}

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

export const todayISO = () => new Date().toISOString().slice(0, 10);
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
