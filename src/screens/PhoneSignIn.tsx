import { useRef, useState } from 'react';
import type { ConfirmationResult } from 'firebase/auth';

const MIN = 8;

/** A servant signs in with their mobile: password after the first time, an SMS code the first time or when they forgot it. */
export default function PhoneSignIn({ onBack }: { onBack: () => void }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [sms, setSms] = useState<ConfirmationResult | null>(null);
  const [firstTime, setFirstTime] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const button = useRef<HTMLButtonElement>(null);

  const run = async (fn: (api: typeof import('../firebase/servantPhone'), e164: string) => Promise<void>) => {
    const api = await import('../firebase/servantPhone');
    const e164 = api.toE164(phone);
    if (!e164) { setError('اكتب رقم موبايل مصري صحيح، زي 01012345678.'); return; }
    setBusy(true); setError('');
    try { await fn(api, e164); } catch (e) {
      const c = (e as { code?: string }).code ?? '';
      setError(!navigator.onLine ? 'محتاج نت للخطوة دي.'
        : c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found') ? 'الرقم أو الباسورد مش مظبوط. لو نسيته دوس «نسيت الباسورد».'
        : c.includes('invalid-verification-code') ? 'الكود مش مظبوط، اتأكد من الرسالة.'
        : c.includes('code-expired') ? 'الكود خلص وقته، ابعت كود جديد.'
        : c.includes('too-many-requests') || c.includes('quota') ? 'اتبعت رسايل كتير النهاردة، جرّب بكرة أو ادخل بالباسورد.'
        : c.includes('operation-not-allowed') || c.includes('billing') ? 'الدخول برسالة لسه مش متفعّل في التطبيق. كلّم الخادم المسؤول.'
        : 'حصلت مشكلة، جرّب تاني.');
    }
    setBusy(false);
  };

  return (
    <div className="card" style={{ width: '100%' }}>
      <b>الدخول برقم الموبايل</b>
      <label className="field" htmlFor="sphone"><span>رقم موبايلك</span>
        <input id="sphone" className="input" dir="ltr" inputMode="tel" placeholder="01012345678" value={phone} disabled={!!sms}
          onChange={e => setPhone(e.target.value.replace(/[^\d+]/g, '').slice(0, 13))} /></label>
      {!firstTime && !sms && <>
        <label className="field" htmlFor="spass"><span>الباسورد</span>
          <input id="spass" className="input" dir="ltr" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
        <button className="btnp" disabled={busy || !password} onClick={() => run((api, e164) => api.passwordSignIn(e164, password).then(() => undefined))}>{busy ? 'بيدخل…' : 'ادخل'}</button>
        <button className="btn" onClick={() => { setFirstTime(true); setError(''); }}>أول مرة أدخل، أو نسيت الباسورد</button>
      </>}
      {firstTime && !sms && <>
        <div className="muted">هتوصلك رسالة فيها كود مرة واحدة، وبعدها تختار باسورد تدخل بيه على طول.</div>
        <button ref={button} className="btnp" disabled={busy} onClick={() => run(async (api, e164) => { setSms(await api.sendCode(e164, button.current!)); })}>{busy ? 'بيبعت…' : 'ابعتلي كود'}</button>
      </>}
      {sms && <>
        <label className="field" htmlFor="scode"><span>الكود اللي وصلك في الرسالة</span>
          <input id="scode" className="input" dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} /></label>
        <label className="field" htmlFor="snew"><span>اختار باسورد ({MIN} حروف أو أرقام على الأقل)</span>
          <input id="snew" className="input" dir="ltr" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
        <button className="btnp" disabled={busy || code.length < 6 || password.length < MIN}
          onClick={() => run((api, e164) => api.confirmCode(sms, code, e164, password))}>{busy ? 'بيدخل…' : 'ادخل واحفظ الباسورد'}</button>
      </>}
      {error && <div className="alert-t" role="alert">{error}</div>}
      <button className="btn" onClick={() => { if (sms || firstTime) { setSms(null); setFirstTime(false); setCode(''); setError(''); } else onBack(); }}>رجوع</button>
    </div>
  );
}
