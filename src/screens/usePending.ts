import { useEffect, useState } from 'react';
import { useAllowedLevel, useCan, useStore } from '../data/store';
import type { Submission } from '../data/types';

/** Recitations waiting for a servant's listen, in the levels this servant serves. */
export function usePending() {
  const { cloud } = useStore();
  const canSessions = useCan('sessions');
  const allowed = useAllowedLevel();
  const [pending, setPending] = useState<Submission[]>([]);
  useEffect(() => {
    if (!cloud || !canSessions) return;
    let stop = () => {};
    import('../firebase/submissions').then(m => { stop = m.watchPending(l => setPending(l.filter(s => allowed(s.levelId)))); });
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloud, canSessions]);
  return pending;
}
