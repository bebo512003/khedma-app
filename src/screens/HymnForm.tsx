import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useData } from '../data/store';
import { uid } from '../data/logic';
import type { Hymn } from '../data/types';

const PRAYERS = ['القداس', 'التسبحة', 'رفع البخور', 'الأجبية', 'الدورات', 'المناسبات'];

/** Links must be http(s) so a pasted value can't run script when opened. */
const safeUrl = (u?: string) => (u && /^https?:\/\//i.test(u.trim()) ? u.trim() : undefined);

export default function HymnForm() {
  const { hymnId } = useParams();
  const [data, update] = useData();
  const nav = useNavigate();
  const existing = data.hymns.find(h => h.id === hymnId);
  const [h, setH] = useState<Hymn>(existing ?? { id: uid(), nameAr: '' });
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (p: Partial<Hymn>) => setH(x => ({ ...x, ...p }));

  const save = () => {
    if (!h.nameAr.trim()) { setError('اكتب اسم اللحن.'); return; }
    for (const u of [h.pdfUrl, h.audioUrl]) if (u?.trim() && !safeUrl(u)) { setError('اللينك لازم يبدأ بـ https://'); return; }
    const clean: Hymn = { ...h, nameAr: h.nameAr.trim(), pdfUrl: safeUrl(h.pdfUrl), audioUrl: safeUrl(h.audioUrl) };
    update(d => existing
      ? { ...d, hymns: d.hymns.map(x => x.id === clean.id ? clean : x) }
      : { ...d, hymns: [...d.hymns, clean] });
    nav('/library', { replace: true });
  };
  const remove = () => {
    update(d => ({
      ...d,
      hymns: d.hymns.filter(x => x.id !== h.id),
      curricula: Object.fromEntries(Object.entries(d.curricula).map(([k, ids]) => [k, ids.filter(id => id !== h.id)])),
    }));
    nav('/library', { replace: true });
  };

  const text = (key: 'nameAr' | 'nameCoptic' | 'when' | 'occasion', label: string, placeholder = '') => (
    <label className="field" htmlFor={key}><span>{label}</span>
      <input id={key} className="input" value={h[key] ?? ''} placeholder={placeholder} onChange={e => set({ [key]: e.target.value })} /></label>
  );
  const link = (key: 'pdfUrl' | 'audioUrl', label: string) => (
    <label className="field" htmlFor={key}><span>{label}</span>
      <div className="row">
        <input id={key} className="input grow" dir="ltr" inputMode="url" value={h[key] ?? ''} placeholder="https://drive.google.com/…" onChange={e => set({ [key]: e.target.value })} />
        {safeUrl(h[key]) && <a className="btn" href={safeUrl(h[key])} target="_blank" rel="noopener noreferrer">افتح</a>}
      </div></label>
  );

  return (
    <>
      <header className="top gutter"><div className="row">
        <Link to="/library" className="icon" aria-label="رجوع">→</Link><h1>{existing ? h.nameAr : 'لحن جديد'}</h1>
      </div></header>
      <main className="main gutter">
        {text('nameAr', 'اسم اللحن', 'مثلاً: أسبسمس آدام')}
        {text('nameCoptic', 'الاسم القبطي (اختياري)')}
        <div className="field"><span>بيتقال في</span>
          <div className="chips">{PRAYERS.map(p =>
            <button key={p} className="chip" aria-pressed={h.prayer === p} onClick={() => set({ prayer: h.prayer === p ? undefined : p })}>{p}</button>)}</div>
        </div>
        {text('when', 'إمتى في الصلاة', 'مثلاً: بعد صلاة الصلح')}
        {text('occasion', 'المناسبة', 'سنوي، كيهك، الصوم الكبير…')}
        {link('pdfUrl', 'لينك الـ PDF على Google Drive')}
        {link('audioUrl', 'لينك التسجيل الصوتي')}
        <div className="note">الملفات بتفضل على الـ Drive بتاعكم، والتطبيق بيحفظ اللينك بس. خلي الملف متاح لأي حد معاه اللينك.</div>
        {error && <div className="alert-t" role="alert">{error}</div>}
        {existing && (confirmDelete
          ? <div className="card alert"><b>تمسح {h.nameAr} من المكتبة والمنهج؟</b><div className="row"><button className="btn grow" onClick={() => setConfirmDelete(false)}>لا</button><button className="btnp grow" onClick={remove}>امسح</button></div></div>
          : <button className="btn" onClick={() => setConfirmDelete(true)}>امسح اللحن</button>)}
      </main>
      <div className="bar gutter"><div>
        <Link to="/library" className="btn">إلغاء</Link>
        <button className="btnp grow" onClick={save}>احفظ</button>
      </div></div>
    </>
  );
}
