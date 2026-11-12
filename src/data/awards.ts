import type { AppData, Award, Hymn, HymnStatus } from './types';
import { hymnPoints, todayISO, uid } from './logic';
import { partPointsOn } from './parts';

/** What a milestone is for, as sessions record it in milestones[m].keys: "hymn:m", or "hymn:part:s" for a part. */
export const milestoneKey = (hymnId: string, partId: string | undefined, kind: Award['kind']) => `${hymnId}${partId ? `:${partId}` : ''}:${kind}`;

/** Whether a session already gave this milestone (sessions saved before keys were kept: the session's hymn, whole). */
function inSession(d: AppData, memberId: string, hymnId: string, partId: string | undefined, kind: Award['kind']) {
  const key = milestoneKey(hymnId, partId, kind);
  return d.sessions.some(s => {
    const ms = s.milestones?.[memberId];
    if (!ms) return false;
    if (ms.keys) return ms.keys.includes(key);
    return !partId && !s.partId && s.hymnIds[0] === hymnId && (kind === 'm' ? ms.memorized : ms.solo) > 0;
  });
}

/**
 * A servant moved a member's status outside a session (a live recitation from the profile, or a reply to one sent
 * from home): reaching حافظه / بيقوله لوحده gives the points once, and moving back down takes them away. A split
 * hymn's part gives its own points when the lead set some, and the whole hymn gives the hymn's when all parts get there.
 */
export function withAward(d: AppData, memberId: string, hymn: Hymn | undefined, before: HymnStatus, after: HymnStatus, via: Award['via'],
  part?: { id: string; before: HymnStatus; after: HymnStatus }): AppData {
  const m = d.members.find(x => x.id === memberId);
  if (!m || !hymn) return d;
  let awards = [...(m.awards ?? [])];
  const apply = (partId: string | undefined, b: HymnStatus, a: HymnStatus, pts: { memorized: number; solo: number }) => {
    if (a === b) return;
    awards = awards.filter(x => x.hymnId !== hymn.id || (x.partId ?? undefined) !== partId || (x.kind === 'm' ? a >= 2 : a >= 3));
    const has = (k: Award['kind']) => awards.some(x => x.hymnId === hymn.id && x.partId === partId && x.kind === k);
    const give = (kind: Award['kind'], p: number) => {
      if (p > 0 && !has(kind) && !inSession(d, memberId, hymn.id, partId, kind))
        awards.push({ id: uid(), date: todayISO(), hymnId: hymn.id, ...(partId ? { partId } : {}), kind, pts: p, via });
    };
    if (b < 2 && a >= 2) give('m', pts.memorized);
    if (b < 3 && a === 3) give('s', pts.solo);
  };
  if (part) {
    const p = hymn.parts?.find(x => x.id === part.id);
    if (p) apply(p.id, part.before, part.after, partPointsOn(p, todayISO()));
  }
  apply(undefined, before, after, hymnPoints(hymn));
  const same = JSON.stringify(awards) === JSON.stringify(m.awards ?? []);
  return same ? d : { ...d, members: d.members.map(x => x.id === memberId ? { ...x, awards: awards.length ? awards : undefined } : x) };
}
