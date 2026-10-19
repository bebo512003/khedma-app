import { useState, type ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../data/store';
import { cancelled, shrinkPhoto } from '../data/photo';
import { RANKS, SERVANT_PROFILE_KEYS, type Servant } from '../data/types';

type Profile = Pick<Servant, typeof SERVANT_PROFILE_KEYS[number]>;

/** The signed-in servant's own photo and details, shown to the rest of the team. */
export default function ServantProfile() {
  const { servant } = useStore();
  const nav = useNavigate();
  const [p, setP] = useState<Profile>(() => Object.fromEntries(SERVANT_PROFILE_KEYS.map(k => [k, servant?.[k]])) as Profile);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!servant) return <main className="main gutter"><div className="card">البروفايل بيبقى للخدام اللي داخلين بحساب Google. <Link to="/">ارجع</Link></div></main>;
  const set = (x: Partial<Profile>) => setP(o => ({ ...o, ...x }));

  const onPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try { set({ photo: await shrinkPhoto(f) }); } catch (e) { if (!cancelled(e)) setError('الصورة دي مش هتنفع، جرّب صورة تانية.'); }
  };
  const save = async () => {
    if (!p.name?.trim()) { setError('اكتب اسمك.'); return; }
    if (p.phone?.trim() && !/^\+?[\d\s-]{8,15}$/.test(p.phone.trim())) { setError('رقم الموبايل مش مظبوط.'); return; }
    setBusy(true); setError('');
    try {
      const [{ servantFb }, { updateDoc, deleteField }, paths] = await Promise.all([import('../firebase/app'), import('firebase/firestore'), import('../firebase/paths')]);
      // Empty fields are removed, so the rules see only the keys a servant may change.
      const clean = Object.fromEntries(SERVANT_PROFILE_KEYS.map(k => [k, typeof p[k] === 'string' && p[k]!.trim() ? p[k]!.trim() : deleteField()]));
      await updateDoc(paths.ref(servantFb().db, 'servants', servant.uid), clean);
      nav(-1);
    } catch { setError('مقدرناش نحفظ دلوقتي. اتأكد إن معاك نت وجرّب تاني.'); }
    setBusy(false);
  };
  const field = (key: 'name' | 'phone' | 'birthdate', label: string, type = 'text') => (
    <label className="field" htmlFor={key}><span>{label}</span>
      <input id={key} className="input" type={type} dir={type === 'tel' ? 'ltr' : undefined} inputMode={type === 'tel' ? 'tel' : undefined}
        value={p[key] ?? ''} onChange={e => set({ [key]: e.target.value })} /></label>
  );

  return (
    <>
      <header className="top gutter"><div className="row">
        <button className="icon" onClick={() => nav(-1)} aria-label="رجوع">→</button><h1>بروفايلي</h1>
      </div></header>
      <main className="main gutter">
        <div className="row" style={{ gap: 14 }}>
          <label className="av" style={{ width: 88, height: 88, borderRadius: 20, cursor: 'pointer' }} htmlFor="photo" aria-label="صورتي">
            {p.photo ? <img src={p.photo} alt="" /> : (p.name || '؟')[0]}
          </label>
          <input id="photo" type="file" accept="image/*" hidden onChange={onPhoto} />
          <div>
            <label className="btn" htmlFor="photo" style={{ cursor: 'pointer' }}>{p.photo ? 'غيّر الصورة' : 'حط صورتك'}</label>
            <div className="muted" dir="ltr" style={{ textAlign: 'right', marginTop: 6 }}>{servant.email}</div>
          </div>
        </div>
        {field('name', 'اسمك')}
        {field('phone', 'موبايلك (واتساب)', 'tel')}
        {field('birthdate', 'تاريخ ميلادك', 'date')}
        <div className="field"><span>الرتبة (اختياري)</span><div className="chips">
          {RANKS.map(r => <button key={r} className="chip" aria-pressed={p.rank === r} onClick={() => set({ rank: p.rank === r ? undefined : r })}>{r}</button>)}
        </div></div>
        <label className="field" htmlFor="about"><span>نبذة (اختياري)</span>
          <textarea id="about" style={{ minHeight: 80 }} maxLength={300} placeholder="مثلاً: بخدم ألحان شباب، ومسؤول عن الافتقاد" value={p.about ?? ''} onChange={e => set({ about: e.target.value })} /></label>
        <div className="note">الفريق كله بيشوف صورتك واسمك وموبايلك ونبذتك في صفحة الفريق. المستويات والصلاحيات بيحددها الخادم المسؤول.</div>
        {error && <div className="alert-t" role="alert">{error}</div>}
      </main>
      <div className="bar gutter"><div>
        <button className="btn" onClick={() => nav(-1)}>إلغاء</button>
        <button className="btnp grow" onClick={save} disabled={busy}>احفظ</button>
      </div></div>
    </>
  );
}
