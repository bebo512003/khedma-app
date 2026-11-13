import type { Attendance, AppData, Hymn, HymnStatus, MemberEdit, Rating, Recording } from './types';
import { attendStreak, currentTerm, curriculumKey, lateBy, pointsWhy, sessionPoints, sessionRecordings, monthBreakdown, ranking, sessionAverage, todayISO, titled } from './logic';
import { partKey, partOf, sessionHymnLabel } from './parts';
import { couponLedger, type Winner } from './coupons';
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
  top: { id: string; name: string; photo?: string; points: number; place: number; why?: string }[];
  hymns: (Hymn & { status: HymnStatus; levels: string[]; book?: { title: string; label: string; pages: string[] }; recordings?: (Recording & { date: string; part?: string })[]; partStatus?: Record<string, HymnStatus> })[];
  ratings: { id: string; date: string; r?: Rating; avg?: number; memorized: number; solo: number; note?: string }[];
  attendanceRate: number | null;
  /** The level's recent sessions: what was covered, the voice summary, and whether this member came. */
  sessions?: { id: string; date: string; hymn?: string; summary?: string; summaryAt?: number; recordings?: Recording[]; att?: Attendance; arrived?: number; late?: number; before?: boolean; pts?: { att: number; late?: number; rating: number; memorized: number; solo: number; total: number } }[];
  /** The level's booklets, newest term first. */
  books?: { id: string; title: string; term?: string; current: boolean; pdfUrl?: string; pages: string[]; entries: { hymnId: string; name: string; label: string }[] }[];
  /** Monthly coupons, when the school uses them: the balance, each ended month's, what was spent, and this month's place value. */
  coupons?: { balance: number; values: number[]; earned: { month: string; place: number; value: number }[]; spent: { date: string; amount: number; note?: string }[] };
  /** Sessions attended in a row. */
  streak?: { now: number; best: number };
  /** Last month's first place in this level, shown in the first week of a month. */
  star?: { month: string; people: { id: string; name: string; photo?: string }[] };
  code?: string;
  gender?: 'm' | 'f';
  grade?: string;
}

const clean = <T extends object>(o: T) => JSON.parse(JSON.stringify(o)) as T;

export function buildMemberView(data: AppData, memberId: string, month = todayISO().slice(0, 7), cache?: Map<string, Winner[]>): MemberView | null {
  const m = data.members.find(x => x.id === memberId);
  if (!m) return null;
  const level = data.levels.find(l => l.id === m.levelId);
  const term = currentTerm(data);
  const rows = ranking(data, m.levelId, month);
  const pos = rows.findIndex(r => r.member.id === m.id);
  const breakdown = monthBreakdown(data, m.id, month);
  const top = rows.filter(r => r.place <= 3).slice(0, 5).map(r => ({ id: r.member.id, name: titled(r.member, data.levels), photo: r.member.photo, points: r.points, place: r.place, why: pointsWhy(monthBreakdown(data, r.member.id, month), r.member.gender === 'f') }));
  const hymns = (data.curricula[curriculumKey(term?.id, m.levelId)] ?? [])
    .map(id => data.hymns.find(h => h.id === id))
    .filter((h): h is Hymn => !!h)
    .map(h => ({
      ...h,
      book: (b => b && { title: b.book.title, label: pagesLabel(b.entry), pages: entryPages(b.book, b.entry) })(bookOf(data, h.id, term?.id)),
      status: (data.progress[m.id]?.[h.id] ?? 0) as HymnStatus,
      // Recordings from this level's sessions on this hymn, newest first, to practise with.
      recordings: data.sessions.filter(s => s.levelId === m.levelId && s.hymnIds[0] === h.id).sort((a, b) => b.date.localeCompare(a.date))
        .flatMap(s => sessionRecordings(s).map(r => ({ ...r, date: s.date, part: partOf(h, s.partId)?.name }))).slice(0, 6),
      partStatus: h.parts?.length ? Object.fromEntries(h.parts.map(p => [p.id, (data.progress[m.id]?.[partKey(h.id, p.id)] ?? 0) as HymnStatus])) : undefined,
      levels: data.levels.filter(l => (data.curricula[curriculumKey(term?.id, l.id)] ?? []).includes(h.id)).map(l => l.name),
    }));
  const ratings = data.sessions
    // Rated sessions (before the new points rule) and any session with a note for them.
    .filter(s => (s.ratings[m.id] || s.notes?.[m.id]) && (!term || (s.date >= term.start && s.date <= term.end)))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(s => ({ id: s.id, date: s.date, r: s.ratings[m.id], avg: sessionAverage(s, m.id) ?? undefined, memorized: s.milestones?.[m.id]?.memorized ?? 0, solo: s.milestones?.[m.id]?.solo ?? 0, note: s.notes?.[m.id] }));
  const mine = data.sessions.filter(s => s.attendance[m.id] !== undefined);
  // When they joined this level: the stamped day, else their first session in it.
  const since = m.levelSince ?? mine.filter(s => s.levelId === m.levelId).map(s => s.date).sort()[0] ?? '';
  const sessions = data.sessions
    .filter(s => s.levelId === m.levelId || s.attendance[m.id] !== undefined)
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12)
    .map(s => ({
      id: s.id, date: s.date, hymn: sessionHymnLabel(data, s), summary: s.summary, summaryAt: s.summaryAt, recordings: sessionRecordings(s),
      att: s.attendance[m.id], arrived: s.arrivals?.[m.id], late: lateBy(s, m.id) ?? undefined,
      before: s.attendance[m.id] === undefined && !!since && s.date < since ? true : undefined,
      pts: sessionPoints(s, m.id),
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
  const prevMonth = (([y, mo]) => mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`)(month.split('-').map(Number));
  const stars = Number(todayISO().slice(8)) <= 7 && month === todayISO().slice(0, 7)
    ? ranking(data, m.levelId, prevMonth).filter(r => r.place === 1 && r.points > 0) : [];
  return clean({
    streak: attendStreak(data, m),
    star: stars.length ? { month: prevMonth, people: stars.map(r => ({ id: r.member.id, name: titled(r.member, data.levels), photo: r.member.photo })) } : undefined,
    memberId: m.id, name: titled(m, data.levels), photo: m.photo, rank: m.rank,
    profile: { name: m.name, photo: m.photo, birthdate: m.birthdate, phone: m.phone, parentPhone: m.parentPhone, gender: m.gender, grade: m.grade, address: m.address }, levelName: level?.name ?? '', termName: term?.name, month,
    points: breakdown.total, place: pos < 0 ? 0 : rows[pos].place, gap: Math.max(0, (rows[0]?.points ?? 0) - breakdown.total), breakdown, top, hymns, ratings,
    sessions, books, levelId: m.levelId,
    coupons: data.coupons ? (l => ({ balance: l.balance, values: data.coupons!.values, earned: l.earned.map(e => ({ month: e.month, place: e.place, value: e.value })), spent: l.spent.map(s => ({ date: s.date, amount: s.amount, note: s.note })) }))(couponLedger(data, m.id, cache)) : undefined, code: m.code, gender: m.gender, grade: m.grade,
    attendanceRate: mine.length ? Math.round(100 * mine.filter(s => s.attendance[m.id] === 'p').length / mine.length) : null,
  });
}
