import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { get, set } from 'idb-keyval';
import type { AppData } from './types';
import { seedData } from './seed';

/**
 * Local-first store. Everything lives in IndexedDB on the device, so the app works with no connection.
 * The Firestore sync layer plugs in here later: same AppData shape, scoped under churches/{churchId}.
 */
const KEY = 'khedma.data.v1';

interface Store {
  data: AppData | null;
  update: (fn: (d: AppData) => AppData) => void;
  reset: () => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const latest = useRef<AppData | null>(null);

  useEffect(() => {
    get<AppData>(KEY)
      .then(d => d ?? seedData())
      .catch(() => seedData())
      .then(d => { latest.current = d; setData(d); });
  }, []);

  const update = useCallback((fn: (d: AppData) => AppData) => {
    if (!latest.current) return;
    const next = fn(latest.current);
    latest.current = next;
    setData(next);
    set(KEY, next).catch(() => { /* storage blocked: keep working in memory */ });
  }, []);

  const reset = useCallback(() => update(() => seedData()), [update]);

  return <Ctx.Provider value={{ data, update, reset }}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}

/** Data is loaded once at startup; screens render only after this resolves. */
export function useData(): [AppData, Store['update']] {
  const { data, update } = useStore();
  return [data as AppData, update];
}
