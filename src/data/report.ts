import type { AppData, Hymn, HymnStatus, Member } from './types';
import { curriculumKey, monthPoints, sessionAverage } from './logic';

export interface MemberRow {
  member: Member;
  present: number;
  excused: number;
  absent: number;
  /** Present out of sessions where attendance was taken for this member, 0 to 100; null if none. */
  rate: number | null;
  /** Average of each criterion (حفظ، أداء، التزام) and overall, over rated sessions. */
  criteria: [number, number, number] | null;
  avg: number | null;
  /** Hymns of the term's curriculum by status. */
  hymns: [number, number, number, number];
  /** Milestones reached in the period. */
  memorized: number;
  solo: number;
  points: number | null;
}

export interface Report {
  sessions: number;
  rate: number | null;
  avg: number | null;
  memorized: number;
  solo: number;
  members: MemberRow[];
  hymns: { hymn: Hymn; counts: [number, number, number, number] }[];
}

const mean = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
export const round1 = (n: number | null) => n === null ? null : Math.round(n * 10) / 10;

/** Attendance, ratings and hymn progress for one level between two dates (inclusive, YYYY-MM-DD). */
export function buildReport(data: AppData, levelId: string, from: string, to: string, termId?: string, month?: string): Report {
  const sessions = data.sessions.filter(s => s.levelId === levelId && s.date >= from && s.date <= to);
  const curriculum = termId ? data.curricula[curriculumKey(termId, levelId)] ?? [] : [];
  const members = data.members.filter(m => m.levelId === levelId).sort((a, b) => a.name.localeCompare(b.name, 'ar'));

  const rows: MemberRow[] = members.map(m => {
    let present = 0, excused = 0, absent = 0, memorized = 0, solo = 0;
    const rated: [number, number, number][] = [];
    for (const s of sessions) {
      const a = s.attendance[m.id];
      if (a === 'p') present++; else if (a === 'e') excused++; else if (a === 'a') absent++;
      if (s.ratings[m.id] && sessionAverage(s, m.id) !== null) rated.push(s.ratings[m.id]);
      memorized += s.milestones?.[m.id]?.memorized ?? 0;
      solo += s.milestones?.[m.id]?.solo ?? 0;
    }
    const taken = present + excused + absent;
    const criteria = rated.length ? [0, 1, 2].map(i => mean(rated.map(r => r[i]))!) as [number, number, number] : null;
    const hymns: [number, number, number, number] = [0, 0, 0, 0];
    for (const h of curriculum) hymns[(data.progress[m.id]?.[h] ?? 0) as HymnStatus]++;
    return {
      member: m, present, excused, absent, rate: taken ? Math.round((present / taken) * 100) : null,
      criteria, avg: criteria ? mean(criteria) : null, hymns, memorized, solo,
      points: month ? monthPoints(data, m.id, month) : null,
    };
  });

  const hymns = curriculum.map(id => data.hymns.find(h => h.id === id)).filter((h): h is Hymn => !!h).map(hymn => {
    const counts: [number, number, number, number] = [0, 0, 0, 0];
    for (const m of members) counts[(data.progress[m.id]?.[hymn.id] ?? 0) as HymnStatus]++;
    return { hymn, counts };
  });

  const withRate = rows.filter(r => r.rate !== null);
  const taken = withRate.reduce((n, r) => n + r.present + r.excused + r.absent, 0);
  return {
    sessions: sessions.length,
    rate: taken ? Math.round((withRate.reduce((n, r) => n + r.present, 0) / taken) * 100) : null,
    avg: mean(rows.filter(r => r.avg !== null).map(r => r.avg!)),
    memorized: rows.reduce((n, r) => n + r.memorized, 0),
    solo: rows.reduce((n, r) => n + r.solo, 0),
    members: rows,
    hymns,
  };
}
