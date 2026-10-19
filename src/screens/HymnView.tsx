import { Link, useNavigate, useParams } from 'react-router-dom';
import { useData, useCan } from '../data/store';
import { bookOf, entryPages, pagesLabel } from '../data/books';
import { currentTerm, curriculumKey, safeUrl } from '../data/logic';
import HymnText from './HymnText';
import BookPages from './BookPages';
import Icon from '../ui/Icon';

/** A hymn as a servant reads or prays it: text, booklet pages and recording. Editing is behind the edit button. */
export default function HymnView() {
  const { hymnId } = useParams();
  const [data] = useData();
  const edit = useCan('curriculum');
  const nav = useNavigate();
  const h = data.hymns.find(x => x.id === hymnId);
  if (!h) return <main className="main gutter"><div className="card">اللحن ده مش موجود. <Link to="/library">ارجع للمكتبة</Link></div></main>;
  const term = currentTerm(data);
  const inBook = bookOf(data, h.id, term?.id);
  const book = inBook && { title: inBook.book.title, label: pagesLabel(inBook.entry), pages: entryPages(inBook.book, inBook.entry) };
  const levels = data.levels.filter(l => (data.curricula[curriculumKey(term?.id, l.id)] ?? []).includes(h.id)).map(l => l.name);
  const place: [string, string | undefined][] = [['الصلاة', h.prayer], ['بيتقال إمتى', h.when], ['المناسبة', h.occasion]];
  const audio = safeUrl(h.audioUrl), pdf = safeUrl(h.pdfUrl);

  return (
    <>
      <header className="top gutter"><div className="row between">
        <div className="row grow">
          <button className="icon" onClick={() => nav(-1)} aria-label="رجوع"><Icon name="back" size={20} /></button>
          <div className="grow"><h1>{h.nameAr}</h1>{h.nameCoptic && <div className="muted coptic-font">{h.nameCoptic}</div>}</div>
        </div>
        {edit ? <Link to={`/hymns/${h.id}/edit`} className="icon" aria-label="تعديل"><Icon name="edit" size={20} /></Link> : <span />}
      </div></header>
      <main className="main gutter">
        <div className="row">
          {audio ? <a className="btnp grow" href={audio} target="_blank" rel="noopener noreferrer">شغّل التسجيل</a> : <span className="btn grow" aria-disabled>مفيش تسجيل</span>}
          {pdf && <a className="btn grow" href={pdf} target="_blank" rel="noopener noreferrer">افتح الـ PDF</a>}
        </div>

        <div className="card">
          {place.filter(([, v]) => v).map(([k, v]) => <div key={k} className="kv"><span className="muted">{k}</span><b>{v}</b></div>)}
          {levels.length > 0 && <div className="kv"><span className="muted">في منهج</span><b>{levels.join('، ')}</b></div>}
          {inBook && <Link to={`/books/${inBook.book.id}`} className="kv" style={{ color: 'inherit', textDecoration: 'none' }}><span className="muted">في كتاب</span><b>{inBook.book.title}{inBook.entry.from ? ` • ${pagesLabel(inBook.entry)}` : ''}</b></Link>}
          {!place.some(([, v]) => v) && !levels.length && <div className="note">لسه مفيش معلومات عن مكانه في الطقس. دوس تعديل وضيفها.</div>}
        </div>

        <HymnText hymn={h} dictLink="/dictionary" />
        <BookPages book={book || undefined} />
      </main>
    </>
  );
}
