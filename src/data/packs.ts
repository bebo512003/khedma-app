import type { AppData, Book, Hymn } from './types';
import { uid } from './logic';
import { norm } from './importSheet';
import { applyBook } from './books';

/** A ready curriculum: the school's booklet with its hymns transcribed, built by scripts/build-pack.py. */
export interface Pack {
  id: string;
  title: string;
  /** Level the booklet was made for. */
  levelId: string;
  source: string;
  book: { title: string; pagesBase: string; pageCount: number };
  hymns: (Omit<Hymn, 'id'> & { from?: number; to?: number })[];
}

/** Packs offered on the curriculum and books screens. */
export const PACKS = [{ id: 'nativity-shabab', levelId: 'l3' }];

const cache = new Map<string, Promise<Pack>>();
export function loadPack(id: string) {
  if (!cache.has(id)) {
    const p = fetch(`packs/${id}.json?v=2`).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<Pack>; });
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return cache.get(id)!;
}

export const packAdded = (d: AppData, pack: Pack) => d.books.some(b => b.pagesBase === pack.book.pagesBase);

/**
 * Adds the booklet as a book for this term and level, its hymns to the library, and the
 * book's index to the curriculum. A hymn already in the library under the same name is reused.
 */
export function applyPack(d: AppData, pack: Pack, termId: string, levelId: string): AppData {
  const byName = new Map(d.hymns.map(h => [norm(h.nameAr), h.id]));
  const added: Hymn[] = [];
  const filled = new Map<string, Partial<Hymn>>();
  const entries = pack.hymns.map(({ from, to, ...h }) => {
    let hymnId = byName.get(norm(h.nameAr));
    if (hymnId) {
      // Keep what the servants wrote; only fill what's still empty (text, audio, notes).
      const old = d.hymns.find(x => x.id === hymnId)!;
      filled.set(hymnId, Object.fromEntries(Object.entries(h).filter(([k]) => !old[k as keyof Hymn])));
    } else {
      hymnId = uid();
      added.push({ ...h, id: hymnId });
    }
    return { hymnId, from, to };
  });
  const existing = d.books.find(b => b.pagesBase === pack.book.pagesBase);
  const book: Book = { ...existing, id: existing?.id ?? uid(), ...pack.book, termId, levelId, entries };
  const next = { ...d, hymns: [...d.hymns.map(x => filled.has(x.id) ? { ...x, ...filled.get(x.id) } : x), ...added], books: [...d.books.filter(b => b.id !== book.id), book] };
  return applyBook(next, book);
}
