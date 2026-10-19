import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useData, useIsLead } from '../data/store';
import { currentTerm, curriculumKey, uid } from '../data/logic';
import { booksFor, hasPages, pageUrl } from '../data/books';
import PageImg from './PageImg';
import PackCard from './PackCard';
import type { Term } from '../data/types';

export default function Curriculum() {
  const [data, update] = useData();
  const lead = useIsLead();
  const levels = [...data.levels].sort((a, b) => a.order - b.order);
  const terms = [...data.terms].sort((a, b) => b.start.localeCompare(a.start));
  const [termId, setTermId] = useState(currentTerm(data)?.id ?? '');
  const [levelId, setLevelId] = useState(levels[0]?.id ?? '');
  const [adding, setAdding] = useState(false);
  const [newTerm, setNewTerm] = useState<Term | null>(null);
  const [copy, setCopy] = useState(true);
  const [q, setQ] = useState('');

  const key = curriculumKey(termId, levelId);
  const books = booksFor(data, termId, levelId).filter(b => b.termId && b.levelId);
  const ids = data.curricula[key] ?? [];
  const hymn = (id: string) => data.hymns.find(h => h.id === id);
  const setIds = (next: string[]) => update(d => ({ ...d, curricula: { ...d.curricula, [key]: next } }));
  const move = (i: number, by: number) => { const n = [...ids]; [n[i], n[i + by]] = [n[i + by], n[i]]; setIds(n); };
  const candidates = data.hymns.filter(h => !ids.includes(h.id) && (!q.trim() || h.nameAr.includes(q.trim())));

  const saveTerm = () => {
    if (!newTerm || !newTerm.name.trim() || !newTerm.start || !newTerm.end || newTerm.end < newTerm.start) return;
    const t = { ...newTerm, name: newTerm.name.trim() };
    update(d => {
      const curricula = { ...d.curricula };
      if (copy && termId) for (const l of d.levels) curricula[curriculumKey(t.id, l.id)] = [...(d.curricula[curriculumKey(termId, l.id)] ?? [])];
      return { ...d, terms: [...d.terms, t], curricula };
    });
    setTermId(t.id); setNewTerm(null);
  };

  return (
    <>
      <header className="top gutter">
        <div className="row between">
          <div className="row"><Link to="/library" className="icon" aria-label="رجوع">→</Link><h1>المنهج</h1></div>
          <div className="row" style={{ gap: 6 }}><Link to="/books" className="btn" style={{ minHeight: 40 }}>الكتب</Link><Link to="/levels" className="btn" style={{ minHeight: 40 }}>المستويات</Link></div>
        </div>
        <div className="chips">
          {terms.map(t => <button key={t.id} className="chip" aria-pressed={termId === t.id} onClick={() => setTermId(t.id)}>{t.name}</button>)}
          {lead && <button className="chip" onClick={() => setNewTerm({ id: uid(), name: '', start: '', end: '' })}>+ ترم جديد</button>}
        </div>
        <div className="seg">{levels.map(l =>
          <button key={l.id} aria-pressed={levelId === l.id} onClick={() => setLevelId(l.id)}>{l.name}</button>)}</div>
      </header>
      <main className="main gutter">
        {newTerm && (
          <div className="card">
            <h2>ترم جديد</h2>
            <label className="field" htmlFor="tname"><span>اسم الترم</span>
              <input id="tname" className="input" placeholder="مثلاً: يناير – مارس 2027" value={newTerm.name} onChange={e => setNewTerm({ ...newTerm, name: e.target.value })} /></label>
            <div className="row">
              <label className="field grow" htmlFor="tstart"><span>من</span>
                <input id="tstart" type="date" className="input" value={newTerm.start} onChange={e => setNewTerm({ ...newTerm, start: e.target.value })} /></label>
              <label className="field grow" htmlFor="tend"><span>لحد</span>
                <input id="tend" type="date" className="input" value={newTerm.end} onChange={e => setNewTerm({ ...newTerm, end: e.target.value })} /></label>
            </div>
            <label className="row"><input type="checkbox" checked={copy} onChange={e => setCopy(e.target.checked)} /> انسخ ألحان الترم اللي مختاره دلوقتي كبداية</label>
            {newTerm.end && newTerm.start && newTerm.end < newTerm.start && <div className="alert-t">تاريخ النهاية قبل البداية.</div>}
            <div className="row"><button className="btn grow" onClick={() => setNewTerm(null)}>إلغاء</button><button className="btnp grow" onClick={saveTerm}>أضف الترم</button></div>
          </div>
        )}

        {books.map(b => (
          <Link key={b.id} to={`/books/${b.id}`} className="card book-li">
            {hasPages(b) ? <PageImg src={pageUrl(b, 1)} alt="" /> : <div className="book-cover">📖</div>}
            <div className="grow"><span className="muted">كتاب الترم</span><b>{b.title}</b><div className="muted">{b.entries.length} لحن • الترتيب والصفحات من فهرسه</div></div>
          </Link>
        ))}

        <div className="card">
          <div className="row between"><h2>ألحان الترم</h2><span className="muted">{ids.length} ألحان</span></div>
          <div className="list">
            {ids.map((id, i) => (
              <div key={id} className="li">
                <b className="muted" style={{ width: 18 }}>{i + 1}</b>
                <Link to={`/hymns/${id}`} className="grow" style={{ color: 'inherit', textDecoration: 'none' }}><b>{hymn(id)?.nameAr ?? 'لحن اتمسح'}</b>
                  <div className="muted">{hymn(id)?.prayer}</div></Link>
                <button className="icon" disabled={i === 0} onClick={() => move(i, -1)} aria-label="لفوق">↑</button>
                <button className="icon" disabled={i === ids.length - 1} onClick={() => move(i, 1)} aria-label="لتحت">↓</button>
                <button className="icon" onClick={() => setIds(ids.filter(x => x !== id))} aria-label="شيل من المنهج">✕</button>
              </div>
            ))}
            {ids.length === 0 && <div className="note">لسه مفيش ألحان للمستوى ده في الترم ده.</div>}
          </div>
          {!adding && <button className="btn" onClick={() => setAdding(true)}>أضف لحن من المكتبة</button>}
        </div>

        <PackCard termId={termId} levelId={levelId} />

        {adding && (
          <div className="card">
            <div className="row between"><h2>اختار من المكتبة</h2><button className="btn" style={{ minHeight: 36 }} onClick={() => setAdding(false)}>خلاص</button></div>
            <input className="input" type="search" placeholder="دوّر على لحن" value={q} onChange={e => setQ(e.target.value)} aria-label="بحث" />
            <div className="list">
              {candidates.map(h => (
                <button key={h.id} className="li" style={{ background: 'none', border: 0, borderBottom: '1px solid var(--line)', textAlign: 'right' }} onClick={() => setIds([...ids, h.id])}>
                  <div className="grow"><b>{h.nameAr}</b><div className="muted">{h.prayer}</div></div><span className="btnp" style={{ minHeight: 36 }}>أضف</span>
                </button>
              ))}
              {candidates.length === 0 && <div className="note">كل الألحان متضافة. <Link to="/hymns/new">ضيف لحن جديد للمكتبة</Link></div>}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
