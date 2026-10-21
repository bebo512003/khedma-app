import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../data/store';
import logo from '../logo.png';
import DeskNav from './DeskNav';
import MobileNav from './MobileNav';
import { OpenDoor, SCHOOL } from './Open';
import Icon from '../ui/Icon';
import PhoneSignIn from './PhoneSignIn';

/** In cloud mode, servant screens open only for signed-in servants of this church. */
export default function Gate({ children }: { children: ReactNode }) {
  const { phase, data, user, access, signIn, signOut, startChurch, acceptInvite, syncError } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [byPhone, setByPhone] = useState(false);
  const run = (fn: () => Promise<void>) => async () => {
    setBusy(true); setError('');
    try { await fn(); } catch (e) { setError(navigator.onLine ? `حصلت مشكلة: ${(e as Error).message}` : 'محتاج نت للخطوة دي.'); }
    setBusy(false);
  };

  if (phase === 'ready' && data) return <><DeskNav />{children}<MobileNav /></>;

  const body = (() => {
    if (phase === 'loading' || phase === 'ready') return <>
      <div className="muted">بيحمّل…</div>
      {syncError && <div className="note" dir="ltr">{syncError}</div>}
    </>;
    if (phase === 'signedOut') return byPhone ? <PhoneSignIn onBack={() => setByPhone(false)} /> : (
      <>
        <button className="btnp" style={{ width: '100%' }} disabled={busy} onClick={run(signIn)}>ادخل بحساب جوجل</button>
        <button className="btn" style={{ width: '100%' }} onClick={() => setByPhone(true)}>خادم؟ ادخل برقم الموبايل</button>
        <Link to="/me" className="btn" style={{ width: '100%' }}>أنا مخدوم</Link>
      </>
    );
    return (
      <>
        <div className="muted">أنت داخل بـ <span dir="ltr">{user?.email && !user.email.endsWith('.khedma.app') ? user.email : user?.phoneNumber?.replace(/^\+2/, '')}</span></div>
        {!access?.churchExists ? (
          <>
            <div className="note" style={{ textAlign: 'center' }}>المدرسة لسه مش متسجلة. لو أنت الخادم المسؤول ابدأها دلوقتي، وأي بيانات دخلتها على الموبايل ده هتترفع معاها.</div>
            <button className="btnp" style={{ width: '100%' }} disabled={busy} onClick={run(startChurch)}>ابدأ المدرسة كخادم مسؤول</button>
          </>
        ) : access.invite ? (
          <button className="btnp" style={{ width: '100%' }} disabled={busy} onClick={run(acceptInvite)}>اقبل الدعوة وادخل</button>
        ) : (
          <div className="card" style={{ textAlign: 'center', width: '100%' }}>
            <b>التطبيق ده داخلي لخدام مدرسة الشهيد اسطفانوس</b>
            <div className="note">الحساب ده مش ضمن خدام المدرسة. لو انت خادم معانا، اطلب من الخادم المسؤول يضيف إيميلك أو رقمك من صفحة الفريق وادخل تاني. ولأي استفسار كلّمنا على واتساب.</div>
            <a className="btnp" href={`https://wa.me/2${SCHOOL.phone}`} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" size={20} /> كلّم المدرسة على واتساب</a>
          </div>
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
      {phase === 'signedOut' && <OpenDoor />}
      <Link to="/install" className="muted">إزاي أنزّل التطبيق؟</Link>
    </main>
  );
}
