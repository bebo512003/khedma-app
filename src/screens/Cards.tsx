import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { useData, useStore } from '../data/store';
import { hashPin, newPin } from '../data/logic';
import type { Member } from '../data/types';
import logo from '../logo.png';

/** The QR opens the member login with the code filled in. It holds the code only; the PIN is still needed. */
export const loginUrl = (code: string) => `${location.origin}${location.pathname}#/me?code=${code}`;

function Card({ m, level, pin }: { m: Member; level?: string; pin?: string }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    QRCode.toString(loginUrl(m.code), { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#2B0B0D', light: '#0000' } })
      .then(setSvg).catch(() => setSvg(''));
  }, [m.code]);
  return (
    <div className="idcard">
      <div className="idcard-band">
        <img src={logo} alt="" />
        <div><b>مدرسة الشهيد اسطفانوس للشمامسة</b><span>إتعلم … رتل … افرح</span></div>
      </div>
      <div className="idcard-body">
        <div className="idcard-info">
          <div className="idcard-photo">{m.photo ? <img src={m.photo} alt="" /> : m.name[0]}</div>
          <b className="idcard-name">{m.name}</b>
          <span>{[level, m.rank].filter(Boolean).join(' • ')}</span>
          <span className="idcard-code">كود <b dir="ltr">{m.code}</b></span>
          {pin && <span className="idcard-code">رقم سري <b dir="ltr">{pin}</b></span>}
        </div>
        <div className="idcard-qr" dangerouslySetInnerHTML={{ __html: svg }} aria-label={`QR للكود ${m.code}`} />
      </div>
    </div>
  );
}

export default function Cards() {
  const [data, update] = useData();
  const { cloud } = useStore();
  /** PINs made on this page. They're never stored in plain text, so they exist only until the page is closed. */
  const [pins, setPins] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<{ n: number; total: number } | null>(null);
  const [pinError, setPinError] = useState('');
  const [params] = useSearchParams();
  const one = params.get('member');
  const levels = [...data.levels].sort((a, b) => a.order - b.order);
  const [levelId, setLevelId] = useState(params.get('level') ?? levels.find(l => data.members.some(m => m.levelId === l.id))?.id ?? levels[0]?.id ?? '');
  const members = data.members
    .filter(m => one ? m.id === one : m.levelId === levelId)
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  const levelName = (id: string) => data.levels.find(l => l.id === id)?.name;
  const noPin = members.filter(m => !m.pinHash && !m.account && !pins[m.id]);

  /** Gives every member on the page who has no login yet a PIN, so the whole level can be handed cards in one go. */
  const makePins = async () => {
    setPinError('');
    const made: Record<string, string> = {};
    const changes: Record<string, Partial<Member>> = {};
    setBusy({ n: 0, total: noPin.length });
    try {
      const accounts = cloud ? await import('../firebase/accounts') : null;
      for (const [i, m] of noPin.entries()) {
        const pin = newPin();
        changes[m.id] = accounts ? { account: await accounts.createMemberLogin(m, pin) } : { pinHash: await hashPin(m.id, pin) };
        made[m.id] = pin;
        setBusy({ n: i + 1, total: noPin.length });
      }
    } catch (e) {
      const c = (e as { code?: string }).code ?? '';
      setPinError(c.includes('too-many-requests') || c.includes('quota')
        ? `اتعمل ${Object.keys(made).length} من ${noPin.length}. Firebase بيوقف عمل حسابات كتير مرة واحدة، كمّل الباقي بعد ساعة.`
        : `اتعمل ${Object.keys(made).length} من ${noPin.length}، والباقي محتاج نت. جرّب تاني.`);
    }
    update(d => ({ ...d, members: d.members.map(x => changes[x.id] ? { ...x, ...changes[x.id] } : x) }));
    setPins(p => ({ ...p, ...made }));
    setBusy(null);
  };
  const withPins = Object.keys(pins).length;

  return (
    <>
      <header className="top gutter no-print">
        <div className="row between">
          <div className="row"><Link to={one ? `/members/${one}` : '/members'} className="icon" aria-label="رجوع">→</Link><h1>كروت QR</h1></div>
          <button className="btnp" style={{ minHeight: 44 }} onClick={() => window.print()} disabled={!members.length}>اطبع</button>
        </div>
        {!one && <div className="chips">{levels.map(l =>
          <button key={l.id} className="chip" aria-pressed={levelId === l.id} onClick={() => setLevelId(l.id)}>{l.name}</button>)}</div>}
        {!one && (noPin.length > 0 || withPins > 0) && (
          <div className="card">
            <b>كروت دخول التطبيق</b>
            <div className="muted">{noPin.length > 0
              ? `${noPin.length} مخدوم في المستوى ده مالهمش رقم سري. اعملهم أرقام مرة واحدة والرقم يتطبع على كارت كل واحد.`
              : 'كل المخدومين في المستوى ده ليهم رقم سري.'}</div>
            {withPins > 0 && <div className="alert-t">الأرقام السرية دي بتظهر مرة واحدة بس. اطبع الكروت دلوقتي قبل ما تقفل الصفحة.</div>}
            {busy
              ? <><div className="muted">بيعمل الأرقام {busy.n} من {busy.total}</div><div className="progress-bar"><div style={{ width: `${(busy.n / Math.max(1, busy.total)) * 100}%` }} /></div></>
              : noPin.length > 0 && <button className="btnp" onClick={makePins}>اعمل أرقام سرية لـ {noPin.length} مخدوم</button>}
            {pinError && <div className="alert-t" role="alert">{pinError}</div>}
          </div>
        )}
        <div className="note">في الحصة دوس "اسكان الكروت" ووجّه الكاميرا على كارت كل مخدوم، وهيتسجل حاضر لوحده. والمخدوم كمان يقدر يصوّره يفتحله التطبيق والكود مكتوب. الكارت مقاس كارت البنك، و10 كروت في ورقة A4.</div>
      </header>
      <main className="main gutter wide cards">
        {members.map(m => <Card key={m.id} m={m} level={levelName(m.levelId)} pin={pins[m.id]} />)}
        {members.length === 0 && <div className="note no-print">مفيش مخدومين في المستوى ده.</div>}
      </main>
    </>
  );
}
