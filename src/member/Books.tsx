import { Link, useParams } from 'react-router-dom';
import { safeUrl } from '../data/logic';
import PageImg from '../screens/PageImg';
import { useView } from './Layout';

/** The level's booklets, to read on the phone. */
export function MemberBooks() {
  const v = useView();
  const books = v.books ?? [];
  return (
    <>
      <header className="top gutter"><div><h1>الكتب</h1><div className="muted">كتب {v.levelName}</div></div></header>
      <main className="main gutter">
        {books.length === 0 && <div className="card"><div className="note">لسه مفيش كتب لمستواك.</div></div>}
        {books.map(b => (
          <Link key={b.id} to={`/me/books/${b.id}`} className="card book-li">
            <div className="grow"><b>{b.title}</b>
              <div className="muted">{[b.term && `ترم ${b.term}`, b.pages.length && `${b.pages.length} صفحة`, `${b.entries.length} لحن`].filter(Boolean).join(' • ')}</div></div>
            {b.current && <span className="tag tag-soft">الترم ده</span>}
          </Link>
        ))}
      </main>
    </>
  );
}

export function MemberBook() {
  const { bookId } = useParams();
  const v = useView();
  const b = v.books?.find(x => x.id === bookId);
  if (!b) return <main className="main gutter"><div className="card">الكتاب ده مش موجود. <Link to="/me/books">الكتب</Link></div></main>;
  const mine = new Set(v.hymns.map(h => h.id));
  return (
    <>
      <header className="top gutter"><div className="row">
        <Link to="/me/books" className="icon" aria-label="رجوع">→</Link>
        <div><h1>{b.title}</h1>{b.term && <div className="muted">ترم {b.term}</div>}</div>
      </div></header>
      <main className="main gutter">
        {safeUrl(b.pdfUrl) && <a className="btn" href={safeUrl(b.pdfUrl)} target="_blank" rel="noopener noreferrer">افتح الـ PDF</a>}
        {b.entries.length > 0 && <details className="card" open={!b.pages.length}>
          <summary><b>الفهرس</b> <span className="muted">({b.entries.length} لحن)</span></summary>
          <div className="list">{b.entries.map((e, i) => {
            const body = <><b className="muted" style={{ width: 18 }}>{i + 1}</b><b className="grow">{e.name}</b>{e.label && <span className="tag tag-ex">{e.label}</span>}</>;
            return mine.has(e.hymnId) ? <Link key={e.hymnId} to={`/me/hymn/${e.hymnId}`} className="li">{body}</Link> : <div key={e.hymnId} className="li">{body}</div>;
          })}</div>
        </details>}
        {b.pages.length > 0
          ? <div className="pages">{b.pages.map((src, i) => <PageImg key={src} src={src} alt={`صفحة ${i + 1}`} />)}</div>
          : <div className="note">الكتاب ده مالوش صفحات في التطبيق.</div>}
      </main>
    </>
  );
}
