import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../data/store';
import { currentTerm, curriculumKey } from '../data/logic';

export default function Library() {
  const [data] = useData();
  const [q, setQ] = useState('');
  const [prayer, setPrayer] = useState('');
  const term = currentTerm(data);
  const prayers = [...new Set(data.hymns.map(h => h.prayer).filter((p): p is string => !!p))];
  const levelsOf = (hymnId: string) => data.levels.filter(l => (data.curricula[curriculumKey(term?.id, l.id)] ?? []).includes(hymnId));
  const list = data.hymns
    .filter(h => !prayer || h.prayer === prayer)
    .filter(h => !q.trim() || `${h.nameAr} ${h.nameCoptic ?? ''}`.includes(q.trim()));

  return (
    <>
      <header className="top gutter">
        <div className="row between">
          <div className="row"><Link to="/" className="icon" aria-label="رجوع">→</Link><h1>مكتبة الألحان</h1></div>
          <Link to="/curriculum" className="btn" style={{ minHeight: 40 }}>المنهج</Link>
        </div>
        <input className="input" type="search" placeholder="دوّر على لحن" value={q} onChange={e => setQ(e.target.value)} aria-label="بحث" />
        {prayers.length > 1 && (
          <div className="chips">
            <button className="chip" aria-pressed={!prayer} onClick={() => setPrayer('')}>الكل</button>
            {prayers.map(p => <button key={p} className="chip" aria-pressed={prayer === p} onClick={() => setPrayer(p)}>{p}</button>)}
          </div>
        )}
      </header>
      <main className="main gutter wide">
        <div className="card"><div className="list cols">
          {list.map(h => {
            const ls = levelsOf(h.id);
            return (
              <Link key={h.id} to={`/hymns/${h.id}`} className="li">
                <div className="grow">
                  <b>{h.nameAr}</b>
                  <div className="muted">{[h.prayer, h.when, h.occasion].filter(Boolean).join(' • ') || 'من غير تفاصيل لسه'}</div>
                </div>
                <div className="row" style={{ gap: 4 }}>
                  {h.pdfUrl && <span className="tag tag-ex">PDF</span>}
                  {h.audioUrl && <span className="tag tag-ex">صوت</span>}
                  {ls.length > 0 && <span className="tag" style={{ border: '1px solid var(--line)' }}>{ls.map(l => l.name).join('، ')}</span>}
                </div>
              </Link>
            );
          })}
          {list.length === 0 && <div className="note">مفيش ألحان بالاسم ده.</div>}
        </div></div>
      </main>
      <div className="bar gutter"><div><Link to="/hymns/new" className="btnp grow">لحن جديد</Link></div></div>
    </>
  );
}
