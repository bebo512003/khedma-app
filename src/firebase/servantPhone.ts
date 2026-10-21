import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updatePassword } from 'firebase/auth';
import { getDoc, setDoc } from 'firebase/firestore';
import { provisionFb, servantFb } from './app';
import { CHURCH_ID } from './config';
import { ref } from './paths';

/**
 * Servants without Google sign in with their mobile and a password. The admin makes the login (no SMS), so a number
 * can't be claimed by someone else. A browser can't change another person's password, so a reset makes a fresh
 * login (n + 1) and servantLogins/{number} says which one is current, like members' logins.
 */

/** Egyptian mobile as 11 digits (01012345678), or null. */
export function localPhone(raw: string) {
  const d = raw.replace(/\D/g, '').replace(/^20(?=1)/, '');
  return /^01[0125]\d{8}$/.test(d) ? d : null;
}

const loginEmail = (phone: string, n: number) => `s${phone}-${n}@${CHURCH_ID}.khedma.app`;

/** A random 8-digit first password the admin hands over; the servant can change it from their profile. */
export const newPassword = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 100000000).padStart(8, '0');

/** Makes the login and returns its uid; the admin then writes the servant record for it. */
export async function createServantLogin(phone: string, password: string, previous = 0) {
  const { auth } = provisionFb();
  let n = previous + 1;
  // Someone else made that login first (it would have no servant record): skip past it.
  const make = (): ReturnType<typeof createUserWithEmailAndPassword> => createUserWithEmailAndPassword(auth, loginEmail(phone, n), password).catch(e => {
    if (String((e as { code?: string }).code).includes('email-already-in-use') && n < previous + 5) { n++; return make(); }
    throw e;
  });
  const cred = await make();
  await signOut(auth);
  await setDoc(ref(servantFb().db, 'servantLogins', phone), { n });
  return { uid: cred.user.uid, n };
}

export async function passwordSignIn(phone: string, password: string) {
  const { auth, db } = servantFb();
  const n = (await getDoc(ref(db, 'servantLogins', phone))).get('n') as number | undefined;
  if (!n) throw Object.assign(new Error('no login'), { code: 'auth/user-not-found' });
  await signInWithEmailAndPassword(auth, loginEmail(phone, n), password);
}

/** A phone servant's own password change. */
export function changePassword(password: string) {
  const u = servantFb().auth.currentUser;
  if (!u) throw new Error('signed out');
  return updatePassword(u, password);
}

export const isPhoneLogin = (email?: string | null) => !!email && /^s\d+-\d+@/.test(email);
