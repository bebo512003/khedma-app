import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { deleteDoc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import type { Member } from '../data/types';
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
  const cred = await createUserWithEmailAndPassword(auth, memberEmail(member.code, n), memberPassword(pin));
  await signOut(auth);
  await setDoc(ref(db, 'accounts', cred.user.uid), { memberId: member.id });
  await setDoc(ref(db, 'logins', member.code), { n });
  if (member.account) await deleteDoc(ref(db, 'accounts', member.account.uid)).catch(() => undefined);
  return { uid: cred.user.uid, n };
}

export async function memberSignIn(code: string, pin: string): Promise<string | null> {
  const { auth, db } = memberFb();
  const login = await getDoc(ref(db, 'logins', code));
  const n = login.data()?.n as number | undefined;
  if (!n) return null;
  try {
    const cred = await signInWithEmailAndPassword(auth, memberEmail(code, n), memberPassword(pin));
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
