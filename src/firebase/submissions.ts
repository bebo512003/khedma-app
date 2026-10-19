import { collection, doc, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { memberFb, servantFb } from './app';
import { col } from './paths';
import { CHURCH_ID } from './config';
import { saveRecording } from './recordings';
import type { HymnStatus, Submission } from '../data/types';

const subs = (db: ReturnType<typeof memberFb>['db']) => collection(db, `churches/${CHURCH_ID}/submissions`);
const rand = () => Math.random().toString(36).slice(2, 10);

/** Member: sends a recording of a hymn. Audio pieces are named after the member so the rules can check who sent them. */
export async function sendSubmission(s: Omit<Submission, 'id' | 'recording' | 'at' | 'pending'>, blob: Blob, ms: number) {
  const recId = `sub_${s.memberId}_${rand()}`;
  const parts = await saveRecording(recId, blob, memberFb().db);
  const id = `${s.memberId}_${Date.now()}`;
  const sub: Submission = { ...s, id, recording: { id: recId, mime: blob.type || 'audio/webm', ms, parts }, at: Date.now(), pending: true };
  await setDoc(doc(subs(memberFb().db), id), sub);
  return sub;
}

/** Member: their own submissions, newest first. */
export function watchMySubmissions(memberId: string, cb: (s: Submission[]) => void) {
  return onSnapshot(query(subs(memberFb().db), where('memberId', '==', memberId)),
    q => cb(q.docs.map(d => d.data() as Submission).sort((a, b) => b.at - a.at)), () => cb([]));
}

/** Servant: submissions waiting for a listen. */
export function watchPending(cb: (s: Submission[]) => void) {
  return onSnapshot(query(col(servantFb().db, 'submissions'), where('pending', '==', true)),
    q => cb(q.docs.map(d => d.data() as Submission).sort((a, b) => a.at - b.at)), () => cb([]));
}

/** Servant: their verdict and note, which the member sees on the hymn page. */
export function reviewSubmission(id: string, review: { status: HymnStatus; note?: string; by: string; byName: string }) {
  return updateDoc(doc(col(servantFb().db, 'submissions'), id), { pending: false, review: JSON.parse(JSON.stringify(review)), reviewAt: Date.now() });
}
