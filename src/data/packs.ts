import type { AppData, Hymn } from './types';
import { curriculumKey, uid } from './logic';
import { norm } from './importSheet';

/** A ready curriculum: hymns transcribed from the school's own booklet, built by scripts/build-pack.py. */
export interface Pack {
  id: string;
  title: string;
  /** Level the booklet was made for. */
  levelId: string;
  source: string;
  hymns: Omit<Hymn, 'id'>[];
}

/** Packs offered on the curriculum screen. */
export const PACKS = [{ id: 'nativity-shabab', title: 'ألحان عيد الميلاد', levelId: 'l3', count: 15 }];

const cache = new Map<string, Promise<Pack>>();
export function loadPack(id: string) {
  if (!cache.has(id)) {
    const p = fetch(`packs/${id}.json?v=1`).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<Pack>; });
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return cache.get(id)!;
}

/**
 * Adds the pack's hymns to the library and to one term/level curriculum, in order.
 * A hymn already in the library under the same name is reused, not duplicated.
 */
export function applyPack(d: AppData, pack: Pack, termId: string, levelId: string): AppData {
  const byName = new Map(d.hymns.map(h => [norm(h.nameAr), h.id]));
  const added: Hymn[] = [];
  const ids = pack.hymns.map(h => {
    const found = byName.get(norm(h.nameAr));
    if (found) return found;
    const hymn: Hymn = { ...h, id: uid() };
    added.push(hymn);
    return hymn.id;
  });
  const key = curriculumKey(termId, levelId);
  const current = d.curricula[key] ?? [];
  return {
    ...d,
    hymns: [...d.hymns, ...added],
    curricula: { ...d.curricula, [key]: [...current, ...ids.filter(id => !current.includes(id))] },
  };
}
