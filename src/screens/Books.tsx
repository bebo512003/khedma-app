import { Link, useNavigate } from 'react-router-dom';
import { useData, useCan } from '../data/store';
import { currentTerm, uid } from '../data/logic';
import { hasPages, pageUrl } from '../data/books';
import PageImg from './PageImg';
import PackCard from './PackCard';

/** The school's booklets. Each one's index is a level's curriculum for a term. */
export default function Books() {
  const [data, update] = useData();
  const edit = useCan('curriculum');
  const nav = useNavigate();
  const term = currentTerm(data);
  const levelName = (id?: string) => data.levels.find(l => l.id === id)?.name;
  const termName = (id?: string) => data.terms.find(t => t.id === id)?.name;
  const add = () => {
    const id = uid();
    update(d => ({ ...d, books: [...d.books, { id, title: 'كتاب جديد', termId: term?.id, levelId: d.levels[0]?.id, entries: [] }] }));
    nav(`/books/${id}?edit=1`);
  };

  return (
    <>
      <header className="top gutter"><div className="row between">
        <div className="row"><Link to="/library" className="icon" aria-label="رجوع">→</Link><h1>الكتب</h1></div>
        <Link to="/curriculum" className="btn" style={{ minHeight: 40 }}>المنهج</Link>
      </div></header>
      <main className="main gutter wide">
        <div className="note span">كل كتاب (ملزمة الترم) ليه مستوى وترم وفهرس ألحان بأرقام صفحاتها. فهرس الكتاب هو منهج المستوى ده في الترم ده.</div>
        {data.books.map(b => (
          <Link key={b.id} to={`/books/${b.id}`} className="card book-li">
            {hasPages(b) ? <PageImg src={pageUrl(b, 1)} alt="" /> : <div className="book-cover">📖</div>}
            <div className="grow">
              <b>{b.title}</b>
              <div className="muted">{[levelName(b.levelId), termName(b.termId)].filter(Boolean).join(' • ')}</div>
              <div className="muted">{b.entries.length} لحن{b.pageCount ? ` • ${b.pageCount} صفحة` : ''}</div>
            </div>
          </Link>
        ))}
        {data.books.length === 0 && <div className="card"><b>لسه مفيش كتب.</b><div className="muted">ضيف كتاب الميلاد الجاهز تحت، أو اعمل كتاب جديد وحط فيه ألحانه من المكتبة.</div></div>}
        <PackCard termId={term?.id ?? ''} />
      </main>
      {edit && <div className="bar gutter"><div><button className="btnp grow" onClick={add}>كتاب جديد</button></div></div>}
    </>
  );
}
