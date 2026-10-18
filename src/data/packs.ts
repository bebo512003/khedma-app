import type { AppData, Book, Hymn } from './types';
import { uid } from './logic';
import { norm } from './importSheet';
import { applyBook } from './books';

/** A ready curriculum: the school's booklet with its hymns transcribed, built by scripts/build-pack.py. */
export interface Pack {
  id: string;
  /** Edition of the booklet; a higher one replaces books added from older ones. */
  version: number;
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
    const p = fetch(`packs/${id}.json?v=3`).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<Pack>; });
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return cache.get(id)!;
}

/** The book a pack was added as, including books from before packs carried an id. */
const packBook = (d: AppData, pack: Pack) =>
  d.books.find(b => b.packId === pack.id || (!b.packId && b.pagesBase?.startsWith(`books/${pack.id}/`)));

/** 'new': not added yet; 'old': added from an earlier edition of the booklet; 'current': up to date. */
export function packState(d: AppData, pack: Pack): 'new' | 'old' | 'current' {
  const b = packBook(d, pack);
  if (!b) return 'new';
  return (b.packVersion ?? 1) < pack.version ? 'old' : 'current';
}

const TEXT = ['copticText', 'arabicCoptic', 'meaning', 'audioUrl', 'notes', 'when'] as const;

/**
 * Adds the booklet as a book for this term and level, its hymns to the library, and the
 * book's index to the curriculum. A hymn already in the library under the same name is reused:
 * on first add only its empty fields are filled; when updating to a new edition its text,
 * recording link and notes follow the new booklet.
 */
export function applyPack(d: AppData, pack: Pack, termId: string, levelId: string): AppData {
  const existing = packBook(d, pack);
  const updating = !!existing;
  const byName = new Map(d.hymns.map(h => [norm(h.nameAr), h.id]));
  const added: Hymn[] = [];
  const changed = new Map<string, Partial<Hymn>>();
  const entries = pack.hymns.map(({ from, to, ...h }) => {
    let hymnId = byName.get(norm(h.nameAr));
    if (hymnId) {
      const old = d.hymns.find(x => x.id === hymnId)!;
      changed.set(hymnId, updating
        ? { ...Object.fromEntries(Object.entries(h).filter(([k]) => !old[k as keyof Hymn])), ...Object.fromEntries(TEXT.filter(k => h[k]).map(k => [k, h[k]])) }
        : Object.fromEntries(Object.entries(h).filter(([k]) => !old[k as keyof Hymn])));
    } else {
      hymnId = uid();
      added.push({ ...h, id: hymnId });
    }
    return { hymnId, from, to };
  });
  // Hymns a servant added to the book by hand stay, after the booklet's own.
  const extra = (existing?.entries ?? []).filter(e => !entries.some(x => x.hymnId === e.hymnId));
  const book: Book = {
    ...existing, id: existing?.id ?? uid(), ...pack.book, uploaded: undefined,
    termId: existing?.termId ?? termId, levelId: existing?.levelId ?? levelId,
    packId: pack.id, packVersion: pack.version, entries: [...entries, ...extra],
  };
  const hymns = [...d.hymns.map(x => changed.has(x.id) ? { ...x, ...changed.get(x.id) } : x), ...added];
  return applyBook({ ...d, hymns, books: [...d.books.filter(b => b.id !== book.id), book] }, book);
}
