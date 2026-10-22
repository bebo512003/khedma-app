import type { Attendance, AppData, Hymn, HymnStatus, MemberEdit, Rating, Recording } from './types';
import { currentTerm, curriculumKey, lateBy, sessionRecordings, monthBreakdown, ranking, sessionAverage, todayISO, titled } from './logic';
import { bookOf, entryPages, hasPages, pageUrl, pagesLabel } from './books';

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
  levelId?: string;
  termName?: string;
  month: string;
  points: number;
  place: number;
  gap: number;
  breakdown: ReturnType<typeof monthBreakdown>;
  top: { id: string; name: string; photo?: string; points: number; place: number }[];
  hymns: (Hymn & { status: HymnStatus; levels: string[]; book?: { title: string; label: string; pages: string[] }; recordings?: (Recording & { date: string })[] })[];
  ratings: { id: string; date: string; r: Rating; avg: number; memorized: number; solo: number; note?: string }[];
  attendanceRate: number | null;
  /** The level's recent sessions: what was covered, the voice summary, and whether this member came. */
  sessions?: { id: string; date: string; hymn?: string; summary?: string; summaryAt?: number; recordings?: Recording[]; att?: Attendance; arrived?: number; late?: number }[];
  /** The level's booklets, newest term first. */
  books?: { id: string; title: string; term?: string; current: boolean; pdfUrl?: string; pages: string[]; entries: { hymnId: string; name: string; label: string }[] }[];
  code?: string;
  gender?: 'm' | 'f';
  grade?: string;
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
  const top = rows.slice(0, 3).map((r, i) => ({ id: r.member.id, name: titled(r.member, data.levels), photo: r.member.photo, points: r.points, place: i + 1 }));
  const hymns = (data.curricula[curriculumKey(term?.id, m.levelId)] ?? [])
    .map(id => data.hymns.find(h => h.id === id))
    .filter((h): h is Hymn => !!h)
    .map(h => ({
      ...h,
      book: (b => b && { title: b.book.title, label: pagesLabel(b.entry), pages: entryPages(b.book, b.entry) })(bookOf(data, h.id, term?.id)),
      status: (data.progress[m.id]?.[h.id] ?? 0) as HymnStatus,
      // Recordings from this level's sessions on this hymn, newest first, to practise with.
      recordings: data.sessions.filter(s => s.levelId === m.levelId && s.hymnIds[0] === h.id).sort((a, b) => b.date.localeCompare(a.date))
        .flatMap(s => sessionRecordings(s).map(r => ({ ...r, date: s.date }))).slice(0, 6),
      levels: data.levels.filter(l => (data.curricula[curriculumKey(term?.id, l.id)] ?? []).includes(h.id)).map(l => l.name),
    }));
  const ratings = data.sessions
    .filter(s => s.ratings[m.id] && (!term || (s.date >= term.start && s.date <= term.end)))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(s => ({ id: s.id, date: s.date, r: s.ratings[m.id], avg: sessionAverage(s, m.id)!, memorized: s.milestones?.[m.id]?.memorized ?? 0, solo: s.milestones?.[m.id]?.solo ?? 0, note: s.notes?.[m.id] }));
  const mine = data.sessions.filter(s => s.attendance[m.id] !== undefined);
  const sessions = data.sessions
    .filter(s => s.levelId === m.levelId || s.attendance[m.id] !== undefined)
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12)
    .map(s => ({
      id: s.id, date: s.date, hymn: data.hymns.find(h => h.id === s.hymnIds[0])?.nameAr, summary: s.summary, summaryAt: s.summaryAt, recordings: sessionRecordings(s),
      att: s.attendance[m.id], arrived: s.arrivals?.[m.id], late: lateBy(s, m.id) ?? undefined,
    }));
  const termName = (id?: string) => data.terms.find(t => t.id === id)?.name;
  const termStart = (id?: string) => data.terms.find(t => t.id === id)?.start ?? '';
  const books = data.books
    .filter(b => !b.levelId || b.levelId === m.levelId)
    .sort((a, b) => Number(b.termId === term?.id) - Number(a.termId === term?.id) || termStart(b.termId).localeCompare(termStart(a.termId)))
    .map(b => ({
      id: b.id, title: b.title, term: termName(b.termId), current: !!term && b.termId === term.id, pdfUrl: b.pdfUrl,
      pages: hasPages(b) ? Array.from({ length: b.pageCount! }, (_, i) => pageUrl(b, i + 1)) : [],
      entries: b.entries.map(e => ({ hymnId: e.hymnId, name: data.hymns.find(h => h.id === e.hymnId)?.nameAr ?? '', label: pagesLabel(e) })).filter(e => e.name),
    }));
  return clean({
    memberId: m.id, name: titled(m, data.levels), photo: m.photo, rank: m.rank,
    profile: { name: m.name, photo: m.photo, birthdate: m.birthdate, phone: m.phone, parentPhone: m.parentPhone, gender: m.gender, grade: m.grade, address: m.address }, levelName: level?.name ?? '', termName: term?.name, month,
    points: breakdown.total, place: pos + 1, gap: Math.max(0, (rows[0]?.points ?? 0) - breakdown.total), breakdown, top, hymns, ratings,
    sessions, books, levelId: m.levelId, code: m.code, gender: m.gender, grade: m.grade,
    attendanceRate: mine.length ? Math.round(100 * mine.filter(s => s.attendance[m.id] === 'p').length / mine.length) : null,
  });
}
