import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { get, set } from 'idb-keyval';
import type { User } from 'firebase/auth';
import { applyMemberEdit, type AppData, type Invite, type MemberEdit, type Servant } from './types';
import { seedData } from './seed';
import { cloudEnabled } from '../firebase/config';

/**
 * Two modes behind one interface:
 * - offline (no Firebase config): everything lives in IndexedDB on this device.
 * - cloud: Firestore is the source of truth, with its own offline cache; servants sign in with Google.
 * Screens only see `data` and `update`, so they work the same in both.
 */
const KEY = 'khedma.data.v1';

export type Phase = 'loading' | 'signedOut' | 'noAccess' | 'ready';

interface Store {
  data: AppData | null;
  update: (fn: (d: AppData) => AppData) => void;
  reset: () => void;
  cloud: boolean;
  phase: Phase;
  user: User | null;
  servant: Servant | null;
  access: { churchExists: boolean; invite: Invite | null } | null;
  syncError: string;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  startChurch: () => Promise<void>;
  acceptInvite: () => Promise<void>;
}

const Ctx = createContext<Store | null>(null);

/** Local data saved before the church existed online; uploaded when the first servant starts the church. */
const loadLocal = () => get<AppData>(KEY).then(d => d ?? seedData()).catch(() => seedData());

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [servant, setServant] = useState<Servant | null>(null);
  const [access, setAccess] = useState<Store['access']>(null);
  const [syncError, setSyncError] = useState('');
  /** Members' own edits waiting to be applied (cloud mode). */
  const [edits, setEdits] = useState<{ id: string; edit: MemberEdit }[]>([]);
  const latest = useRef<AppData | null>(null);
  const published = useRef(new Map<string, string>());

  // Offline mode
  useEffect(() => {
    if (cloudEnabled) return;
    loadLocal().then(d => { latest.current = d; setData(d); setPhase('ready'); });
  }, []);

  // Cloud mode: who is signed in, and are they a servant of this church?
  useEffect(() => {
    if (!cloudEnabled) return;
    let stopServant = () => {};
    let stopData = () => {};
    let stopAuth = () => {};
    (async () => {
      const [{ servantFb }, { onAuthStateChanged }, { onSnapshot, getDoc }, paths, sync] = await Promise.all([
        import('../firebase/app'), import('firebase/auth'), import('firebase/firestore'), import('../firebase/paths'), import('../firebase/sync'),
      ]);
      const { auth, db } = servantFb();
      stopAuth = onAuthStateChanged(auth, u => {
        stopServant(); stopData();
        setUser(u); setServant(null); setData(null); latest.current = null;
        if (!u) { setPhase('signedOut'); return; }
        setPhase('loading');
        let subscribed = false;
        // Metadata changes too, so a servant record still being written (just accepted an invite or started the church)
        // waits for the server: the rules check that record, and reading church data before it lands is refused for good.
        stopServant = onSnapshot(paths.ref(db, 'servants', u.uid), { includeMetadataChanges: true }, async snap => {
          if (snap.exists() && snap.metadata.hasPendingWrites) return;
          if (snap.exists()) {
            setServant(snap.data() as Servant);
            setPhase('ready');
            if (!subscribed) {
              subscribed = true;
              const stopLists = sync.subscribe(db, d => { latest.current = d; setData(d); }, e => setSyncError(e.message));
              const stopEdits = onSnapshot(paths.col(db, 'memberEdits'), q => setEdits(q.docs.map(x => ({ id: x.id, edit: x.data() as MemberEdit }))), () => undefined);
              stopData = () => { stopLists(); stopEdits(); };
            }
            return;
          }
          const email = (u.email ?? '').toLowerCase();
          const [church, invite] = await Promise.all([
            getDoc(paths.churchRef(db)).catch(() => null),
            getDoc(paths.ref(db, 'invites', email)).catch(() => null),
          ]);
          setAccess({ churchExists: !!church?.exists(), invite: invite?.exists() ? (invite.data() as Invite) : null });
          setPhase('noAccess');
        }, e => { setSyncError(e.message); setPhase('noAccess'); });
      });
    })();
    return () => { stopAuth(); stopServant(); stopData(); };
  }, []);

  const update = useCallback((fn: (d: AppData) => AppData) => {
    const prev = latest.current;
    if (!prev) return;
    const next = fn(prev);
    latest.current = next;
    setData(next);
    if (!cloudEnabled) {
      set(KEY, next).catch(() => { /* storage blocked: keep working in memory */ });
      return;
    }
    Promise.all([import('../firebase/app'), import('../firebase/sync')]).then(([{ servantFb }, sync]) => {
      const { db } = servantFb();
      sync.writeDiff(db, prev, next).then(() => setSyncError('')).catch(e => setSyncError(String(e.message ?? e)));
      sync.publishViews(db, next, published.current).catch(e => setSyncError(String(e.message ?? e)));
    });
  }, []);

  // A member changed their photo or details from the member app: copy it into their record, then clear it.
  useEffect(() => {
    if (!data || !edits.length) return;
    const known = edits.filter(e => data.members.some(m => m.id === e.id));
    if (known.length) update(d => ({ ...d, members: d.members.map(m => { const e = known.find(x => x.id === m.id); return e ? applyMemberEdit(m, e.edit) : m; }) }));
    Promise.all([import('../firebase/app'), import('firebase/firestore'), import('../firebase/paths')]).then(([{ servantFb }, { deleteDoc }, paths]) =>
      edits.forEach(e => deleteDoc(paths.ref(servantFb().db, 'memberEdits', e.id)).catch(() => undefined)));
  }, [data, edits, update]);

  const reset = useCallback(() => update(() => seedData()), [update]);

  const signIn = useCallback(async () => {
    const [{ servantFb }, { GoogleAuthProvider, signInWithPopup, signInWithRedirect }] = await Promise.all([import('../firebase/app'), import('firebase/auth')]);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try { await signInWithPopup(servantFb().auth, provider); }
    catch (e) {
      const c = (e as { code?: string }).code ?? '';
      if (c.includes('popup-blocked') || c.includes('operation-not-supported')) await signInWithRedirect(servantFb().auth, provider);
      else if (!c.includes('popup-closed') && !c.includes('cancelled-popup')) throw e;
    }
  }, []);

  const signOut = useCallback(async () => {
    const [{ servantFb }, auth] = await Promise.all([import('../firebase/app'), import('firebase/auth')]);
    await auth.signOut(servantFb().auth);
  }, []);

  const profile = (u: User) => ({ uid: u.uid, name: u.displayName ?? u.email ?? '', email: (u.email ?? '').toLowerCase() });

  /** First servant: creates the church, becomes its lead, and uploads what was entered on this device. */
  const startChurch = useCallback(async () => {
    if (!user) return;
    const [{ servantFb }, { setDoc, serverTimestamp }, paths, sync] = await Promise.all([
      import('../firebase/app'), import('firebase/firestore'), import('../firebase/paths'), import('../firebase/sync'),
    ]);
    const { db } = servantFb();
    const local = await loadLocal();
    await setDoc(paths.churchRef(db), { name: 'مدرسة الشهيد اسطفانوس للشمامسة', ownerUid: user.uid, createdAt: serverTimestamp() });
    await setDoc(paths.ref(db, 'servants', user.uid), { ...profile(user), role: 'lead', levelIds: ['*'] } satisfies Servant);
    await sync.writeDiff(db, sync.emptyData(), local);
    await sync.publishViews(db, local, published.current);
  }, [user]);

  const acceptInvite = useCallback(async () => {
    const invite = access?.invite;
    if (!user || !invite) return;
    const [{ servantFb }, { setDoc, deleteDoc }, paths] = await Promise.all([import('../firebase/app'), import('firebase/firestore'), import('../firebase/paths')]);
    const { db } = servantFb();
    await setDoc(paths.ref(db, 'servants', user.uid), { ...profile(user), role: invite.role, levelIds: invite.levelIds } satisfies Servant);
    await deleteDoc(paths.ref(db, 'invites', invite.email)).catch(() => undefined);
  }, [user, access]);

  return (
    <Ctx.Provider value={{ data, update, reset, cloud: cloudEnabled, phase, user, servant, access, syncError, signIn, signOut, startChurch, acceptInvite }}>
      {children}
    </Ctx.Provider>
  );
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}

/** Only used inside the servant gate, where data has loaded. */
export function useData(): [AppData, Store['update']] {
  const { data, update } = useStore();
  return [data as AppData, update];
}

/** Levels this servant may run sessions for. Offline mode and leads see every level. */
export function useAllowedLevel() {
  const { servant } = useStore();
  return (levelId: string) => !servant || servant.levelIds.includes('*') || servant.levelIds.includes(levelId);
}
