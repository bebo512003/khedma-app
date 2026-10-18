import { useState, type ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { MemberEdit } from '../data/types';
import { shrinkPhoto } from '../data/photo';
import { useView } from './Layout';
import { useSaveProfile } from './session';

/** The member's own photo and details. */
export default function MemberProfile() {
  const v = useView();
  const nav = useNavigate();
  const save = useSaveProfile();
  const [p, setP] = useState<MemberEdit>({ ...v.profile, name: v.profile?.name ?? v.name, photo: v.profile?.photo ?? v.photo });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (x: Partial<MemberEdit>) => setP(o => ({ ...o, ...x }));

  const onPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try { set({ photo: await shrinkPhoto(f) }); } catch { setError('الصورة دي مش هتنفع، جرّب صورة تانية.'); }
  };
  const submit = async () => {
    if (!p.name?.trim()) { setError('اكتب اسمك.'); return; }
    for (const ph of [p.phone, p.parentPhone]) if (ph?.trim() && !/^\+?[\d\s-]{8,15}$/.test(ph.trim())) { setError('رقم الموبايل مش مظبوط.'); return; }
    setBusy(true);
    try { await save(v.memberId, p); nav('/me/home', { replace: true }); }
    catch { setError('مقدرناش نحفظ دلوقتي. اتأكد إن معاك نت وجرّب تاني.'); }
    setBusy(false);
  };
  const field = (key: 'name' | 'phone' | 'parentPhone' | 'birthdate', label: string, type = 'text') => (
    <label className="field" htmlFor={key}><span>{label}</span>
      <input id={key} className="input" type={type} dir={type === 'tel' ? 'ltr' : undefined} inputMode={type === 'tel' ? 'tel' : undefined}
        value={p[key] ?? ''} onChange={e => set({ [key]: e.target.value })} /></label>
  );

  return (
    <>
      <header className="top gutter"><div className="row">
        <Link to="/me/home" className="icon" aria-label="رجوع">→</Link><h1>بياناتي</h1>
      </div></header>
      <main className="main gutter">
        <div className="row" style={{ gap: 14 }}>
          <label className="av" style={{ width: 88, height: 88, borderRadius: 20, cursor: 'pointer' }} htmlFor="photo" aria-label="صورتي">
            {p.photo ? <img src={p.photo} alt="" /> : 'صورة'}
          </label>
          <input id="photo" type="file" accept="image/*" hidden onChange={onPhoto} />
          <label className="btn" htmlFor="photo" style={{ cursor: 'pointer' }}>{p.photo ? 'غيّر الصورة' : 'حط صورتك'}</label>
        </div>
        {field('name', 'اسمك')}
        {field('birthdate', 'تاريخ ميلادك', 'date')}
        {field('phone', 'موبايلك (لو معاك)', 'tel')}
        {field('parentPhone', 'موبايل ولي الأمر', 'tel')}
        <div className="note">الخدام بيشوفوا التعديل أول ما حد فيهم يفتح التطبيق. المستوى والرتبة بيعدّلهم الخدام.</div>
        {error && <div className="alert-t" role="alert">{error}</div>}
        {/* Inline, not a bottom bar: the member tabs sit at the bottom. */}
        <div className="row">
          <Link to="/me/home" className="btn">إلغاء</Link>
          <button className="btnp grow" onClick={submit} disabled={busy}>احفظ</button>
        </div>
      </main>
    </>
  );
}
