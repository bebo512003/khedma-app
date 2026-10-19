import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import logo from '../logo.png';
import type { Book, Hymn, Level } from '../data/types';
import { hasPages, pagesLabel, pageUrl } from '../data/books';
import PageImg from './PageImg';
import { safeUrl } from '../data/logic';
import HymnText from './HymnText';
import Icon from '../ui/Icon';

/**
 * Open to anyone, no sign-in: the dictionary, the translator and the hymn library (read only).
 * Hymns are read straight from Firestore (the rules let anyone read them); servant notes stay out.
 */
/** A whole collection, read once per visit. */
const cache = new Map<string, Promise<unknown[]>>();
function loadCol<T>(name: string): Promise<(T & { id: string })[]> {
  if (!cache.has(name)) {
    const p = (async () => {
      const [{ memberFb }, { getDocs }, paths] = await Promise.all([import('../firebase/app'), import('firebase/firestore'), import('../firebase/paths')]);
      const snap = await getDocs(paths.col(memberFb().db, name));
      return snap.docs.map(d => ({ ...(d.data() as T), id: d.id }));
    })();
    p.catch(() => cache.delete(name));
    cache.set(name, p);
  }
  return cache.get(name)! as Promise<(T & { id: string })[]>;
}
const loadHymns = () => loadCol<Hymn>('hymns').then(l => l
  .map(h => ({ ...h, notes: undefined }))
  .filter(h => h.nameAr)
  .sort((a, b) => a.nameAr.localeCompare(b.nameAr, 'ar')));

function useLoad<T>(load: () => Promise<T>) {
  const [value, setValue] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { load().then(setValue).catch(() => setFailed(true)); }, [load]);
  return { value, failed };
}
function useHymns() {
  const { value, failed } = useLoad(loadHymns);
  return { hymns: value, failed };
}

const DOORS = [
  { to: '/open/dictionary', icon: 'dict', title: 'القاموس القبطي', text: 'حوالي ٣٤ ألف كلمة من قاموسين، دوّر بالقبطي أو بالعربي أو بالحروف الإنجليزي' },
  { to: '/open/translate', icon: 'list', title: 'ترجمة جملة', text: 'من القبطي للعربي ومن العربي للقبطي، مع شرح كل كلمة' },
  { to: '/open/library', icon: 'play', title: 'مكتبة الألحان', text: 'نص كل لحن بالقبطي والنطق والمعنى، وتسجيله لو موجود' },
  { to: '/open/books', icon: 'books', title: 'مكتبة الكتب', text: 'كتب المدرسة لكل مستوى، تتقري صفحة صفحة على الموبايل' },
];

export function OpenHome() {
  return (
    <main className="login open-home gutter">
      <img src={logo} alt="" width={76} height={76} />
      <div style={{ textAlign: 'center' }}>
        <h1>ركن اللغة القبطية والألحان</h1>
        <div className="muted">مفتوح لأي حد بيحب يتعلم، من غير حساب ولا تسجيل</div>
      </div>
      <nav className="doors" aria-label="الأدوات">
        {DOORS.map(d => (
          <Link key={d.to} to={d.to} className="door">
            <span className="door-i"><Icon name={d.icon} size={24} /></span>
            <span className="grow"><b>{d.title}</b><span>{d.text}</span></span>
            <span className="door-go" aria-hidden>←</span>
          </Link>
        ))}
      </nav>
      <Contact />
      <Link to="/" className="muted">أنت خادم أو مخدوم؟ ادخل من هنا</Link>
    </main>
  );
}

/** On the sign-in screens: the way into the open tools. */
export function OpenDoor() {
  return (
    <Link to="/open" className="door door-soft">
      <span className="door-i"><Icon name="dict" size={22} /></span>
      <span className="grow"><b>القاموس والمترجم ومكتبة الألحان</b><span>متاحين لأي حد، من غير تسجيل</span></span>
      <span className="door-go" aria-hidden>←</span>
    </Link>
  );
}

