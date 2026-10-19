import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import logo from '../logo.png';
import type { Hymn } from '../data/types';
import { safeUrl } from '../data/logic';
import HymnText from './HymnText';
import Icon from '../ui/Icon';

/**
 * Open to anyone, no sign-in: the dictionary, the translator and the hymn library (read only).
 * Hymns are read straight from Firestore (the rules let anyone read them); servant notes stay out.
 */
let loading: Promise<Hymn[]> | null = null;
function loadHymns() {
  loading ??= (async () => {
    const [{ memberFb }, { getDocs }, paths] = await Promise.all([import('../firebase/app'), import('firebase/firestore'), import('../firebase/paths')]);
    const snap = await getDocs(paths.col(memberFb().db, 'hymns'));
    return snap.docs.map(d => ({ ...(d.data() as Hymn), id: d.id, notes: undefined }))
      .filter(h => h.nameAr)
      .sort((a, b) => a.nameAr.localeCompare(b.nameAr, 'ar'));
  })();
  loading.catch(() => { loading = null; });
  return loading;
}

function useHymns() {
  const [hymns, setHymns] = useState<Hymn[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { loadHymns().then(setHymns).catch(() => setFailed(true)); }, []);
  return { hymns, failed };
}

const DOORS = [
  { to: '/open/dictionary', icon: 'dict', title: 'القاموس القبطي', text: 'حوالي ٣٤ ألف كلمة من قاموسين، دوّر بالقبطي أو بالعربي أو بالحروف الإنجليزي' },
  { to: '/open/translate', icon: 'list', title: 'ترجمة جملة', text: 'من القبطي للعربي ومن العربي للقبطي، مع شرح كل كلمة' },
  { to: '/open/library', icon: 'books', title: 'مكتبة الألحان', text: 'نص كل لحن بالقبطي والنطق والمعنى، وتسجيله لو موجود' },
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
      <div className="muted" style={{ textAlign: 'center' }}>من مدرسة الشهيد اسطفانوس للشمامسة والألحان</div>
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
