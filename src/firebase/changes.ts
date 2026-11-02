import { addDoc, type Firestore } from 'firebase/firestore';
import type { AppData } from '../data/types';
import { col } from './paths';

/** What one save changed, written to churches/{c}/changes so the lead can see who did what (and bring back what was deleted). */
export interface ChangeItem {
  what: 'levels' | 'members' | 'hymns' | 'books' | 'terms' | 'sessions' | 'progress' | 'meta';
  kind: 'add' | 'edit' | 'delete';
  id: string;
  label: string;
  /** For deletes: the record as it was (photos left out), so it can be put back. */
  before?: unknown;
}
export interface Change { at: number; by: string; byName: string; items: ChangeItem[]; more?: number }

const LISTS = ['levels', 'members', 'hymns', 'books', 'terms', 'sessions'] as const;
const MAX_ITEMS = 40, MAX_BYTES = 600_000;

/** A short name a person recognises for any record. */
export function labelOf(data: AppData, what: string, x: Record<string, unknown> | undefined, id: string): string {
  if (!x) return id;
  if (what === 'sessions') return `حصة ${data.levels.find(l => l.id === x.levelId)?.name ?? ''} ${x.date ?? ''}`.trim();
  return String(x.name ?? x.nameAr ?? x.title ?? id);
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function diffItems(prev: AppData, next: AppData): { items: ChangeItem[]; more: number } {
  const items: ChangeItem[] = [];
  for (const k of LISTS) {
    const before = new Map((prev[k] as { id: string }[]).map(x => [x.id, x]));
    const after = new Map((next[k] as { id: string }[]).map(x => [x.id, x]));
    for (const [id, x] of after) {
      const b = before.get(id);
      if (!b) items.push({ what: k, kind: 'add', id, label: labelOf(next, k, x as never, id) });
      else if (!same(b, x)) items.push({ what: k, kind: 'edit', id, label: labelOf(next, k, x as never, id) });
    }
    for (const [id, x] of before) if (!after.has(id)) {
      const { photo: _photo, ...rest } = x as Record<string, unknown>;
      void _photo;
      items.push({ what: k, kind: 'delete', id, label: labelOf(prev, k, x as never, id), before: rest });
    }
  }
  const progressed = new Set([...Object.keys(prev.progress), ...Object.keys(next.progress)].filter(id => !same(prev.progress[id], next.progress[id])));
  for (const id of progressed) {
    const gone = !next.progress[id];
    const m = (next.members.find(x => x.id === id) ?? prev.members.find(x => x.id === id)) as never;
    items.push({ what: 'progress', kind: gone ? 'delete' : 'edit', id, label: labelOf(next, 'members', m, id), ...(gone ? { before: prev.progress[id] } : {}) });
  }
  const meta = (d: AppData) => ({ curricula: d.curricula, templates: d.templates });
  if (!same(meta(prev), meta(next))) items.push({ what: 'meta', kind: 'edit', id: 'app', label: same(prev.curricula, next.curricula) ? 'رسايل الواتساب' : 'المنهج' });
  // Deletes first: they matter most when something goes missing.
  items.sort((a, b) => (a.kind === 'delete' ? 0 : 1) - (b.kind === 'delete' ? 0 : 1));
  const kept = items.slice(0, MAX_ITEMS);
  // Keep the document well under Firestore's 1 MB: drop the saved copies before dropping entries.
  let size = JSON.stringify(kept).length;
  for (let i = kept.length - 1; i >= 0 && size > MAX_BYTES; i--) if (kept[i].before) { size -= JSON.stringify(kept[i].before).length; delete kept[i].before; }
  return { items: kept, more: items.length - kept.length };
}

export async function logChange(db: Firestore, by: { uid: string; name: string }, prev: AppData, next: AppData) {
  const { items, more } = diffItems(prev, next);
  if (!items.length) return;
  const c: Change = { at: Date.now(), by: by.uid, byName: by.name, items, ...(more ? { more } : {}) };
  // Firestore refuses undefined values; JSON drops them.
  await addDoc(col(db, 'changes'), JSON.parse(JSON.stringify(c)));
}