export function OpenLibrary() {
  const { hymns, failed } = useHymns();
  const [q, setQ] = useState('');
  const [prayer, setPrayer] = useState('');
  const prayers = [...new Set((hymns ?? []).map(h => h.prayer).filter((p): p is string => !!p))];
  const list = (hymns ?? [])
    .filter(h => !prayer || h.prayer === prayer)
    .filter(h => !q.trim() || `${h.nameAr} ${h.nameCoptic ?? ''}`.includes(q.trim()));
  return (
    <>
      <header className="top gutter">
        <div className="row"><Link to="/open" className="icon" aria-label="رجوع">→</Link><h1>مكتبة الألحان</h1></div>
        <input className="input" type="search" placeholder="دوّر على لحن" value={q} onChange={e => setQ(e.target.value)} aria-label="بحث" />
        {prayers.length > 1 && (
          <div className="chips">
            <button className="chip" aria-pressed={!prayer} onClick={() => setPrayer('')}>الكل</button>
            {prayers.map(p => <button key={p} className="chip" aria-pressed={prayer === p} onClick={() => setPrayer(p)}>{p}</button>)}
          </div>
        )}
      </header>
      <main className="main gutter wide">
        {failed && <div className="card alert"><div className="alert-t">المكتبة مش راضية تفتح</div><div className="note">غالبًا النت فاصل. اتأكد منه وجرّب تاني.</div></div>}
        {!hymns && !failed && <div className="note">لحظة، بنجهّز المكتبة…</div>}
        {hymns && (
          <div className="card"><div className="list cols">
            {list.map(h => (
              <Link key={h.id} to={`/open/hymn/${h.id}`} className="li">
                <div className="grow">
                  <b>{h.nameAr}</b>
                  <div className="muted">{[h.prayer, h.when, h.occasion].filter(Boolean).join(' • ') || (h.nameCoptic ?? '')}</div>
                </div>
                <div className="row" style={{ gap: 4 }}>
                  {h.copticText && <span className="tag tag-ex">النص</span>}
                  {h.audioUrl && <span className="tag tag-ex">صوت</span>}
                </div>
              </Link>
            ))}
            {list.length === 0 && <div className="note">مالقيناش لحن بالاسم ده. جرّب جزء من الاسم.</div>}
          </div></div>
        )}
      </main>
    </>
  );
}

export function OpenHymn() {
  const { hymnId } = useParams();
  const { hymns, failed } = useHymns();
  const h = hymns?.find(x => x.id === hymnId);
  const audio = safeUrl(h?.audioUrl), pdf = safeUrl(h?.pdfUrl);
  const place: [string, string | undefined][] = [['الصلاة', h?.prayer], ['بيتقال إمتى', h?.when], ['المناسبة', h?.occasion]];
  return (
    <>
      <header className="top gutter"><div className="row">
        <Link to="/open/library" className="icon" aria-label="رجوع">→</Link>
        <div className="grow"><h1>{h?.nameAr ?? 'لحن'}</h1>{h?.nameCoptic && <div className="muted coptic-font">{h.nameCoptic}</div>}</div>
      </div></header>
      <main className="main gutter">
        {failed && <div className="card alert"><div className="alert-t">اللحن ما اتحملش</div></div>}
        {!hymns && !failed && <div className="note">بيحمّل…</div>}
        {hymns && !h && <div className="card">اللحن ده مش موجود. <Link to="/open/library">ارجع للمكتبة</Link></div>}
        {h && <>
          {(audio || pdf) && (
            <div className="row">
              {audio && <a className="btnp grow" href={audio} target="_blank" rel="noopener noreferrer">شغّل التسجيل</a>}
              {pdf && <a className="btn grow" href={pdf} target="_blank" rel="noopener noreferrer">افتح الـ PDF</a>}
            </div>
          )}
          {place.some(([, v]) => v) && <div className="card">{place.filter(([, v]) => v).map(([k, v]) => <div key={k} className="kv"><span className="muted">{k}</span><b>{v}</b></div>)}</div>}
          <HymnText hymn={h} dictLink="/open/dictionary" />
        </>}
      </main>
    </>
  );
}

/** The school's page, phone and the church's Drive folder. */
const SCHOOL = {
  facebook: 'https://www.facebook.com/st.stephan.sch',
  phone: '01212996548',
  drive: 'https://drive.google.com/drive/folders/1RxvEiEVgqWOUNeNF5oLWfmZZ4jNErPnL',
};
export function Contact() {
  const ext = { target: '_blank', rel: 'noopener noreferrer' };
  return (
    <section className="contact" aria-label="تواصل معانا">
      <div className="muted">مدرسة الشهيد اسطفانوس للشمامسة والألحان</div>
      <div className="contact-row">
        <a href={SCHOOL.facebook} {...ext}><Icon name="facebook" size={20} /><span>صفحتنا</span></a>
        <a href={`https://wa.me/2${SCHOOL.phone}`} {...ext}><Icon name="whatsapp" size={20} /><span>واتساب</span></a>
        <a href={`tel:${SCHOOL.phone}`}><Icon name="phone" size={20} /><span dir="ltr">{SCHOOL.phone}</span></a>
        <a href={SCHOOL.drive} {...ext}><Icon name="drive" size={20} /><span>درايف الكنيسة</span></a>
      </div>
    </section>
  );
}

