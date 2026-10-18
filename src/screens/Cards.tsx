import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { useData } from '../data/store';
import type { Member } from '../data/types';
import logo from '../logo.png';

/** The QR opens the member login with the code filled in. It holds the code only; the PIN is still needed. */
export const loginUrl = (code: string) => `${location.origin}${location.pathname}#/me?code=${code}`;

function Card({ m, level }: { m: Member; level?: string }) {
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
        </div>
        <div className="idcard-qr" dangerouslySetInnerHTML={{ __html: svg }} aria-label={`QR للكود ${m.code}`} />
      </div>
    </div>
  );
}

export default function Cards() {
  const [data] = useData();
  const [params] = useSearchParams();
  const one = params.get('member');
  const levels = [...data.levels].sort((a, b) => a.order - b.order);
  const [levelId, setLevelId] = useState(params.get('level') ?? levels.find(l => data.members.some(m => m.levelId === l.id))?.id ?? levels[0]?.id ?? '');
  const members = data.members
    .filter(m => one ? m.id === one : m.levelId === levelId)
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  const levelName = (id: string) => data.levels.find(l => l.id === id)?.name;

  return (
    <>
      <header className="top gutter no-print">
        <div className="row between">
          <div className="row"><Link to={one ? `/members/${one}` : '/members'} className="icon" aria-label="رجوع">→</Link><h1>كروت QR</h1></div>
          <button className="btnp" style={{ minHeight: 44 }} onClick={() => window.print()} disabled={!members.length}>اطبع</button>
        </div>
        {!one && <div className="chips">{levels.map(l =>
          <button key={l.id} className="chip" aria-pressed={levelId === l.id} onClick={() => setLevelId(l.id)}>{l.name}</button>)}</div>}
        <div className="note">في الحصة دوس "اسكان الكروت" ووجّه الكاميرا على كارت كل مخدوم، وهيتسجل حاضر لوحده. والمخدوم كمان يقدر يصوّره يفتحله التطبيق والكود مكتوب. الكارت مقاس كارت البنك، و10 كروت في ورقة A4.</div>
      </header>
      <main className="main gutter wide cards">
        {members.map(m => <Card key={m.id} m={m} level={levelName(m.levelId)} />)}
        {members.length === 0 && <div className="note no-print">مفيش مخدومين في المستوى ده.</div>}
      </main>
    </>
  );
}
