import type { MemberView } from '../data/memberView';
import { STATUS_LABELS, type Submission } from '../data/types';

/** One line in the member's notifications list. */
export type Note = { key: string; at: number; kind: 'review' | 'summary' | 'note'; title: string; body?: string; by?: string; to: string };

const MONTH = 30 * 86_400_000;
const recs = (n: number) => n === 0 ? '' : n === 1 ? ' مع تسجيل' : n === 2 ? ' مع تسجيلين' : ` مع ${n} تسجيلات`;
const dayAt = (date: string) => new Date(`${date}T20:00`).getTime();

/** What the member hears about: a servant's reply on a recitation, a session's summary or voice notes, and a servant's note on their rating. */
export function buildNotes(v: MemberView, subs: Submission[], now = Date.now()): Note[] {
  const notes: Note[] = [];
  for (const s of subs) if (s.review && s.reviewAt) notes.push({
    key: `r_${s.id}`, at: s.reviewAt, kind: 'review', by: s.review.byName,
    title: `${s.review.byName} سمع تسميعك لـ«${s.hymnName}»: ${STATUS_LABELS[s.review.status]}`, body: s.review.note, to: `/me/hymn/${s.hymnId}`,
  });
  for (const s of v.sessions ?? []) if (s.summary || s.recordings?.length) notes.push({
    key: `s_${s.id}_${s.summaryAt ?? 0}`, at: s.summaryAt ?? dayAt(s.date), kind: 'summary',
    title: `ملخص حصة${s.hymn ? ` «${s.hymn}»` : ''} نزل${recs(s.recordings?.length ?? 0)}`,
    body: s.summary, to: '/me/sessions',
  });
  for (const r of v.ratings) if (r.note) notes.push({ key: `n_${r.id}`, at: dayAt(r.date), kind: 'note', title: 'الخادم كتبلك ملاحظة على الحصة', body: r.note, to: '/me/ratings' });
  return notes.filter(n => now - n.at < MONTH).sort((a, b) => b.at - a.at);
}

const seenKey = (memberId: string) => `notesSeen:${memberId}`;
export function loadSeen(memberId: string) {
  try { return Number(localStorage.getItem(seenKey(memberId))) || 0; } catch { return 0; }
}
export function saveSeen(memberId: string, at: number) {
  try { localStorage.setItem(seenKey(memberId), String(at)); } catch { /* private mode: the counter just resets */ }
}
