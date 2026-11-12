import type { AppData, Hymn, HymnPart, HymnStatus, Session } from './types';
import { todayISO } from './logic';

/**
 * A long hymn (السبع طرائق…) can be taught over several sessions: each part has its own status and recitations,
 * kept in progress under `${hymnId}:${partId}`. The hymn's own status follows its parts and never goes down.
 */
export const partKey = (hymnId: string, partId: string) => `${hymnId}:${partId}`;
export const splitKey = (key: string) => { const i = key.indexOf(':'); return i < 0 ? { hymnId: key } : { hymnId: key.slice(0, i), partId: key.slice(i + 1) }; };

export const partOf = (h: Hymn | undefined, partId?: string) => partId ? h?.parts?.find(p => p.id === partId) : undefined;

/** The hymn's status from its parts' ones: all parts at a level → that level; any part started → بيتعلمه. */
export function wholeStatus(h: Hymn, prog: Record<string, HymnStatus> | undefined, old: HymnStatus = 0): HymnStatus {
  const parts = h.parts ?? [];
  if (!parts.length) return old;
  const st = parts.map(p => prog?.[partKey(h.id, p.id)] ?? 0);
  const min = Math.min(...st);
  const derived = (min > 0 ? min : st.some(s => s > 0) ? 1 : 0) as HymnStatus;
  return Math.max(old, derived) as HymnStatus;
}

/** Sets one part's status and brings the hymn's status along. */
export function withPartStatus(h: Hymn, prog: Record<string, HymnStatus> | undefined, partId: string, s: HymnStatus) {
  const next = { ...(prog ?? {}), [partKey(h.id, partId)]: s };
  next[h.id] = wholeStatus(h, next, prog?.[h.id] ?? 0);
  return next;
}

/** A part with a month gives its points only when reached within that month, so months don't mix. */
export const partPointsOn = (p: HymnPart | undefined, date: string) =>
  !p || (p.month && date.slice(0, 7) !== p.month) ? { memorized: 0, solo: 0 } : { memorized: p.points?.memorized ?? 0, solo: p.points?.solo ?? 0 };

/** "اسم اللحن (الجزء)" for a session or a recitation. */
export const hymnLabel = (h: Hymn | undefined, partId?: string, fallback = '') => {
  const p = partOf(h, partId);
  return h ? (p ? `${h.nameAr} (${p.name})` : h.nameAr) : fallback;
};
export const sessionHymnLabel = (data: AppData, s: Session) => hymnLabel(data.hymns.find(h => h.id === s.hymnIds[0]), s.partId) || undefined;

/** The part the next session of this level probably takes: the one after the last session's part on this hymn. */
export function nextPart(data: AppData, levelId: string, h: Hymn | undefined, date = todayISO()): string | undefined {
  const parts = h?.parts ?? [];
  if (!h || !parts.length) return undefined;
  // Parts given a month: this month's own (the first of them, past the ones sessions already took).
  const mine = parts.filter(p => p.month === date.slice(0, 7));
  if (mine.length) {
    const taken = new Set(data.sessions.filter(s => s.levelId === levelId && s.hymnIds[0] === h.id).map(s => s.partId));
    return (mine.find(p => !taken.has(p.id)) ?? mine[mine.length - 1]).id;
  }
  const last = data.sessions.filter(s => s.levelId === levelId && s.hymnIds[0] === h.id && s.partId)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.savedAt ?? 0) - (a.savedAt ?? 0))[0];
  const i = last ? parts.findIndex(p => p.id === last.partId) : -1;
  return parts[Math.min(parts.length - 1, i + 1)].id;
}

/** Non-empty text lines (as the hymn text shows them), counted over the longest column. */
const lines = (s?: string) => (s ?? '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
export const textRows = (h: Hymn) => Math.max(0, ...[h.copticText, h.arabicCoptic, h.meaning].map(t => lines(t).length));
const sectionAt = (h: Hymn, i: number) => [h.copticText, h.arabicCoptic, h.meaning].map(t => lines(t)[i]).find(l => l?.startsWith('§'))?.slice(1).trim();

const rid = () => Math.random().toString(36).slice(2, 8);
const ORD = ['الأول', 'التاني', 'التالت', 'الرابع', 'الخامس', 'السادس', 'السابع', 'التامن', 'التاسع', 'العاشر'];
export const partName = (i: number) => `الجزء ${ORD[i] ?? i + 1}`;

/** One part per § title in the text (with the lines under it). */
export function splitBySections(h: Hymn): HymnPart[] {
  const n = textRows(h), out: HymnPart[] = [];
  for (let i = 0; i < n; i++) {
    const t = sectionAt(h, i);
    if (t === undefined) continue;
    if (out.length) out[out.length - 1].to = i;
    out.push({ id: rid(), name: t || partName(out.length), from: i + 1 });
  }
  if (out.length) out[out.length - 1].to = n;
  return out;
}

/** n parts with about the same number of lines each (or just names when there's no text). */
export function splitEven(h: Hymn, n: number): HymnPart[] {
  const rows = textRows(h);
  return Array.from({ length: n }, (_, i) => ({
    id: rid(), name: partName(i),
    ...(rows >= n ? { from: Math.floor(i * rows / n) + 1, to: Math.floor((i + 1) * rows / n) } : {}),
  }));
}
