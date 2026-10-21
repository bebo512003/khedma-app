import { norm } from './importSheet';
import type { Member } from './types';

/** Names as we compare them: spelling, ڤ/ف and چ/ج, and the digits and dashes cameras and phones add. */
const key = (s: string) => norm(s).replace(/ڤ/g, 'ف').replace(/[چگ]/g, 'ج').replace(/[_\-.()[\]0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

/** The member a photo's file name is: the whole name, else the one member whose name holds all its words (or it all theirs). */
export function matchName(file: string, members: Member[]): Member | undefined {
  const f = key(file.replace(/\.[^.]+$/, ''));
  if (!f) return undefined;
  const exact = members.filter(m => key(m.name) === f);
  if (exact.length === 1) return exact[0];
  const words = f.split(' ');
  const hits = members.filter(m => {
    const n = key(m.name).split(' ');
    return words.every(w => n.includes(w)) || n.every(w => words.includes(w));
  });
  return hits.length === 1 ? hits[0] : undefined;
}
