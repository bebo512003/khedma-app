import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { cloudEnabled } from '../firebase/config';
import type { PushState } from '../firebase/push';

const fb = async (who: 'servant' | 'member') => { const a = await import('../firebase/app'); return who === 'servant' ? a.servantFb() : a.memberFb(); };

/** Turns reminders on for this phone. Shown until they're on; `always` keeps it visible with an off button. */
export default function PushToggle({ who, always }: { who: 'servant' | 'member'; always?: boolean }) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (cloudEnabled) import('../firebase/push').then(p => p.pushState()).then(setState, () => setState('unsupported')); }, []);
  if (!cloudEnabled || !state || state === 'unsupported' || (state === 'on' && !always)) return null;

  const on = async () => {
    setBusy(true); setError('');
    try { setState(await (await import('../firebase/push')).enablePush(await fb(who))); }
    catch (e) { setError(String(e).includes('push key') ? 'التنبيهات لسه بتتجهز، جرّب كمان ساعة.' : 'مقدرناش نفعّل التنبيهات دلوقتي. اتأكد إن معاك نت وجرّب تاني.'); }
    setBusy(false);
  };
  const off = async () => {
    setBusy(true);
    try { await (await import('../firebase/push')).disablePush((await fb(who)).db); setState('off'); } catch { /* stays on */ }
    setBusy(false);
  };

  return (
    <div className="card">
      <b>{state === 'on' ? 'التنبيهات شغالة على الموبايل ده' : 'فعّل التنبيهات'}</b>
      {state === 'needsInstall' && <div className="muted">على الآيفون التنبيهات بتشتغل بس لما تنزّل التطبيق على الشاشة الرئيسية. <Link to="/install">إزاي؟</Link></div>}
      {state === 'denied' && <div className="muted">التنبيهات مقفولة للتطبيق ده من إعدادات الموبايل. افتحها من إعدادات المتصفح للموقع ده وارجع هنا.</div>}
      {state === 'off' && <div className="muted">{who === 'member' ? 'هنفكرك تراجع ألحانك، ونفكرك بالحصة قبلها بيوم.' : 'هيوصلك تنبيه الحصة قبلها بيوم.'}</div>}
      {state === 'off' && <button className="btnp" onClick={on} disabled={busy}>فعّل</button>}
      {state === 'on' && <button className="btn" onClick={off} disabled={busy}>اقفل التنبيهات هنا</button>}
      {error && <div className="alert-t" role="alert">{error}</div>}
    </div>
  );
}
