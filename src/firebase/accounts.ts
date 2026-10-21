import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { deleteDoc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import type { Member, MemberEdit } from '../data/types';
import type { MemberView } from '../data/memberView';
import { memberFb, provisionFb, servantFb } from './app';
import { memberEmail, memberPassword, ref } from './paths';

/**
 * Gives a member a login for the given PIN. A servant can't change someone else's password from the browser,
 * so each PIN reset creates a fresh account (n + 1) and retires the old one by removing its link to the member.
 * Needs a connection.
 */
export async function createMemberLogin(member: Member, pin: string): Promise<Member['account']> {
  const { db } = servantFb();
  const { auth } = provisionFb();
  const n = (member.account?.n ?? 0) + 1;
  const k = [...crypto.getRandomValues(new Uint8Array(6))].map(b => b.toString(16).padStart(2, '0')).join('');
  const cred = await createUserWithEmailAndPassword(auth, memberEmail(member.code, n, k), memberPassword(pin));
  await signOut(auth);
  await setDoc(ref(db, 'accounts', cred.user.uid), { memberId: member.id });
  await setDoc(ref(db, 'logins', member.code), { n, k });
  if (member.account) await deleteDoc(ref(db, 'accounts', member.account.uid)).catch(() => undefined);
  return { uid: cred.user.uid, n };
}

/**
 * Codes changed: each member's login moves to the new code and keeps their PIN.
 * All old entries are read and removed before the new ones are written, since one member's new code can be another's old one.
 */
export async function moveLogins(moves: { from: string; to: string }[]) {
  const { db } = servantFb();
  const old = await Promise.all(moves.map(m => getDoc(ref(db, 'logins', m.from)).then(s => s.data())));
  await Promise.all(moves.map(m => deleteDoc(ref(db, 'logins', m.from)).catch(() => undefined)));
  await Promise.all(moves.map((m, i) => {
    const l = old[i];
    return l?.n ? setDoc(ref(db, 'logins', m.to), { n: l.n, ...(l.k ? { k: l.k } : {}), c: l.c ?? m.from }) : undefined;
  }));
  return old.filter(l => !l?.n).length;
}

/** Logins that can't be told apart (two members on one code) are retired; those members get a new PIN. */
export const retireAccounts = (uids: string[]) =>
  Promise.all(uids.map(u => deleteDoc(ref(servantFb().db, 'accounts', u)).catch(() => undefined)));

export async function memberSignIn(code: string, pin: string): Promise<string | null> {
  const { auth, db } = memberFb();
  const login = await getDoc(ref(db, 'logins', code));
  const n = login.data()?.n as number | undefined;
  const k = login.data()?.k as string | undefined;
  // After the codes were renumbered the login still carries the code it was made with.
  const made = (login.data()?.c as string | undefined) ?? code;
  if (!n) return null;
  try {
    const cred = await signInWithEmailAndPassword(auth, memberEmail(made, n, k), memberPassword(pin));
    const acc = await getDoc(ref(db, 'accounts', cred.user.uid));
    const memberId = acc.data()?.memberId as string | undefined;
    if (!memberId) { await signOut(auth); return null; }
    return memberId;
  } catch (e) {
    const c = (e as { code?: string }).code ?? '';
    if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found')) return null;
    throw e;
  }
}

export const memberSignOut = () => signOut(memberFb().auth);

export function watchMemberView(memberId: string, cb: (v: MemberView | null) => void, onError: (e: Error) => void) {
  return onSnapshot(ref(memberFb().db, 'memberViews', memberId), s => cb((s.data() as MemberView) ?? null), onError);
}

/**
 * A member's edit of their own photo and details. Members can't write the member records,
 * so the edit waits in memberEdits until a servant's app applies it (see store.tsx).
 */
export function submitMemberEdit(memberId: string, edit: MemberEdit) {
  return setDoc(ref(memberFb().db, 'memberEdits', memberId), { ...JSON.parse(JSON.stringify(edit)), at: Date.now() });
}

export function watchMemberEdit(memberId: string, cb: (e: MemberEdit | null) => void) {
  return onSnapshot(ref(memberFb().db, 'memberEdits', memberId), s => cb((s.data() as MemberEdit) ?? null), () => cb(null));
}
