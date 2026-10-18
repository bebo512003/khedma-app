import type { AppData, Book, BookEntry } from './types';
import { curriculumKey } from './logic';

/** A page image: hosted with the app, or 'fs:<key>' for an uploaded PDF (see PageImg). */
export const pageUrl = (b: Book, n: number) => b.uploaded
  ? `fs:${b.id}-${String(n).padStart(2, '0')}`
  : `${b.pagesBase}${String(n).padStart(2, '0')}.webp`;

export const hasPages = (b: Book) => !!(b.uploaded || b.pagesBase) && !!b.pageCount;

/** The pages one entry spans, when the book has page images. */
export function entryPages(b: Book, e: BookEntry): string[] {
  if (!hasPages(b) || !e.from) return [];
  const to = Math.max(e.from, e.to ?? e.from);
  return Array.from({ length: Math.max(0, Math.min(to, b.pageCount!) - e.from + 1) }, (_, i) => pageUrl(b, e.from! + i));
}

export const pagesLabel = (e: BookEntry) => !e.from ? '' : e.to && e.to !== e.from ? `ص ${e.from}–${e.to}` : `ص ${e.from}`;

/** The book (and its entry) a hymn appears in; the one for the given term wins when there are several. */
export function bookOf(data: AppData, hymnId: string, termId?: string) {
  const hits = data.books.flatMap(b => b.entries.filter(e => e.hymnId === hymnId).map(e => ({ book: b, entry: e })));
  return hits.find(h => h.book.termId === termId) ?? hits[0];
}

/** Books for a term and level, plus books not tied to a level or term. */
export const booksFor = (data: AppData, termId?: string, levelId?: string) =>
  data.books.filter(b => (!b.termId || b.termId === termId) && (!b.levelId || b.levelId === levelId));

/** Puts the book's hymns into its term/level curriculum in the book's order, keeping hymns added by hand after them. */
export function applyBook(d: AppData, b: Book): AppData {
  if (!b.termId || !b.levelId) return d;
  const key = curriculumKey(b.termId, b.levelId);
  const ids = [...new Set(b.entries.map(e => e.hymnId))].filter(id => d.hymns.some(h => h.id === id));
  const rest = (d.curricula[key] ?? []).filter(id => !ids.includes(id));
  return { ...d, curricula: { ...d.curricula, [key]: [...ids, ...rest] } };
}
