import { Bytes, deleteDoc, getDoc, setDoc } from 'firebase/firestore';
import { del, get, set } from 'idb-keyval';
import { cloudEnabled } from './config';
import { memberFb, servantFb } from './app';
import { ref } from './paths';
import type { Recording } from '../data/types';

/**
 * Voice summaries live in Firestore (the free plan has no file storage), split into pieces
 * under the 1 MB document limit. A few minutes of speech at the recorder's low bitrate is one or two pieces.
 */
const PART = 700_000;
const key = (id: string, i: number) => `${id}-${i}`;
const db = () => (servantFb().auth.currentUser || !memberFb().auth.currentUser ? servantFb() : memberFb()).db;

export async function saveRecording(id: string, blob: Blob): Promise<number> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const parts = Math.max(1, Math.ceil(bytes.length / PART));
  for (let i = 0; i < parts; i++) {
    const piece = bytes.slice(i * PART, (i + 1) * PART);
    if (cloudEnabled) await setDoc(ref(db(), 'recordings', key(id, i)), { data: Bytes.fromUint8Array(piece), i, parts, mime: blob.type });
    else await set(`rec:${key(id, i)}`, piece);
  }
  return parts;
}

const loaded = new Map<string, Promise<Blob>>();
export function loadRecording(r: Recording): Promise<Blob> {
  if (!loaded.has(r.id)) {
    const p = (async () => {
      const pieces: Uint8Array[] = [];
      for (let i = 0; i < r.parts; i++) {
        if (cloudEnabled) {
          const snap = await getDoc(ref(db(), 'recordings', key(r.id, i)));
          const data = snap.get('data') as Bytes | undefined;
          if (!data) throw new Error('missing part');
          pieces.push(data.toUint8Array());
        } else {
          const piece = await get<Uint8Array>(`rec:${key(r.id, i)}`);
          if (!piece) throw new Error('missing part');
          pieces.push(piece);
        }
      }
      return new Blob(pieces as BlobPart[], { type: r.mime });
    })();
    p.catch(() => loaded.delete(r.id));
    loaded.set(r.id, p);
  }
  return loaded.get(r.id)!;
}

export async function deleteRecording(r: Recording) {
  loaded.delete(r.id);
  for (let i = 0; i < r.parts; i++) {
    if (cloudEnabled) await deleteDoc(ref(db(), 'recordings', key(r.id, i))).catch(() => undefined);
    else await del(`rec:${key(r.id, i)}`);
  }
}
