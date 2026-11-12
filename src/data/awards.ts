import type { AppData, Award, Hymn, HymnStatus } from './types';
import { hymnPoints, todayISO, uid } from './logic';

/**
 * A servant moved a member's hymn status outside a session (a live recitation from the profile, or a reply to one
 * sent from home): reaching حافظه / بيقوله لوحده gives the hymn's points once, and moving back down takes them away.
 * A milestone a session already gave for the hymn isn't given twice.
 */
export function withAward(d: AppData, memberId: string, hymn: Hymn | undefined, before: HymnStatus, after: HymnStatus, via: Award['via']): AppData {
  const m = d.members.find(x => x.id === memberId);
  if (!m || !hymn || before === after) return d;
  let awards = (m.awards ?? []).filter(a => a.hymnId !== hymn.id || (a.kind === 'm' ? after >= 2 : after >= 3));
  const inSession = (k: 'memorized' | 'solo') => d.sessions.some(s => s.hymnIds[0] === hymn.id && (s.milestones?.[memberId]?.[k] ?? 0) > 0);
  const has = (k: Award['kind']) => awards.some(a => a.hymnId === hymn.id && a.kind === k);
  const hp = hymnPoints(hymn);
  const give = (kind: Award['kind'], pts: number) => { awards = [...awards, { id: uid(), date: todayISO(), hymnId: hymn.id, kind, pts, via }]; };
  if (before < 2 && after >= 2 && !has('m') && !inSession('memorized')) give('m', hp.memorized);
  if (before < 3 && after === 3 && !has('s') && !inSession('solo')) give('s', hp.solo);
  const same = JSON.stringify(awards) === JSON.stringify(m.awards ?? []);
  return same ? d : { ...d, members: d.members.map(x => x.id === memberId ? { ...x, awards: awards.length ? awards : undefined } : x) };
}
