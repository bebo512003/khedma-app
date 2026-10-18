import { deleteDoc, getDoc, setDoc } from 'firebase/firestore';
import { del, get, set } from 'idb-keyval';
import { cloudEnabled } from './config';
import { memberFb, servantFb } from './app';
import { ref } from './paths';

/**
 * Pages of uploaded PDFs, one image per document (well under Firestore's 1 MB limit).
 * They're read one at a time when opened, never synced as a whole, and Firestore's cache keeps them offline.
 */
export const pageKey = (bookId: string, n: number) => `${bookId}-${String(n).padStart(2, '0')}`;

/** Whoever is signed in on this device: a servant, or a member viewing their hymns. */
const db = () => (servantFb().auth.currentUser || !memberFb().auth.currentUser ? servantFb() : memberFb()).db;

export async function savePage(bookId: string, n: number, img: string) {
  if (cloudEnabled) await setDoc(ref(db(), 'bookPages', pageKey(bookId, n)), { img });
  else await set(`bookPage:${pageKey(bookId, n)}`, img);
}

export async function loadPage(key: string): Promise<string | undefined> {
  if (!cloudEnabled) return get(`bookPage:${key}`);
  const snap = await getDoc(ref(db(), 'bookPages', key));
  return snap.data()?.img as string | undefined;
}

/** Deletes pages from..to (all of them when only the count is given). */
export async function deletePages(bookId: string, to: number, from = 1) {
  for (let n = from; n <= to; n++) {
    if (cloudEnabled) await deleteDoc(ref(db(), 'bookPages', pageKey(bookId, n))).catch(() => undefined);
    else await del(`bookPage:${pageKey(bookId, n)}`);
  }
}
