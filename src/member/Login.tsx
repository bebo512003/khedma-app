import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useData } from '../data/store';
import { hashPin } from '../data/logic';
import { useMember } from './session';
import logo from '../logo.png';

/** Example members have no PIN yet, so 1234 lets anyone try the member app with them. */
const EXAMPLE_PIN = '1234';

export default function Login() {
  const [data] = useData();
  const { member, signIn } = useMember();
  const nav = useNavigate();
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  if (member) return <Navigate to="/me/home" replace />;

  const press = async (k: string) => {
    setError('');
    const next = k === '⌫' ? pin.slice(0, -1) : (pin + k).slice(0, 4);
    setPin(next);
    if (next.length < 4) return;
    const m = data.members.find(x => x.code === code.trim().padStart(4, '0'));
    const ok = m && (m.pinHash ? (await hashPin(m.id, next)) === m.pinHash : m.example && next === EXAMPLE_PIN);
    if (!m || !ok) { setError('الكود أو الرقم السري مش مظبوط.'); setPin(''); return; }
    signIn(m.id); nav('/me/home', { replace: true });
  };

  return (
    <main className="login gutter">
      <img src={logo} alt="" width={84} height={84} />
      <div style={{ textAlign: 'center' }}><h1>مدرسة الشهيد اسطفانوس للشمامسة</h1><div className="muted">إتعلم … رتل … افرح</div></div>
      <label className="field" htmlFor="code" style={{ width: '100%' }}><span>كودك</span>
        <input id="code" className="input code" inputMode="numeric" dir="ltr" maxLength={6} placeholder="0042" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} /></label>
      <div className="field" style={{ width: '100%' }}><span>الرقم السري (4 أرقام)</span>
        <div className="dots" aria-label={`اتكتب ${pin.length} من 4`}>{[0, 1, 2, 3].map(i => <i key={i} className={i < pin.length ? 'on' : ''} />)}</div>
      </div>
      {error && <div className="alert-t" role="alert">{error}</div>}
      <div className="keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0'].map(k =>
          <button key={k} onClick={() => press(k)} disabled={!code && k !== '⌫'} aria-label={k === '⌫' ? 'امسح' : k}>{k}</button>)}
      </div>
      <div className="muted" style={{ textAlign: 'center' }}>مش فاكره؟ اسأل الخادم بتاعك يعملك واحد جديد.
        {data.members.some(m => m.example) && <><br />للتجربة: الكود 0001 والرقم 1234</>}</div>
      <Link to="/" className="muted">رجوع لتطبيق الخادم</Link>
    </main>
  );
}
