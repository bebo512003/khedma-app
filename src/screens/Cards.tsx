import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { useData, useStore } from '../data/store';
import { hashPin, newPin, titled } from '../data/logic';
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
    <div className="idcard" data-member={m.id}>
      <div className="idcard-band">
        <img src={logo} alt="" />
        <div><b>مدرسة الشهيد اسطفانوس للشمامسة</b><span>إتعلم … رتل … افرح</span></div>
      </div>
      <div className="idcard-body">
        <div className="idcard-info">
          <div className="idcard-photo">{m.photo ? <img src={m.photo} alt="" /> : m.name[0]}</div>
          <b className="idcard-name">{titled(m, level ?? "")}</b>
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
  // A PIN is never kept readable, so printing one for a member who already has a login means giving them a new one.
  const hasPin = members.filter(m => (m.pinHash || m.account) && !pins[m.id]);
  const everyone = members.filter(m => !pins[m.id]);
  const [askReset, setAskReset] = useState(false);

  /** Gives every member on the page who has no login yet a PIN, so the whole level can be handed cards in one go. */
  const makePins = async (noPin: Member[]) => {
    setPinError(''); setAskReset(false);
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

  /** Every card on the page as its own picture (one zip for a level), to send each member theirs on WhatsApp. */
  const [saving, setSaving] = useState<{ n: number; total: number } | null>(null);
  const saveImages = async () => {
    const [{ toPng }, { zipSync }, { download }] = await Promise.all([import('html-to-image'), import('fflate'), import('../data/xlsx')]);
    const files: Record<string, Uint8Array> = {};
    setSaving({ n: 0, total: members.length });
    try {
      for (const [i, m] of members.entries()) {
        const el = document.querySelector<HTMLElement>(`.idcard[data-member="${m.id}"]`);
        if (!el) continue;
        const url = await toPng(el, { pixelRatio: 4, cacheBust: true });
        const bytes = Uint8Array.from(atob(url.split(',')[1]), c => c.charCodeAt(0));
        files[`${m.code} - ${titled(m, data.levels).replace(/[\\/:*?"<>|]/g, '')}.png`] = bytes;
        setSaving({ n: i + 1, total: members.length });
      }
      const names = Object.keys(files);
      // The download's own name stays in English letters: some browsers drop an Arabic one. The pictures inside keep the names.
      if (names.length === 1) download(new Blob([files[names[0]] as BlobPart], { type: 'image/png' }), `card-${members[0].code}.png`);
      else if (names.length) download(new Blob([zipSync(files, { level: 0 }) as BlobPart], { type: 'application/zip' }), `cards-${levels.findIndex(l => l.id === levelId) + 1}.zip`);
    } finally { setSaving(null); }
  };

  return (
    <>
      <header className="top gutter no-print">
        <div className="row between">
          <div className="row"><Link to={one ? `/members/${one}` : '/members'} className="icon" aria-label="رجوع">→</Link><h1>كروت QR</h1></div>
          <div className="row">
            <button className="btn" style={{ minHeight: 44 }} onClick={saveImages} disabled={!members.length || !!saving}>{saving ? `${saving.n} من ${saving.total}` : one ? 'نزّله صورة' : 'نزّل كل كارت صورة'}</button>
            <button className="btnp" style={{ minHeight: 44 }} onClick={() => window.print()} disabled={!members.length}>اطبع</button>
          </div>
        </div>
        {!one && <div className="chips">{levels.map(l =>
          <button key={l.id} className="chip" aria-pressed={levelId === l.id} onClick={() => setLevelId(l.id)}>{l.name}</button>)}</div>}
        {(noPin.length > 0 || hasPin.length > 0 || withPins > 0) && (
          <div className="card">
            <b>كروت دخول التطبيق</b>
            <div className="muted">{noPin.length > 0
              ? `${noPin.length} مخدوم في المستوى ده مالهمش رقم سري. اعملهم أرقام مرة واحدة والرقم يتطبع على كارت كل واحد.`
              : 'كل المخدومين هنا ليهم رقم سري. الرقم مش محفوظ عشان الأمان، فلو عايز تطبعه على الكارت اعمل رقم جديد.'}</div>
            {withPins > 0 && <div className="alert-t">الأرقام السرية دي بتظهر مرة واحدة بس. اطبع الكروت دلوقتي قبل ما تقفل الصفحة.</div>}
            {busy
              ? <><div className="muted">بيعمل الأرقام {busy.n} من {busy.total}</div><div className="progress-bar"><div style={{ width: `${(busy.n / Math.max(1, busy.total)) * 100}%` }} /></div></>
              : <>
                {noPin.length > 0 && <button className="btnp" onClick={() => makePins(noPin)}>اعمل أرقام سرية لـ {noPin.length} مخدوم</button>}
                {hasPin.length > 0 && (askReset
                  ? <div className="alert"><b>هيتعمل رقم سري جديد لـ {everyone.length} مخدوم</b><div className="muted">الرقم القديم لـ {hasPin.length} منهم هيبطل، وكل واحد هيدخل بالرقم اللي على كارته الجديد.</div>
                    <div className="row"><button className="btn grow" onClick={() => setAskReset(false)}>لا</button><button className="btnp grow" onClick={() => makePins(everyone)}>اعمل أرقام جديدة</button></div></div>
                  : <button className={noPin.length ? 'btn' : 'btnp'} onClick={() => setAskReset(true)}>اعمل رقم سري جديد للكل ({everyone.length})</button>)}
              </>}
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
