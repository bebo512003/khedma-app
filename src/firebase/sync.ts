import { deleteDoc, onSnapshot, setDoc, writeBatch, type Firestore, type WriteBatch } from 'firebase/firestore';
import type { AppData } from '../data/types';
import { buildMemberView } from '../data/memberView';
import { col, phoneKey, ref } from './paths';

/** Collections that hold one document per item, keyed by the item's id. */
const LISTS = ['levels', 'hymns', 'books', 'terms', 'members', 'sessions'] as const;
type ListKey = typeof LISTS[number];

const empty = (): AppData => ({
  version: 1, levels: [], members: [], hymns: [], books: [], terms: [], curricula: {}, progress: {}, sessions: [],
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
    ...LISTS.map(k => onSnapshot(col(db, k), s => { lists[k] = s.docs.map(d => d.data()); emit(); }, e => onError(new Error(`${k}: ${e.message}`)))),
    onSnapshot(col(db, 'progress'), s => { progress = Object.fromEntries(s.docs.map(d => [d.id, d.data()])) as AppData['progress']; emit(); }, e => onError(new Error(`progress: ${e.message}`))),
    onSnapshot(ref(db, 'meta', 'app'), s => { meta = (s.data() ?? {}) as Partial<AppData>; emit(); }, e => onError(new Error(`meta: ${e.message}`))),
  ];
  return () => unsubs.forEach(u => u());
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Firestore batches cap at 500 operations; split larger change sets. */
/** Groups writes into batches under Firestore's limits: 500 writes and 10 MiB a request (kept well under both). */
function batcher(db: Firestore) {
  const batches: WriteBatch[] = [];
  let n = 500, size = 0;
  return {
    op(fn: (b: WriteBatch) => void, bytes = 2000) {
      if (n >= 450 || size + bytes > 4_000_000) { batches.push(writeBatch(db)); n = 0; size = 0; }
      fn(batches[batches.length - 1]); n++; size += bytes;
    },
    commit: () => Promise.all(batches.map(b => b.commit())),
  };
}

/** Writes only what changed between two snapshots of the data. Offline writes queue and sync later. */
export function writeDiff(db: Firestore, prev: AppData, next: AppData) {
  const b = batcher(db);
  for (const k of LISTS) {
    const before = new Map((prev[k] as { id: string }[]).map(x => [x.id, x]));
    const after = new Map((next[k] as { id: string }[]).map(x => [x.id, x]));
    for (const [id, x] of after) if (!same(before.get(id), x)) b.op(w => w.set(ref(db, k, id), x), JSON.stringify(x).length * 1.2);
    for (const id of before.keys()) if (!after.has(id)) b.op(w => w.delete(ref(db, k, id)));
  }
  const ids = new Set([...Object.keys(prev.progress), ...Object.keys(next.progress)]);
  for (const id of ids) {
    if (same(prev.progress[id], next.progress[id])) continue;
    b.op(w => next.progress[id] ? w.set(ref(db, 'progress', id), next.progress[id]) : w.delete(ref(db, 'progress', id)));
  }
  const pick = (d: AppData) => ({ curricula: d.curricula, templates: d.templates, nextCode: d.nextCode, ...(d.coupons ? { coupons: d.coupons } : {}) });
  if (!same(pick(prev), pick(next))) b.op(w => w.set(ref(db, 'meta', 'app'), pick(next)));
  return b.commit();
}

/**
 * Publishes each member's view (points, rank, hymns, ratings) for the member app.
 * `published` remembers what this device last wrote, so only views that changed are rewritten.
 */
export async function publishViews(db: Firestore, data: AppData, published: Map<string, string>, mayLevel: (levelId: string) => boolean = () => true) {
  publishPhones(db, data).catch(() => undefined);
  // One write per view, so a view that is refused doesn't hold back everyone else's, and we can say whose it was.
  const jobs: { id: string; run: () => Promise<void> }[] = [];
  // Each ended month's coupon winners are worked out once for everyone.
  const cache = new Map();
  for (const m of data.members) {
    if (!mayLevel(m.levelId)) continue;
    const v = buildMemberView(data, m.id, undefined, cache);
    const json = JSON.stringify(v);
    if (published.get(m.id) === json) continue;
    published.set(m.id, json);
    jobs.push({ id: m.id, run: () => setDoc(ref(db, 'memberViews', m.id), v!) });
  }
  for (const id of [...published.keys()]) {
    const m = data.members.find(x => x.id === id);
    if (m && mayLevel(m.levelId)) continue;
    published.delete(id);
    // Moved to a level this servant doesn't serve: that level's servants publish it now.
    if (m) continue;
    jobs.push({ id, run: () => deleteDoc(ref(db, 'memberViews', id)) });
  }
  const results = await Promise.allSettled(jobs.map(j => j.run()));
  const failed = jobs.filter((_, i) => results[i].status === 'rejected');
  if (!failed.length) return;
  // Forgotten, so the next change (or the next app start) tries them again.
  for (const j of failed) published.delete(j.id);
  const names = failed.map(j => data.members.find(m => m.id === j.id)?.name ?? j.id).slice(0, 5).join('، ');
  const why = (results.find(r => r.status === 'rejected') as PromiseRejectedResult).reason;
  throw new Error(`بيانات الدارسين (${names}${failed.length > 5 ? ` و${failed.length - 5} كمان` : ''}): ${why?.message ?? why}`);
}

/** What this device last wrote to the phone index: hashed phone → codes. */
const phonesPublished = new Map<string, string>();

/**
 * Members can sign in with a mobile number (theirs or a parent's) instead of their code: phones/{hash} lists the codes
 * of members with a login on that number, and the PIN tells siblings apart. Hashed so the index holds no numbers.
 */
async function publishPhones(db: Firestore, data: AppData) {
  const byPhone = new Map<string, string[]>();
  for (const m of data.members) {
    if (!m.account) continue;
    for (const p of new Set([m.phone, m.parentPhone].filter((x): x is string => !!x))) byPhone.set(p, [...(byPhone.get(p) ?? []), m.code]);
  }
  const b = batcher(db);
  const seen = new Set<string>();
  for (const [phone, codes] of byPhone) {
    const h = await phoneKey(phone);
    seen.add(h);
    const json = JSON.stringify(codes.sort());
    if (phonesPublished.get(h) === json) continue;
    phonesPublished.set(h, json);
    b.op(w => w.set(ref(db, 'phones', h), { codes: codes.sort() }));
  }
  for (const h of [...phonesPublished.keys()]) if (!seen.has(h)) { phonesPublished.delete(h); b.op(w => w.delete(ref(db, 'phones', h))); }
  return b.commit();
}

export { empty as emptyData };
