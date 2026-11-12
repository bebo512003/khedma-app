import type { AppData, Coupons, Member } from './types';
import { ranking, todayISO } from './logic';

/**
 * Monthly coupons: when a month ends, places 1–3 of each level's ranking get coupons that add up month after month,
 * and the lead takes them off when a learner swaps them for a gift. Nothing is stored for a month: it's worked out
 * from the sessions, like the ranking itself; only what's spent is kept on the member.
 */
export const COUPON_DEFAULTS: Coupons = { values: [100, 70, 40], since: todayISO().slice(0, 7) };
const thisMonth = () => todayISO().slice(0, 7);
const next = (m: string) => { const [y, mo] = m.split('-').map(Number); return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`; };

/** Months that ended since coupons started (and have sessions), oldest first. */
export function closedMonths(data: AppData): string[] {
  const c = data.coupons;
  if (!c?.since) return [];
  const had = new Set(data.sessions.map(s => s.date.slice(0, 7)));
  const out: string[] = [];
  for (let m = c.since; m < thisMonth() && out.length < 240; m = next(m)) if (had.has(m)) out.push(m);
  return out;
}

export type Winner = { member: Member; levelId: string; place: number; points: number; value: number };

/** Who earns coupons in a month: each level's places with a value, among learners with points. */
export function monthWinners(data: AppData, month: string, values = data.coupons?.values ?? COUPON_DEFAULTS.values): Winner[] {
  return [...data.levels].sort((a, b) => a.order - b.order).flatMap(l =>
    ranking(data, l.id, month).filter(r => r.points > 0 && r.place <= values.length && values[r.place - 1] > 0)
      .map(r => ({ member: r.member, levelId: l.id, place: r.place, points: r.points, value: values[r.place - 1] })));
}

/** A member's coupons: what each ended month gave, what was spent, and what's left. */
export function couponLedger(data: AppData, memberId: string, cache?: Map<string, Winner[]>) {
  const earned = closedMonths(data).flatMap(month => {
    const w = cache?.get(month) ?? monthWinners(data, month);
    cache?.set(month, w);
    return w.filter(x => x.member.id === memberId).map(x => ({ month, levelId: x.levelId, place: x.place, value: x.value }));
  });
  const spent = data.members.find(m => m.id === memberId)?.spent ?? [];
  const total = earned.reduce((n, e) => n + e.value, 0);
  const used = spent.reduce((n, s) => n + s.amount, 0);
  return { earned, spent, total, used, balance: total - used };
}
