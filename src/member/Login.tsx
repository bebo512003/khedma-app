import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '../data/store';
import { cloudEnabled } from '../firebase/config';
import { memberLogin } from './session';
import logo from '../logo.png';

export default function Login() {
  const { data } = useStore();
  const nav = useNavigate();
  const [params] = useSearchParams();
  // Scanning a member card opens this page with the code filled in.
  const [code, setCode] = useState((params.get('code') ?? '').replace(/\D/g, '').slice(0, 6));
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // New PINs are 6 digits; older cards have 4, so "ادخل" works from 4 and 6 digits go in on their own.
  const submit = async (next: string) => {
    if (busy || next.length < 4) return;
    setBusy(true);
    try {
      const id = await memberLogin(code.trim().padStart(4, '0'), next, data);
      if (id) { nav('/me/home', { replace: true }); return; }
      setError('الكود أو الرقم السري مش مظبوط.');
    } catch {
      setError(navigator.onLine ? 'حصلت مشكلة، جرّب تاني.' : 'أول مرة تدخل لازم يكون معاك نت.');
    }
    setPin(''); setBusy(false);
  };
  const press = (k: string) => {
    if (busy) return;
    setError('');
    const next = k === '⌫' ? pin.slice(0, -1) : (pin + k).slice(0, 6);
    setPin(next);
    if (next.length === 6) submit(next);
  };

  return (
    <main className="login gutter">
      <img src={logo} alt="" width={84} height={84} />
      <div style={{ textAlign: 'center' }}><h1>مدرسة الشهيد اسطفانوس للشمامسة</h1><div className="muted">إتعلم … رتل … افرح</div></div>
      <label className="field" htmlFor="code" style={{ width: '100%' }}><span>كودك</span>
        <input id="code" className="input code" inputMode="numeric" dir="ltr" maxLength={6} placeholder="0042" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} /></label>
      <div className="field" style={{ width: '100%' }}><span>الرقم السري</span>
        <div className="dots" aria-label={`اتكتب ${pin.length} أرقام`}>{Array.from({ length: Math.max(4, pin.length) }, (_, i) => <i key={i} className={i < pin.length ? 'on' : ''} />)}</div>
      </div>
      {error && <div className="alert-t" role="alert">{error}</div>}
      <div className="keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0'].map(k =>
          <button key={k} onClick={() => press(k)} disabled={busy || (!code && k !== '⌫')} aria-label={k === '⌫' ? 'امسح' : k}>{k}</button>)}
        <button className="go" onClick={() => submit(pin)} disabled={busy || !code || pin.length < 4}>ادخل</button>
      </div>
      <div className="muted" style={{ textAlign: 'center' }}>مش فاكره؟ اسأل الخادم بتاعك يعملك واحد جديد.
        {!cloudEnabled && data?.members.some(m => m.example) && <><br />للتجربة: الكود 0001 والرقم 1234</>}</div>
      <Link to="/open">القاموس والمترجم ومكتبة الألحان (من غير تسجيل)</Link>
      <Link to="/install" className="muted">إزاي أنزّل التطبيق؟</Link>
      <Link to="/" className="muted">رجوع لتطبيق الخادم</Link>
    </main>
  );
}
