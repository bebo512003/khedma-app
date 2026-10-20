import type { AppData, Member } from './types';
import { monthPoints, ranking, sessionAverage } from './logic';

const monthFmt = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { month: 'long', year: 'numeric' });
export const monthName = (month: string) => monthFmt.format(new Date(`${month}-15T12:00`));
export const shiftMonth = (month: string, by: number) => {
  const d = new Date(`${month}-15T12:00`); d.setMonth(d.getMonth() + by);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
export const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

type Stats = { present: number; taken: number; rate: number | null; avg: number | null };
function stats(data: AppData, m: Member, month: string): Stats {
  let present = 0, taken = 0;
  const avgs: number[] = [];
  for (const s of data.sessions) {
    if (s.levelId !== m.levelId || !s.date.startsWith(month) || s.attendance[m.id] === undefined) continue;
    taken++;
    if (s.attendance[m.id] === 'p') present++;
    const a = sessionAverage(s, m.id);
    if (a !== null) avgs.push(a);
  }
  return { present, taken, rate: taken ? Math.round(present / taken * 100) : null, avg: avgs.length ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null };
}

/** One level's month: sessions, attendance against last month, the top three, hymns reached, and who slipped. */
export function monthReport(data: AppData, levelId: string, month: string) {
  const prev = shiftMonth(month, -1);
  const sessions = data.sessions.filter(s => s.levelId === levelId && s.date.startsWith(month));
  const members = data.members.filter(m => m.levelId === levelId);
  const rows = members.map(m => ({ member: m, now: stats(data, m, month), before: stats(data, m, prev) }));
  const rate = (k: 'now' | 'before') => {
    const t = rows.reduce((a, r) => a + r[k].taken, 0);
    return t ? Math.round(rows.reduce((a, r) => a + r[k].present, 0) / t * 100) : null;
  };
  const top = ranking(data, levelId, month).filter(r => r.points > 0).slice(0, 3);
  const milestones = members.flatMap(m => {
    const n = sessions.reduce((a, s) => ({ memorized: a.memorized + (s.milestones?.[m.id]?.memorized ?? 0), solo: a.solo + (s.milestones?.[m.id]?.solo ?? 0) }), { memorized: 0, solo: 0 });
    return n.memorized || n.solo ? [{ member: m, ...n }] : [];
  });
  // Slipped: came less (down 30 points or more), rated lower (down a point or more), or missed every session this month.
  const slipped = rows.flatMap(({ member, now, before }) => {
    const why: string[] = [], f = member.gender === 'f';
    if (now.taken && now.present === 0) why.push(`${f ? 'غابت' : 'غاب'} كل حصص الشهر (${now.taken})`);
    else if (now.rate !== null && before.rate !== null && before.rate - now.rate >= 30) why.push(`${f ? 'حضورها' : 'حضوره'} نزل من ${before.rate}% لـ ${now.rate}%`);
    if (now.avg !== null && before.avg !== null && before.avg - now.avg >= 1) why.push(`${f ? 'تقييمها' : 'تقييمه'} نزل من ${before.avg.toFixed(1)} لـ ${now.avg.toFixed(1)}`);
    return why.length ? [{ member, why }] : [];
  });
  return { month, sessions: sessions.length, rate: rate('now'), prevRate: rate('before'), top, milestones, slipped,
    points: members.reduce((a, m) => a + monthPoints(data, m.id, month), 0) };
}
