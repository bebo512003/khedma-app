import { useEffect, useState } from 'react';
import { useAllowedLevel, useCan, useStore } from '../data/store';

/** How many recitations wait for a servant's listen, in the levels this servant serves. */
export function usePending() {
  const { cloud } = useStore();
  const canSessions = useCan('sessions');
  const allowed = useAllowedLevel();
  const [pending, setPending] = useState(0);
  useEffect(() => {
    if (!cloud || !canSessions) return;
    let stop = () => {};
    import('../firebase/submissions').then(m => { stop = m.watchPending(l => setPending(l.filter(s => allowed(s.levelId)).length)); });
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloud, canSessions]);
  return pending;
}
