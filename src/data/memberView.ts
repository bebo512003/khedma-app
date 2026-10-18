import type { AppData, Hymn, HymnStatus, MemberEdit, Rating } from './types';
import { currentTerm, curriculumKey, monthBreakdown, ranking, sessionAverage, todayISO } from './logic';
import { bookOf, entryPages, pagesLabel } from './books';

/**
 * Everything the member app shows, computed by a servant's device and published per member.
 * Members never read other members' records or sessions; they read only their own view.
 */
export interface MemberView {
  memberId: string;
  name: string;
  photo?: string;
  rank?: string;
  /** The member's own details, which they can edit from the member app. */
  profile?: MemberEdit;
  levelName: string;
  termName?: string;
  month: string;
  points: number;
  place: number;
  gap: number;
  breakdown: ReturnType<typeof monthBreakdown>;
  top: { id: string; name: string; photo?: string; points: number; place: number }[];
  hymns: (Hymn & { status: HymnStatus; levels: string[]; book?: { title: string; label: string; pages: string[] } })[];
  ratings: { id: string; date: string; r: Rating; avg: number; memorized: number; solo: number; note?: string }[];
  attendanceRate: number | null;
}

const clean = <T extends object>(o: T) => JSON.parse(JSON.stringify(o)) as T;

export function buildMemberView(data: AppData, memberId: string, month = todayISO().slice(0, 7)): MemberView | null {
  const m = data.members.find(x => x.id === memberId);
  if (!m) return null;
  const level = data.levels.find(l => l.id === m.levelId);
  const term = currentTerm(data);
  const rows = ranking(data, m.levelId, month);
  const pos = rows.findIndex(r => r.member.id === m.id);
  const breakdown = monthBreakdown(data, m.id, month);
  const top = rows.slice(0, 3).map((r, i) => ({ id: r.member.id, name: r.member.name, photo: r.member.photo, points: r.points, place: i + 1 }));
  const hymns = (data.curricula[curriculumKey(term?.id, m.levelId)] ?? [])
    .map(id => data.hymns.find(h => h.id === id))
    .filter((h): h is Hymn => !!h)
    .map(h => ({
      ...h,
      book: (b => b && { title: b.book.title, label: pagesLabel(b.entry), pages: entryPages(b.book, b.entry) })(bookOf(data, h.id, term?.id)),
      status: (data.progress[m.id]?.[h.id] ?? 0) as HymnStatus,
      levels: data.levels.filter(l => (data.curricula[curriculumKey(term?.id, l.id)] ?? []).includes(h.id)).map(l => l.name),
    }));
  const ratings = data.sessions
    .filter(s => s.ratings[m.id] && (!term || (s.date >= term.start && s.date <= term.end)))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(s => ({ id: s.id, date: s.date, r: s.ratings[m.id], avg: sessionAverage(s, m.id)!, memorized: s.milestones?.[m.id]?.memorized ?? 0, solo: s.milestones?.[m.id]?.solo ?? 0, note: s.notes?.[m.id] }));
  const mine = data.sessions.filter(s => s.attendance[m.id] !== undefined);
  return clean({
    memberId: m.id, name: m.name, photo: m.photo, rank: m.rank,
    profile: { name: m.name, photo: m.photo, birthdate: m.birthdate, phone: m.phone, parentPhone: m.parentPhone }, levelName: level?.name ?? '', termName: term?.name, month,
    points: breakdown.total, place: pos + 1, gap: Math.max(0, (rows[0]?.points ?? 0) - breakdown.total), breakdown, top, hymns, ratings,
    attendanceRate: mine.length ? Math.round(100 * mine.filter(s => s.attendance[m.id] === 'p').length / mine.length) : null,
  });
}
