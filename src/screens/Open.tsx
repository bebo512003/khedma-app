import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import logo from '../logo.png';
import type { Hymn } from '../data/types';
import { safeUrl } from '../data/logic';
import HymnText from './HymnText';

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

export function OpenHome() {
  return (
    <main className="login gutter">
      <img src={logo} alt="" width={84} height={84} />
      <div style={{ textAlign: 'center' }}><h1>أدوات اللغة القبطية والألحان</h1><div className="muted">مفتوحة لأي حد، من غير تسجيل دخول</div></div>
      <Link to="/open/dictionary" className="btnp" style={{ width: '100%' }}>القاموس القبطي</Link>
      <Link to="/open/translate" className="btn" style={{ width: '100%' }}>ترجمة جملة (قبطي ⇄ عربي)</Link>
      <Link to="/open/library" className="btn" style={{ width: '100%' }}>مكتبة الألحان</Link>
      <Link to="/" className="muted">دخول الخدام والمخدومين</Link>
    </main>
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
        {failed && <div className="card alert"><div className="alert-t">المكتبة ما اتحملتش</div><div className="note">اتأكد إن النت شغال وجرّب تاني.</div></div>}
        {!hymns && !failed && <div className="note">بيحمّل الألحان…</div>}
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
            {list.length === 0 && <div className="note">مفيش ألحان بالاسم ده.</div>}
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
