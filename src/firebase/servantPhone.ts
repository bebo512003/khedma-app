import {
  EmailAuthProvider, RecaptchaVerifier, linkWithCredential, signInWithEmailAndPassword, signInWithPhoneNumber, updatePassword,
  type ConfirmationResult,
} from 'firebase/auth';
import { servantFb } from './app';
import { CHURCH_ID } from './config';

/**
 * Servants without Google: one SMS proves the number the first time (and when they forget their password),
 * then they sign in with number + password. Both sign-ins are the same Firebase user, so the number stays on it.
 */

/** 01012345678 → +201012345678; null if it isn't an Egyptian mobile. */
export function toE164(raw: string) {
  const d = raw.replace(/\D/g, '');
  if (/^01[0125]\d{8}$/.test(d)) return `+2${d}`;
  if (/^201[0125]\d{8}$/.test(d)) return `+${d}`;
  return null;
}
export const localPhone = (e164: string) => e164.replace(/^\+2/, '');

const passwordEmail = (e164: string) => `s${e164.replace(/\D/g, '')}@${CHURCH_ID}.khedma.app`;

let verifier: RecaptchaVerifier | null = null;

/** Sends the SMS. `button` is the element the invisible reCAPTCHA hangs on. */
export function sendCode(e164: string, button: HTMLElement): Promise<ConfirmationResult> {
  const { auth } = servantFb();
  auth.languageCode = 'ar';
  verifier?.clear();
  verifier = new RecaptchaVerifier(auth, button, { size: 'invisible' });
  return signInWithPhoneNumber(auth, e164, verifier);
}

/** Checks the SMS code and sets the password they'll use from now on. */
export async function confirmCode(c: ConfirmationResult, code: string, e164: string, password: string) {
  const { user } = await c.confirm(code);
  try { await linkWithCredential(user, EmailAuthProvider.credential(passwordEmail(e164), password)); }
  catch (e) {
    const k = (e as { code?: string }).code ?? '';
    // Already has a password (they forgot it and came back by SMS): this one replaces it.
    if (k.includes('provider-already-linked') || k.includes('email-already-in-use') || k.includes('credential-already-in-use')) await updatePassword(user, password);
    else throw e;
  }
}

export const passwordSignIn = (e164: string, password: string) => signInWithEmailAndPassword(servantFb().auth, passwordEmail(e164), password);
