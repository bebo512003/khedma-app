import type { AppData, Hymn } from './types';
import { norm } from './importSheet';

/** Same hymn under a slightly different spelling: hamza, ى/ي, brackets, a leading "لحن". */
const key = (h: Hymn) => norm(h.nameAr).replace(/^لحن\s+/, '').replace(/[^\p{L}\p{N}]+/gu, '');
const firstLine = (h: Hymn) => (h.copticText ?? '').split('\n').find(l => l.trim() && !l.startsWith('§'))?.replace(/\s+/g, '') ?? '';
const weight = (h: Hymn) => JSON.stringify(h).length;

/** Groups of library hymns that are the same hymn saved more than once. */
export function duplicateGroups(d: AppData): Hymn[][] {
  const groups = new Map<string, Hymn[]>();
  for (const h of d.hymns) {
    const k = h.packKey ?? key(h);
    groups.set(k, [...(groups.get(k) ?? []), h]);
  }
  // Pack hymns also match an older copy by name or by the first verse of their Coptic text.
  for (const [k, g] of [...groups]) {
    const lead = g.find(h => h.packKey);
    if (!lead || !groups.has(k)) continue;
    for (const [k2, g2] of [...groups]) {
      if (k2 === k || g2.some(h => h.packKey)) continue;
      if (g2.some(h => key(h) === key(lead) || (firstLine(h) && firstLine(h) === firstLine(lead)))) { groups.set(k, [...groups.get(k)!, ...g2]); groups.delete(k2); }
    }
  }
  return [...groups.values()].filter(g => g.length > 1);
}

/**
 * Keeps one hymn per group and points everything at it: curricula, books, members' progress and past sessions.
 * The kept one is the booklet's copy when there is one, otherwise the fullest; it takes any field it was missing.
 */
export function mergeDuplicates(d: AppData, groups = duplicateGroups(d)): AppData {
  if (!groups.length) return d;
  const to = new Map<string, string>();
  const kept = new Map<string, Hymn>();
  for (const g of groups) {
    const keep = [...g].sort((a, b) => Number(!!b.packKey) - Number(!!a.packKey) || weight(b) - weight(a))[0];
    let merged = keep;
    for (const h of g) if (h.id !== keep.id) {
      to.set(h.id, keep.id);
      merged = { ...Object.fromEntries(Object.entries(h).filter(([, v]) => v !== undefined && v !== '')), ...Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== undefined && v !== '')), id: keep.id } as Hymn;
    }
    kept.set(keep.id, merged);
  }
  const map = (id: string) => to.get(id) ?? id;
  const uniq = (ids: string[]) => [...new Set(ids.map(map))];
  return {
    ...d,
    hymns: d.hymns.filter(h => !to.has(h.id)).map(h => kept.get(h.id) ?? h),
    curricula: Object.fromEntries(Object.entries(d.curricula).map(([k, ids]) => [k, uniq(ids)])),
    books: d.books.map(b => ({ ...b, entries: b.entries.filter((e, i, all) => all.findIndex(x => map(x.hymnId) === map(e.hymnId)) === i).map(e => ({ ...e, hymnId: map(e.hymnId) })) })),
    progress: Object.fromEntries(Object.entries(d.progress).map(([m, p]) => {
      const out: typeof p = {};
      for (const [h, s] of Object.entries(p)) out[map(h)] = Math.max(out[map(h)] ?? 0, s) as typeof s;
      return [m, out];
    })),
    sessions: d.sessions.map(s => s.hymnIds.some(id => to.has(id)) ? { ...s, hymnIds: uniq(s.hymnIds) } : s),
  };
}
