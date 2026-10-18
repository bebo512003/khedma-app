import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useData } from '../data/store';
import { applyBook, pageUrl, pagesLabel } from '../data/books';
import type { Book } from '../data/types';

const safeUrl = (u?: string) => (u && /^https?:\/\//i.test(u.trim()) ? u.trim() : undefined);

/** One booklet: its index (hymns with pages) drives the level's curriculum for its term. */
export default function BookPage() {
  const { bookId } = useParams();
  const [params] = useSearchParams();
  const [data, update] = useData();
  const nav = useNavigate();
  const saved = data.books.find(b => b.id === bookId);
  const [draft, setDraft] = useState<Book | null>(params.get('edit') && saved ? saved : null);
  const [q, setQ] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!saved) return <main className="main gutter"><div className="card">الكتاب ده مش موجود. <Link to="/books">الكتب</Link></div></main>;

  const hymn = (id: string) => data.hymns.find(h => h.id === id);
  const levels = [...data.levels].sort((a, b) => a.order - b.order);
  const terms = [...data.terms].sort((a, b) => b.start.localeCompare(a.start));
  const level = data.levels.find(l => l.id === saved.levelId);
  const term = data.terms.find(t => t.id === saved.termId);

  if (draft) {
    const set = (p: Partial<Book>) => setDraft({ ...draft, ...p });
    const setEntry = (i: number, p: Partial<Book['entries'][number]>) => set({ entries: draft.entries.map((e, j) => j === i ? { ...e, ...p } : e) });
    const move = (i: number, by: number) => { const n = [...draft.entries]; [n[i], n[i + by]] = [n[i + by], n[i]]; set({ entries: n }); };
    const num = (v: string) => (v ? Math.max(1, Math.round(Number(v))) || undefined : undefined);
    const candidates = data.hymns.filter(h => !draft.entries.some(e => e.hymnId === h.id) && (!q.trim() || h.nameAr.includes(q.trim())));
    const save = () => {
      const b = { ...draft, title: draft.title.trim() || 'كتاب', pdfUrl: safeUrl(draft.pdfUrl) };
      update(d => applyBook({ ...d, books: d.books.map(x => x.id === b.id ? b : x) }, b));
      setDraft(null);
    };
    const remove = () => { update(d => ({ ...d, books: d.books.filter(b => b.id !== draft.id) })); nav('/books', { replace: true }); };
    return (
      <>
        <header className="top gutter"><div className="row">
          <button className="icon" onClick={() => setDraft(null)} aria-label="رجوع">→</button><h1>تعديل الكتاب</h1>
        </div></header>
        <main className="main gutter">
          <label className="field" htmlFor="btitle"><span>اسم الكتاب</span>
            <input id="btitle" className="input" value={draft.title} onChange={e => set({ title: e.target.value })} /></label>
          <div className="field"><span>المستوى</span><div className="chips">{levels.map(l =>
            <button key={l.id} className="chip" aria-pressed={draft.levelId === l.id} onClick={() => set({ levelId: l.id })}>{l.name}</button>)}</div></div>
          <div className="field"><span>الترم</span><div className="chips">{terms.map(t =>
            <button key={t.id} className="chip" aria-pressed={draft.termId === t.id} onClick={() => set({ termId: t.id })}>{t.name}</button>)}</div></div>
          <label className="field" htmlFor="bpdf"><span>لينك الـ PDF على Google Drive (اختياري)</span>
            <input id="bpdf" className="input" dir="ltr" inputMode="url" placeholder="https://drive.google.com/…" value={draft.pdfUrl ?? ''} onChange={e => set({ pdfUrl: e.target.value })} /></label>

          <div className="card">
            <div className="row between"><h2>الفهرس</h2><span className="muted">{draft.entries.length} لحن</span></div>
            <div className="note">ترتيب الألحان هنا هو ترتيب المنهج. اكتب صفحة البداية والنهاية لكل لحن.</div>
            <div className="list">
              {draft.entries.map((e, i) => (
                <div key={e.hymnId} className="li" style={{ flexWrap: 'wrap' }}>
                  <b className="muted" style={{ width: 18 }}>{i + 1}</b>
                  <b className="grow">{hymn(e.hymnId)?.nameAr ?? 'لحن اتمسح'}</b>
                  <input className="input pg" type="number" min={1} inputMode="numeric" aria-label="من صفحة" placeholder="من ص" value={e.from ?? ''} onChange={x => setEntry(i, { from: num(x.target.value) })} />
                  <input className="input pg" type="number" min={1} inputMode="numeric" aria-label="لحد صفحة" placeholder="لحد" value={e.to ?? ''} onChange={x => setEntry(i, { to: num(x.target.value) })} />
                  <button className="icon" disabled={i === 0} onClick={() => move(i, -1)} aria-label="لفوق">↑</button>
                  <button className="icon" disabled={i === draft.entries.length - 1} onClick={() => move(i, 1)} aria-label="لتحت">↓</button>
                  <button className="icon" onClick={() => set({ entries: draft.entries.filter((_, j) => j !== i) })} aria-label="شيل من الكتاب">✕</button>
                </div>
              ))}
              {draft.entries.length === 0 && <div className="note">لسه مفيش ألحان في الكتاب.</div>}
            </div>
          </div>

          <div className="card">
            <h2>ضيف لحن من المكتبة</h2>
            <input className="input" type="search" placeholder="دوّر على لحن" value={q} onChange={e => setQ(e.target.value)} aria-label="بحث" />
            <div className="list">
              {candidates.slice(0, 30).map(h => (
                <button key={h.id} className="li" style={{ background: 'none', border: 0, borderBottom: '1px solid var(--line)', textAlign: 'right' }} onClick={() => set({ entries: [...draft.entries, { hymnId: h.id }] })}>
                  <div className="grow"><b>{h.nameAr}</b><div className="muted">{h.prayer}</div></div><span className="btnp" style={{ minHeight: 36 }}>أضف</span>
                </button>
              ))}
              {candidates.length === 0 && <div className="note">مفيش ألحان تانية. <Link to="/hymns/new">ضيف لحن جديد للمكتبة</Link></div>}
            </div>
          </div>
          {confirmDelete
            ? <div className="card alert"><b>تمسح الكتاب؟ الألحان هتفضل في المكتبة والمنهج.</b><div className="row"><button className="btn grow" onClick={() => setConfirmDelete(false)}>لا</button><button className="btnp grow" onClick={remove}>امسح</button></div></div>
            : <button className="btn" onClick={() => setConfirmDelete(true)}>امسح الكتاب</button>}
        </main>
        <div className="bar gutter"><div>
          <button className="btn" onClick={() => setDraft(null)}>إلغاء</button>
          <button className="btnp grow" onClick={save}>احفظ</button>
        </div></div>
      </>
    );
  }

  return (
    <>
      <header className="top gutter"><div className="row between">
        <div className="row"><Link to="/books" className="icon" aria-label="رجوع">→</Link>
          <div><h1>{saved.title}</h1><div className="muted">{[level?.name, term?.name].filter(Boolean).join(' • ')}</div></div></div>
        <button className="btn" style={{ minHeight: 40 }} onClick={() => setDraft(saved)}>تعديل</button>
      </div></header>
      <main className="main gutter">
        {level && term && <div className="note">الفهرس ده هو منهج {level.name} في ترم {term.name}، بنفس الترتيب. أي لحن تضيفه هنا بيتضاف للمنهج.</div>}
        {(!level || !term) && <div className="alert-t">حدد المستوى والترم من "تعديل" عشان الكتاب يبقى منهج.</div>}
        {safeUrl(saved.pdfUrl) && <a className="btn" href={safeUrl(saved.pdfUrl)} target="_blank" rel="noopener noreferrer">افتح الـ PDF</a>}

        <div className="card">
          <div className="row between"><h2>الفهرس</h2><span className="muted">{saved.entries.length} لحن</span></div>
          <div className="list">
            {saved.entries.map((e, i) => (
              <Link key={e.hymnId} to={`/hymns/${e.hymnId}`} className="li">
                <b className="muted" style={{ width: 18 }}>{i + 1}</b>
                <div className="grow"><b>{hymn(e.hymnId)?.nameAr ?? 'لحن اتمسح'}</b><div className="muted">{hymn(e.hymnId)?.prayer}</div></div>
                {e.from && <span className="tag tag-ex">{pagesLabel(e)}</span>}
              </Link>
            ))}
            {saved.entries.length === 0 && <div className="note">لسه مفيش ألحان. دوس "تعديل" وضيف من المكتبة.</div>}
          </div>
        </div>

        {saved.pagesBase && saved.pageCount && (
          <details className="card">
            <summary><b>اقرا الكتاب</b> <span className="muted">({saved.pageCount} صفحة)</span></summary>
            <div className="pages">{Array.from({ length: saved.pageCount }, (_, i) =>
              <img key={i} src={pageUrl(saved, i + 1)} alt={`صفحة ${i + 1}`} loading="lazy" />)}</div>
          </details>
        )}
      </main>
    </>
  );
}
