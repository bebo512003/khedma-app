import { useState } from 'react';

/** A servant the admin added by mobile signs in with that number and their password. */
export default function PhoneSignIn({ onBack }: { onBack: () => void }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const go = async () => {
    const api = await import('../firebase/servantPhone');
    const p = api.localPhone(phone);
    if (!p) { setError('اكتب رقم موبايل مصري صحيح، زي 01012345678.'); return; }
    setBusy(true); setError('');
    try { await api.passwordSignIn(p, password); } catch (e) {
      const c = (e as { code?: string }).code ?? '';
      setError(!navigator.onLine ? 'محتاج نت للخطوة دي.'
        : c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found') ? 'الرقم أو الباسورد مش مظبوط.'
        : c.includes('too-many-requests') ? 'محاولات كتير، استنى شوية وجرّب تاني.'
        : 'حصلت مشكلة، جرّب تاني.');
    }
    setBusy(false);
  };

  return (
    <div className="card" style={{ width: '100%' }}>
      <b>الدخول برقم التليفون</b>
      <label className="field" htmlFor="sphone"><span>رقم موبايلك</span>
        <input id="sphone" className="input" dir="ltr" inputMode="tel" autoComplete="username" placeholder="01012345678" value={phone}
          onChange={e => setPhone(e.target.value.replace(/[^\d+]/g, '').slice(0, 13))} /></label>
      <label className="field" htmlFor="spass"><span>الباسورد</span>
        <input id="spass" className="input" dir="ltr" type="password" autoComplete="current-password" value={password}
          onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && password && go()} /></label>
      <button className="btnp" disabled={busy || !password} onClick={go}>{busy ? 'بيدخل…' : 'ادخل'}</button>
      {error && <div className="alert-t" role="alert">{error}</div>}
      <div className="muted">الخادم المسؤول هو اللي بيضيفك برقمك ويديك أول باسورد. لو نسيته اطلب منه يعملك واحد جديد.</div>
      <button className="btn" onClick={onBack}>رجوع</button>
    </div>
  );
}
