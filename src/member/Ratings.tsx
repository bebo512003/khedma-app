import { useData } from '../data/store';
import { currentTerm, formatDay, hymnsCount, sessionAverage, sessionsCount } from '../data/logic';
import { CRITERIA } from '../data/types';
import { useMember } from './session';

export default function MemberRatings() {
  const [data] = useData();
  const { member } = useMember();
  if (!member) return null;
  const term = currentTerm(data);
  const sessions = data.sessions
    .filter(s => s.ratings[member.id] && (!term || (s.date >= term.start && s.date <= term.end)))
    .sort((a, b) => b.date.localeCompare(a.date));
  const avg = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  const overall = avg(sessions.map(s => sessionAverage(s, member.id)!));
  const perCrit = CRITERIA.map((_, j) => avg(sessions.map(s => s.ratings[member.id][j])));

  return (
    <>
      <header className="top gutter"><div><h1>تقييماتي</h1><div className="muted">{term ? `ترم ${term.name} • ` : ''}{sessionsCount(sessions.length)}</div></div></header>
      <main className="main gutter">
        <div className="hero">
          <div className="row between">
            <div><div className="big">{overall?.toFixed(1) ?? '–'}</div><div>متوسطك في الترم من 5</div></div>
          </div>
          <div className="stats">{CRITERIA.map((c, j) =>
            <div key={c} className="stat" style={{ background: 'rgba(255,255,255,.08)' }}><b>{perCrit[j]?.toFixed(1) ?? '–'}</b><span>{c}</span></div>)}</div>
        </div>
        <div className="card"><h2>كل حصة</h2><div className="list">
          {sessions.map(s => {
            const r = s.ratings[member.id], a = sessionAverage(s, member.id)!, ms = s.milestones?.[member.id];
            return (
              <div key={s.id} className="li" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
                <div className="row between"><b>{formatDay(s.date)}</b><span className={`pill ${a >= 4 ? 'st3' : 'st1'}`} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 28 }}>{a.toFixed(1)}</span></div>
                <div className="muted">{CRITERIA.map((c, j) => `${c} ${r[j]}`).join(' • ')}</div>
                {ms && <div className="note">{[ms.memorized && `وصلت "حافظه" في ${hymnsCount(ms.memorized)}`, ms.solo && `وصلت "بيقوله لوحده" في ${hymnsCount(ms.solo)}`].filter(Boolean).join(' و')}</div>}
              </div>
            );
          })}
          {sessions.length === 0 && <div className="note">لسه مفيش تقييمات في الترم ده.</div>}
        </div></div>
      </main>
    </>
  );
}
