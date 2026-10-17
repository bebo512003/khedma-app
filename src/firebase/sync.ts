import { onSnapshot, writeBatch, type Firestore, type WriteBatch } from 'firebase/firestore';
import type { AppData } from '../data/types';
import { buildMemberView } from '../data/memberView';
import { col, ref } from './paths';

/** Collections that hold one document per item, keyed by the item's id. */
const LISTS = ['levels', 'hymns', 'terms', 'members', 'sessions'] as const;
type ListKey = typeof LISTS[number];

const empty = (): AppData => ({
  version: 1, levels: [], members: [], hymns: [], terms: [], curricula: {}, progress: {}, sessions: [],
  templates: { absence: '' }, nextCode: 1,
});

/**
 * Live church data. Firestore keeps its own offline cache, so this works with no connection
 * and fires again whenever this device or another servant changes something.
 */
export function subscribe(db: Firestore, onData: (d: AppData) => void, onError: (e: Error) => void) {
  const lists: Partial<Record<ListKey, unknown[]>> = {};
  let progress: AppData['progress'] | undefined;
  let meta: Partial<AppData> | undefined;
  const emit = () => {
    if (LISTS.some(k => !lists[k]) || !progress || !meta) return;
    onData({ ...empty(), ...meta, ...(lists as Pick<AppData, ListKey>), progress });
  };
  const unsubs = [
    ...LISTS.map(k => onSnapshot(col(db, k), s => { lists[k] = s.docs.map(d => d.data()); emit(); }, onError)),
    onSnapshot(col(db, 'progress'), s => { progress = Object.fromEntries(s.docs.map(d => [d.id, d.data()])) as AppData['progress']; emit(); }, onError),
    onSnapshot(ref(db, 'meta', 'app'), s => { meta = (s.data() ?? {}) as Partial<AppData>; emit(); }, onError),
  ];
  return () => unsubs.forEach(u => u());
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Firestore batches cap at 500 operations; split larger change sets. */
function batcher(db: Firestore) {
  const batches: WriteBatch[] = [];
  let n = 500;
  return {
    op(fn: (b: WriteBatch) => void) { if (n >= 450) { batches.push(writeBatch(db)); n = 0; } fn(batches[batches.length - 1]); n++; },
    commit: () => Promise.all(batches.map(b => b.commit())),
  };
}

/** Writes only what changed between two snapshots of the data. Offline writes queue and sync later. */
export function writeDiff(db: Firestore, prev: AppData, next: AppData) {
  const b = batcher(db);
  for (const k of LISTS) {
    const before = new Map((prev[k] as { id: string }[]).map(x => [x.id, x]));
    const after = new Map((next[k] as { id: string }[]).map(x => [x.id, x]));
    for (const [id, x] of after) if (!same(before.get(id), x)) b.op(w => w.set(ref(db, k, id), x));
    for (const id of before.keys()) if (!after.has(id)) b.op(w => w.delete(ref(db, k, id)));
  }
  const ids = new Set([...Object.keys(prev.progress), ...Object.keys(next.progress)]);
  for (const id of ids) {
    if (same(prev.progress[id], next.progress[id])) continue;
    b.op(w => next.progress[id] ? w.set(ref(db, 'progress', id), next.progress[id]) : w.delete(ref(db, 'progress', id)));
  }
  const pick = (d: AppData) => ({ curricula: d.curricula, templates: d.templates, nextCode: d.nextCode });
  if (!same(pick(prev), pick(next))) b.op(w => w.set(ref(db, 'meta', 'app'), pick(next)));
  return b.commit();
}

/**
 * Publishes each member's view (points, rank, hymns, ratings) for the member app.
 * `published` remembers what this device last wrote, so only views that changed are rewritten.
 */
export function publishViews(db: Firestore, data: AppData, published: Map<string, string>) {
  const b = batcher(db);
  for (const m of data.members) {
    const v = buildMemberView(data, m.id);
    const json = JSON.stringify(v);
    if (published.get(m.id) === json) continue;
    published.set(m.id, json);
    b.op(w => w.set(ref(db, 'memberViews', m.id), v!));
  }
  for (const id of [...published.keys()]) {
    if (data.members.some(m => m.id === id)) continue;
    published.delete(id);
    b.op(w => w.delete(ref(db, 'memberViews', id)));
  }
  return b.commit();
}

export { empty as emptyData };
