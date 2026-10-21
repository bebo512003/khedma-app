import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { unifyCoptic } from './unicodeCoptic';
import { get, set } from 'idb-keyval';
import type { User } from 'firebase/auth';
import { applyMemberEdit, type AppData, type Invite, type MemberEdit, type Perm, type Servant } from './types';
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
  /** The levels this servant serves; their app publishes and applies only those members' views and edits. */
  const levels = useRef<(levelId: string) => boolean>(() => true);
  levels.current = (levelId: string) => servesLevel(servant, levelId);

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
            const sv = snap.data() as Servant;
            setServant(sv);
            // The church's founder becomes its admin (they were "lead" before admins existed).
            if (sv.role !== 'admin') getDoc(paths.churchRef(db)).then(c => {
              if (c.get('ownerUid') === u.uid) import('firebase/firestore').then(({ updateDoc }) => updateDoc(paths.ref(db, 'servants', u.uid), { role: 'admin' }));
            }).catch(() => undefined);
            setPhase('ready');
            if (!subscribed) {
              subscribed = true;
              const stopLists = sync.subscribe(db, d => { latest.current = d; setData(d); }, e => setSyncError(e.message));
              const stopEdits = onSnapshot(paths.col(db, 'memberEdits'), q => setEdits(q.docs.map(x => ({ id: x.id, edit: x.data() as MemberEdit }))), () => undefined);
              stopData = () => { stopLists(); stopEdits(); };
            }
            return;
          }
          const email = identity(u);
          const [church, invite] = await Promise.all([
            getDoc(paths.churchRef(db)).catch(() => null),
            getDoc(paths.ref(db, 'invites', email)).catch(() => null),
          ]);
          // A read that failed counts as "the church exists": only its real absence offers to start it.
          setAccess({ churchExists: church === null || church.exists(), invite: invite?.exists() ? (invite.data() as Invite) : null });
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
      sync.publishViews(db, next, published.current, levels.current).catch(e => setSyncError(String(e.message ?? e)));
    });
  }, []);

  // A member changed their photo or details from the member app: copy it into their record, then clear it.
  useEffect(() => {
    if (!data || !edits.length || !canDo(servant, 'members')) return;
    // Only edits of members in this servant's levels: another level's servant applies theirs.
    const mine = edits.filter(e => { const m = data.members.find(x => x.id === e.id); return !m || servesLevel(servant, m.levelId); });
    if (!mine.length) return;
    const known = mine.filter(e => data.members.some(m => m.id === e.id));
    // A malformed edit is dropped rather than applied, and is cleared either way so it can't block the app.
    if (known.length) update(d => ({ ...d, members: d.members.map(m => { const e = known.find(x => x.id === m.id); try { return e ? applyMemberEdit(m, e.edit) : m; } catch { return m; } }) }));
    Promise.all([import('../firebase/app'), import('firebase/firestore'), import('../firebase/paths')]).then(([{ servantFb }, { deleteDoc }, paths]) =>
      mine.forEach(e => deleteDoc(paths.ref(servantFb().db, 'memberEdits', e.id)).catch(() => undefined)));
  }, [data, edits, update, servant]);

  // Hymns saved before Coptic was unified (old fonts, Greek letters, backtick jinkim): store them as Unicode once.
  useEffect(() => {
    if (!data || !canDo(servant, 'curriculum')) return;
    if (!data.hymns.some(h => h.copticText && unifyCoptic(h.copticText, true) !== h.copticText)) return;
    update(d => ({ ...d, hymns: d.hymns.map(h => h.copticText ? { ...h, copticText: unifyCoptic(h.copticText, true) } : h) }));
  }, [data, update, servant]);

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
    const [{ servantFb }, auth, fs] = await Promise.all([import('../firebase/app'), import('firebase/auth'), import('firebase/firestore')]);
    await auth.signOut(servantFb().auth);
    // Members' phones and addresses don't stay on a phone someone else may use next.
    // (Another open tab of the app keeps the copy; it clears on the next sign-out.)
    await fs.terminate(servantFb().db).then(() => fs.clearIndexedDbPersistence(servantFb().db)).catch(() => undefined);
    location.reload();
  }, []);

  const profile = (u: User) => ({ uid: u.uid, name: u.displayName ?? u.email ?? '', email: identity(u) });

  /** First servant: creates the church, becomes its lead, and uploads what was entered on this device. */
  const startChurch = useCallback(async () => {
    if (!user) return;
    const [{ servantFb }, { setDoc, serverTimestamp }, paths, sync] = await Promise.all([
      import('../firebase/app'), import('firebase/firestore'), import('../firebase/paths'), import('../firebase/sync'),
    ]);
    const { db } = servantFb();
    const local = await loadLocal();
    await setDoc(paths.churchRef(db), { name: 'مدرسة الشهيد اسطفانوس للشمامسة', ownerUid: user.uid, createdAt: serverTimestamp() });
    await setDoc(paths.ref(db, 'servants', user.uid), { ...profile(user), role: 'admin', levelIds: ['*'] } satisfies Servant);
    await sync.writeDiff(db, sync.emptyData(), local);
    await sync.publishViews(db, local, published.current);
  }, [user]);

  const acceptInvite = useCallback(async () => {
    const invite = access?.invite;
    if (!user || !invite) return;
    const [{ servantFb }, { setDoc, deleteDoc }, paths] = await Promise.all([import('../firebase/app'), import('firebase/firestore'), import('../firebase/paths')]);
    const { db } = servantFb();
    await setDoc(paths.ref(db, 'servants', user.uid), { ...profile(user), role: invite.role, levelIds: invite.levelIds, ...(invite.perms ? { perms: invite.perms } : {}) } satisfies Servant);
    await deleteDoc(paths.ref(db, 'invites', invite.email)).catch(() => undefined);
  }, [user, access]);

  return (
    <Ctx.Provider value={{ data, update, reset, cloud: cloudEnabled, phase, user, servant, access, syncError, signIn, signOut, startChurch, acceptInvite }}>
      {children}
    </Ctx.Provider>
  );
}

/** How a servant is invited: their Google email. */
const identity = (u: User) => (u.email ?? '').toLowerCase();

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

/** Lead servant or admin, or offline mode (one device, no roles). Only they change levels and terms or delete members. */
export function useIsLead() {
  const { servant, cloud } = useStore();
  return !cloud || servant?.role === 'lead' || servant?.role === 'admin';
}

/** Admin, or offline mode: runs the team and its permissions. */
export function useIsAdmin() {
  const { servant, cloud } = useStore();
  return !cloud || servant?.role === 'admin';
}

/** Mirrors can() in firestore.rules. */
export function canDo(servant: Servant | null, p: Perm) {
  return !servant || servant.role !== 'servant' || !servant.perms || servant.perms.includes(p);
}
export function useCan(p: Perm) {
  const { servant, cloud } = useStore();
  return !cloud || canDo(servant, p);
}

const servesLevel = (servant: Servant | null, levelId: string) => !servant || servant.levelIds.includes('*') || servant.levelIds.includes(levelId);

/** Levels this servant serves: they run sessions and change members only there. Offline mode sees every level. */
export function useAllowedLevel() {
  const { servant } = useStore();
  return (levelId: string) => servesLevel(servant, levelId);
}
