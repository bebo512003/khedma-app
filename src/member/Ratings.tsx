import { formatDay, hymnsCount, sessionsCount } from '../data/logic';
import { CRITERIA } from '../data/types';
import { useG, useView } from './Layout';

export default function MemberRatings() {
  const v = useView();
  return (
    <>
      <header className="top gutter"><div><h1>ملاحظات الخادم</h1><div className="muted">{v.termName ? `ترم ${v.termName} • ` : ''}{sessionsCount(v.ratings.length)}</div></div></header>
      <main className="main gutter"><RatingsBody /></main>
    </>
  );
}

/** Term average per criterion and every rated session. */
export function RatingsBody() {
  const v = useView();
  const g = useG();
  const avg = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  const rated = v.ratings.filter(s => s.r && s.avg !== undefined);
  const overall = avg(rated.map(s => s.avg!));
  const perCrit = CRITERIA.map((_, j) => avg(rated.map(s => s.r![j])));

  return (
    <>
        {rated.length > 0 && <div className="hero">
          <div><div className="big">{overall?.toFixed(1) ?? '–'}</div><div>متوسطك في الترم من 5</div></div>
          <div className="stats">{CRITERIA.map((c, j) =>
            <div key={c} className="stat" style={{ background: 'rgba(255,255,255,.08)' }}><b>{perCrit[j]?.toFixed(1) ?? '–'}</b><span>{c}</span></div>)}</div>
        </div>}
        <div className="card"><h2>كل حصة</h2><div className="list">
          {v.ratings.map(s => (
            <div key={s.id} className="li" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
              <div className="row between"><b>{formatDay(s.date)}</b>{s.avg !== undefined && <span className={`pill ${s.avg >= 4 ? 'st3' : 'st1'}`} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 28 }}>{s.avg.toFixed(1)}</span>}</div>
              {s.r && <div className="muted">{CRITERIA.map((c, j) => `${c} ${s.r![j]}`).join(' • ')}</div>}
              {s.note && <div className="note" style={{ color: 'var(--fg)' }}>ملاحظة الخادم: {s.note}</div>}
              {(s.memorized > 0 || s.solo > 0) && <div className="note">{[s.memorized && `${g('وصلت "حافظه"', 'وصلتي "حافظاه"')} في ${hymnsCount(s.memorized)}`, s.solo && `${g('وصلت "بيقوله لوحده"', 'وصلتي "بتقوله لوحدها"')} في ${hymnsCount(s.solo)}`].filter(Boolean).join(' و')}</div>}
            </div>
          ))}
          {v.ratings.length === 0 && <div className="note">لسه مفيش ملاحظات في الترم ده.</div>}
        </div></div>
    </>
  );
}
