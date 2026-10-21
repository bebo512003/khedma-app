import type { AppData, Member } from './types';

/**
 * Member codes are 4 digits: the level's place in the school (1 = the first level) in the thousands, then a count
 * within that level, e.g. ابتدائي 1 → 1001, 1002…, شباب → 3001… The code is set once, when the member is added:
 * it is their login and it is printed on their QR card, so moving up a level keeps it.
 */
export function levelDigit(d: Pick<AppData, 'levels'>, levelId: string) {
  const i = [...d.levels].sort((a, b) => a.order - b.order).findIndex(l => l.id === levelId);
  return Math.min(9, i + 1 || 9);
}

/** Hands out new codes that no member has, one level at a time. Keep using the same coder for a batch. */
export function coder(d: Pick<AppData, 'levels' | 'members'>) {
  const used = new Set(d.members.map(m => m.code));
  return (levelId: string) => {
    const p = levelDigit(d, levelId);
    let n = 1;
    for (const c of used) if (/^\d{4,}$/.test(c) && c.length === 4 && c[0] === String(p)) n = Math.max(n, Number(c.slice(1)) + 1);
    let code = `${p}${String(n).padStart(3, '0')}`;
    while (used.has(code)) code = `${p}${String(++n).padStart(3, '0')}`;
    used.add(code);
    return code;
  };
}

export const newCode = (d: Pick<AppData, 'levels' | 'members'>, levelId: string) => coder(d)(levelId);

/** Codes more than one member has. */
export function repeatedCodes(members: Member[]) {
  const seen = new Map<string, number>();
  for (const m of members) seen.set(m.code, (seen.get(m.code) ?? 0) + 1);
  return new Set([...seen].filter(([, n]) => n > 1).map(([c]) => c));
}

/** Everyone numbered afresh by their level now: levels in order, names alphabetically. memberId → new code. */
export function renumber(d: Pick<AppData, 'levels' | 'members'>) {
  const order = new Map([...d.levels].sort((a, b) => a.order - b.order).map((l, i) => [l.id, i]));
  const sorted = [...d.members].sort((a, b) => (order.get(a.levelId) ?? 99) - (order.get(b.levelId) ?? 99) || a.name.localeCompare(b.name, 'ar'));
  const next = coder({ levels: d.levels, members: [] });
  return new Map(sorted.map(m => [m.id, next(m.levelId)]));
}
