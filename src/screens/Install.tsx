import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import logo from '../logo.png';

/** Chrome's install prompt, when the browser offers one. */
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let saved: InstallEvent | null = null;
if (typeof window !== 'undefined') window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); saved = e as InstallEvent; });

const ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const installed = () => window.matchMedia('(display-mode: standalone)').matches;

/** How to put the app on a phone and sign in, for members, parents and servants. Open without signing in. */
export default function Install() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(saved);
  const [done, setDone] = useState(installed());
  useEffect(() => {
    const on = (e: Event) => { e.preventDefault(); saved = e as InstallEvent; setPrompt(saved); };
    const ok = () => setDone(true);
    window.addEventListener('beforeinstallprompt', on);
    window.addEventListener('appinstalled', ok);
    return () => { window.removeEventListener('beforeinstallprompt', on); window.removeEventListener('appinstalled', ok); };
  }, []);
  const install = async () => { if (!prompt) return; await prompt.prompt(); if ((await prompt.userChoice).outcome === 'accepted') setDone(true); setPrompt(null); };

  return (
    <main className="main gutter guide">
      <div className="row" style={{ gap: 12 }}>
        <img src={logo} alt="" width={56} height={56} />
        <div><h1>إزاي تنزّل التطبيق</h1><div className="muted">مدرسة الشهيد اسطفانوس للشمامسة</div></div>
      </div>

      {done
        ? <div className="card"><b>التطبيق متنزّل على الجهاز ده.</b><div className="muted">افتحه من أيقونة "St. Stephan SCH".</div></div>
        : prompt
        ? <button className="btnp" onClick={install}>نزّل التطبيق دلوقتي</button>
        : null}

      <div className="card">
        <h2>1. نزّله على الموبايل</h2>
        <div className="muted">مش محتاج متجر تطبيقات. بيتنزّل من المتصفح في ثواني ومساحته صغيرة.</div>
        <div className={ios() ? 'step dim' : 'step'}><b>أندرويد (Chrome)</b>
          <ol><li>افتح اللينك ده في Chrome.</li><li>دوس على التلت نقط ⋮ فوق.</li><li>اختار "تثبيت التطبيق" أو "إضافة للشاشة الرئيسية".</li></ol></div>
        <div className={ios() ? 'step' : 'step dim'}><b>آيفون (Safari)</b>
          <ol><li>افتح اللينك ده في Safari.</li><li>دوس على زرار المشاركة (المربع والسهم لفوق) تحت.</li><li>اختار "إضافة إلى الشاشة الرئيسية" وبعدين "إضافة".</li></ol></div>
        <div className="muted">هتلاقي أيقونة "St. Stephan SCH" على الشاشة، افتح منها على طول.</div>
      </div>

      <div className="card">
        <h2>2. لو أنت مخدوم</h2>
        <ol><li>صوّر الـ QR اللي على كارتك بكاميرا الموبايل، هيفتحلك التطبيق والكود مكتوب. أو اكتب الكود بإيدك.</li>
          <li>اكتب الرقم السري (4 أرقام) اللي على الكارت.</li>
          <li>هتلاقي ألحانك ونقطك وترتيبك وتقييماتك، وتقدر تعدّل صورتك وبياناتك من "بياناتي".</li></ol>
        <div className="muted">نسيت الرقم السري؟ الخادم يعملك واحد جديد. وأول مرة تدخل لازم يكون معاك نت.</div>
        <Link to="/me" className="btn">دخول المخدوم</Link>
      </div>

      <div className="card">
        <h2>3. لو أنت خادم</h2>
        <ol><li>ابعت إيميل الـ Gmail بتاعك للخادم المسؤول عشان يضيفك من صفحة الفريق.</li>
          <li>افتح التطبيق ودوس "ادخل بحساب Google" بنفس الإيميل.</li>
          <li>هتلاقي المستويات اللي اتحددتلك بس، وتقدر تسجّل الحضور والتقييم حتى من غير نت.</li></ol>
        <Link to="/" className="btn">دخول الخادم</Link>
      </div>
    </main>
  );
}
