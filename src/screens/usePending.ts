import { useSyncExternalStore } from 'react';
import { useAllowedLevel, useCan, useStore } from '../data/store';
import type { Submission } from '../data/types';

/** One Firestore listener for every screen that counts recitations (home, nav, bell), open while any of them is. */
let list: Submission[] = [];
const listeners = new Set<() => void>();
let stop: (() => void) | undefined;
let gen = 0;
function listen(cb: () => void) {
  listeners.add(cb);
  if (listeners.size === 1) {
    const g = ++gen;
    import('../firebase/submissions').then(m => {
      if (g !== gen) return;
      stop = m.watchPending(l => { list = l; listeners.forEach(f => f()); });
    });
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size) return;
    gen++; stop?.(); stop = undefined; list = [];
  };
}
const none = () => () => {};
const EMPTY: Submission[] = [];

/** Recitations waiting for a servant's listen, in the levels this servant serves. */
export function usePending() {
  const { cloud } = useStore();
  const canSessions = useCan('sessions');
  const allowed = useAllowedLevel();
  const on = cloud && canSessions;
  const all = useSyncExternalStore(on ? listen : none, () => on ? list : EMPTY);
  return all.filter(s => allowed(s.levelId));
}