const loadBooks = () => Promise.all([loadCol<Book>('books'), loadCol<Level>('levels').catch(() => []), loadHymns()]).then(([books, levels, hymns]) => ({
  books: books.filter(b => b.title).sort((a, b) => a.title.localeCompare(b.title, 'ar')),
  levels: levels.sort((a, b) => a.order - b.order),
  hymns: new Map(hymns.map(h => [h.id, h])),
}));

export function OpenBooks() {
  const { value: d, failed } = useLoad(loadBooks);
  const groups = d ? [
    ...d.levels.map(l => ({ name: l.name, books: d.books.filter(b => b.levelId === l.id) })),
    { name: d.levels.length ? 'كتب عامة' : '', books: d.books.filter(b => !d.levels.some(l => l.id === b.levelId)) },
  ].filter(g => g.books.length) : [];
  return (
    <>
      <header className="top gutter"><div className="row"><Link to="/open" className="icon" aria-label="رجوع">→</Link><div><h1>مكتبة الكتب</h1><div className="muted">كتب المدرسة، تتقري من الموبايل</div></div></div></header>
      <main className="main gutter">
        {failed && <div className="card alert"><div className="alert-t">المكتبة مش راضية تفتح</div><div className="note">غالبًا النت فاصل. اتأكد منه وجرّب تاني.</div></div>}
        {!d && !failed && <div className="note">لحظة، بنجهّز الكتب…</div>}
        {d && groups.length === 0 && <div className="card"><div className="note">لسه مفيش كتب، قريب إن شاء الله.</div></div>}
        {groups.map(g => (
          <section key={g.name} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {g.name && <h2>{g.name}</h2>}
            {g.books.map(b => (
              <Link key={b.id} to={`/open/books/${b.id}`} className="card book-li">
                {hasPages(b) ? <PageImg src={pageUrl(b, 1)} alt="" /> : <span className="book-cover"><Icon name="book" /></span>}
                <div className="grow"><b>{b.title}</b>
                  <div className="muted">{[b.pageCount && `${b.pageCount} صفحة`, b.entries.length && `${b.entries.length} لحن`].filter(Boolean).join(' • ')}</div></div>
              </Link>
            ))}
          </section>
        ))}
      </main>
    </>
  );
}

export function OpenBook() {
  const { bookId } = useParams();
  const { value: d, failed } = useLoad(loadBooks);
  const b = d?.books.find(x => x.id === bookId);
  const pdf = safeUrl(b?.pdfUrl);
  return (
    <>
      <header className="top gutter"><div className="row">
        <Link to="/open/books" className="icon" aria-label="رجوع">→</Link>
        <div className="grow"><h1>{b?.title ?? 'كتاب'}</h1>{b?.pageCount ? <div className="muted">{b.pageCount} صفحة</div> : null}</div>
      </div></header>
      <main className="main gutter">
        {failed && <div className="card alert"><div className="alert-t">الكتاب مش راضي يفتح</div></div>}
        {!d && !failed && <div className="note">لحظة…</div>}
        {d && !b && <div className="card">الكتاب ده مش موجود. <Link to="/open/books">ارجع للكتب</Link></div>}
        {b && <>
          {pdf && <a className="btn" href={pdf} target="_blank" rel="noopener noreferrer">افتح الـ PDF</a>}
          {b.entries.length > 0 && <details className="card" open={!hasPages(b)}>
            <summary><b>الفهرس</b> <span className="muted">({b.entries.length} لحن)</span></summary>
            <div className="list">{b.entries.map((e, i) => {
              const h = d!.hymns.get(e.hymnId);
              const body = <><b className="muted" style={{ width: 18 }}>{i + 1}</b><b className="grow">{h?.nameAr ?? 'لحن'}</b>{pagesLabel(e) && <span className="tag tag-ex">{pagesLabel(e)}</span>}</>;
              return h ? <Link key={e.hymnId + i} to={`/open/hymn/${e.hymnId}`} className="li">{body}</Link> : <div key={e.hymnId + i} className="li">{body}</div>;
            })}</div>
          </details>}
          {hasPages(b)
            ? <div className="pages">{Array.from({ length: b.pageCount! }, (_, i) => <PageImg key={i} src={pageUrl(b, i + 1)} alt={`صفحة ${i + 1}`} />)}</div>
            : !pdf && <div className="note">الكتاب ده لسه مالوش صفحات هنا.</div>}
        </>}
      </main>
    </>
  );
}
