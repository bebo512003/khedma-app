import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../data/store';
import logo from '../logo.png';
import DeskNav from './DeskNav';

/** In cloud mode, servant screens open only for signed-in servants of this church. */
export default function Gate({ children }: { children: ReactNode }) {
  const { phase, data, user, access, signIn, signOut, startChurch, acceptInvite } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = (fn: () => Promise<void>) => async () => {
    setBusy(true); setError('');
    try { await fn(); } catch (e) { setError(navigator.onLine ? `حصلت مشكلة: ${(e as Error).message}` : 'محتاج نت للخطوة دي.'); }
    setBusy(false);
  };

  if (phase === 'ready' && data) return <><DeskNav />{children}</>;

  const body = (() => {
    if (phase === 'loading' || phase === 'ready') return <div className="muted">بيحمّل…</div>;
    if (phase === 'signedOut') return (
      <>
        <button className="btnp" style={{ width: '100%' }} disabled={busy} onClick={run(signIn)}>ادخل بحساب جوجل</button>
        <Link to="/me" className="btn" style={{ width: '100%' }}>أنا مخدوم</Link>
      </>
    );
    return (
      <>
        <div className="muted">أنت داخل بـ {user?.email}</div>
        {!access?.churchExists ? (
          <>
            <div className="note" style={{ textAlign: 'center' }}>المدرسة لسه مش متسجلة. لو أنت الخادم المسؤول ابدأها دلوقتي، وأي بيانات دخلتها على الموبايل ده هتترفع معاها.</div>
            <button className="btnp" style={{ width: '100%' }} disabled={busy} onClick={run(startChurch)}>ابدأ المدرسة كخادم مسؤول</button>
          </>
        ) : access.invite ? (
          <button className="btnp" style={{ width: '100%' }} disabled={busy} onClick={run(acceptInvite)}>اقبل الدعوة وادخل</button>
        ) : (
          <div className="note" style={{ textAlign: 'center' }}>الإيميل ده لسه مش ضمن الخدام. اطلب من الخادم المسؤول يضيفه من صفحة الفريق، وبعدين ادخل تاني.</div>
        )}
        <button className="btn" style={{ width: '100%' }} onClick={run(signOut)}>ادخل بحساب تاني</button>
      </>
    );
  })();

  return (
    <main className="login gutter">
      <img src={logo} alt="" width={84} height={84} />
      <div style={{ textAlign: 'center' }}><h1>مدرسة الشهيد اسطفانوس للشمامسة</h1><div className="muted">إتعلم … رتل … افرح</div></div>
      {body}
      {error && <div className="alert-t" role="alert">{error}</div>}
      <Link to="/install" className="muted">إزاي أنزّل التطبيق؟</Link>
    </main>
  );
}
