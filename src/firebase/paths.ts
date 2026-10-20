import { collection, doc, type Firestore } from 'firebase/firestore';
import { CHURCH_ID } from './config';

const root = `churches/${CHURCH_ID}`;
export const churchRef = (db: Firestore) => doc(db, root);
export const col = (db: Firestore, name: string) => collection(db, `${root}/${name}`);
export const ref = (db: Firestore, name: string, id: string) => doc(db, `${root}/${name}/${id}`);

/** Member logins are Firebase email/password accounts with a synthetic address; members only ever type code + PIN. */
/** `k` is a random part made with each PIN, so nobody can take the next login's address before the servant does. */
export const memberEmail = (code: string, n: number, k?: string) => `m${code}-${n}${k ? `-${k}` : ''}@${CHURCH_ID}.khedma.app`;
export const memberPassword = (pin: string) => `khedma-${pin}`;
