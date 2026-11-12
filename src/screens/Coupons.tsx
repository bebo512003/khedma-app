import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAllowedLevel, useCan, useData, useIsLead } from '../data/store';
import { monthName, thisMonth } from '../data/monthReport';
import { MEDALS, titled, todayISO, uid, formatDay } from '../data/logic';
import { COUPON_DEFAULTS, closedMonths, couponLedger, monthWinners, type Winner } from '../data/coupons';
import { BackButton } from '../ui/back';

type Tab = 'month' | 'balance' | 'settings';

/** Monthly coupons: print each ended month's winners, keep everyone's balance, and take coupons off for gifts. */
export default function Coupons() {
  const [data, update] = useData();
  const lead = useIsLead(), canMembers = useCan('members');
  const allowed = useAllowedLevel();
  const on = !!data.coupons;
  const months = closedMonths(data);
  const [tab, setTab] = useState<Tab>(on ? 'month' : 'settings');
  // The month just ended first; this month can be previewed before it ends.
  const [picked, setMonth] = useState<string>();
  const month = picked ?? months[months.length - 1] ?? thisMonth();
  const winners = useMemo(() => monthWinners(data, month).filter(w => allowed(w.levelId)), [data, month, allowed]);
  const level = (id: string) => data.levels.find(l => l.id === id)?.name ?? '';

  const settings = (
    <Settings key={JSON.stringify(data.coupons)} lead={lead} />
  );

  return (
    <>
      <header className="top gutter no-print"><div className="row">
        <BackButton />
        <div><h1>الكوبونات</h1><div className="muted">الأوائل كل شهر بياخدوا كوبونات بتتجمع في رصيدهم</div></div>
      </div>
        {on && <div className="seg" role="group" aria-label="الكوبونات">
          {([['month', 'كوبونات الشهر'], ['balance', 'الأرصدة'], ['settings', 'الإعدادات']] as const).map(([k, l]) =>
            <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>)}
        </div>}
      </header>
      <main className="main gutter coupons">
        {(!on || tab === 'settings') && settings}

        {on && tab === 'month' && <>
          <label className="row no-print" style={{ gap: 8 }}><span className="muted">الشهر</span>
            <select className="input grow" value={month} onChange={e => setMonth(e.target.value)}>
              {[...months].reverse().map(m => <option key={m} value={m}>{monthName(m)}</option>)}
              {!months.includes(thisMonth()) && <option value={thisMonth()}>{monthName(thisMonth())} (لسه مخلصش)</option>}
            </select></label>
          {month === thisMonth() && <div className="note no-print">الشهر ده لسه مخلصش، فده الترتيب لحد النهارده. الكوبونات بتدخل الرصيد أول الشهر الجاي.</div>}
          {winners.length === 0 ? <div className="note">مفيش حد خد نقط في {monthName(month)}.</div> : <>
            <button className="btnp no-print" onClick={() => window.print()}>اطبع الكوبونات ({winners.length})</button>
            <div className="coupon-grid">{winners.map(w => <CouponCard key={w.member.id + w.levelId} w={w} month={month} level={level(w.levelId)} name={titled(w.member, data.levels)} />)}</div>
          </>}
        </>}

        {on && tab === 'balance' && <Balances canSpend={lead && canMembers} />}
      </main>
    </>
  );

  function Settings({ lead }: { lead: boolean }) {
    const c = data.coupons ?? COUPON_DEFAULTS;
    const [values, setValues] = useState(c.values.map(String));
    const [since, setSince] = useState(c.since);
    const first = data.sessions.reduce((a, x) => (x.date.slice(0, 7) < a ? x.date.slice(0, 7) : a), thisMonth());
    const opts: string[] = [];
    for (let m = thisMonth(); m >= first && opts.length < 60;) { opts.push(m); const [y, mo] = m.split('-').map(Number); m = mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`; }
    const save = () => { const first = !data.coupons; update(d => ({ ...d, coupons: { values: values.map(v => Math.max(0, Math.min(10000, parseInt(v, 10) || 0))), since } })); if (first) setTab('month'); };
    return (
      <div className="card">
        <h2>كوبونات كل مركز</h2>
        <div className="note">لما الشهر يخلص، الأول والتاني والتالت في كل مستوى بياخدوا الكوبونات دي، وبتتجمع في رصيدهم من شهر للتاني، والترتيب نفسه بيتصفّر عادي. لو اتنين متساويين في المركز، الاتنين بياخدوه.</div>
        <div className="row" style={{ gap: 8 }}>
          {values.map((v, i) => (
            <label key={i} className="field grow" htmlFor={`cv${i}`}><span>{MEDALS[i]?.icon} المركز {i + 1}</span>
              <input id={`cv${i}`} className="input" inputMode="numeric" value={v} disabled={!lead} onChange={e => setValues(x => x.map((y, j) => j === i ? e.target.value.replace(/\D/g, '') : y))} /></label>
          ))}
        </div>
        <label className="field" htmlFor="csince"><span>بيبدأ من شهر</span>
          <select id="csince" className="input" value={since} disabled={!lead} onChange={e => setSince(e.target.value)}>
            {opts.map(m => <option key={m} value={m}>{monthName(m)}</option>)}
          </select></label>
        {lead ? <button className="btnp" onClick={save}>{data.coupons ? 'احفظ' : 'شغّل الكوبونات'}</button>
          : <div className="note">الخادم المسؤول بس اللي يغير الإعدادات دي.</div>}
      </div>
    );
  }

  function Balances({ canSpend }: { canSpend: boolean }) {
    const [open, setOpen] = useState<string | null>(null);
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const cache = new Map<string, Winner[]>();
    const rows = data.members.filter(m => allowed(m.levelId)).map(m => ({ m, l: couponLedger(data, m.id, cache) }))
      .filter(r => r.l.total > 0 || r.l.used > 0).sort((a, b) => b.l.balance - a.l.balance);
    const spend = (id: string, max: number) => {
      const n = Math.min(max, parseInt(amount, 10) || 0);
      if (n <= 0) return;
      update(d => ({ ...d, members: d.members.map(m => m.id === id ? { ...m, spent: [...(m.spent ?? []), { id: uid(), date: todayISO(), amount: n, ...(note.trim() ? { note: note.trim().slice(0, 80) } : {}) }] } : m) }));
      setOpen(null); setAmount(''); setNote('');
    };
    if (!rows.length) return <div className="note">لسه محدش خد كوبونات. أول ما شهر يخلص، الأوائل هيظهروا هنا.</div>;
    return (
      <div className="card" style={{ paddingBlock: 4 }}><div className="list">
        {rows.map(({ m, l }) => (
          <div key={m.id} className="li" style={{ flexWrap: 'wrap' }}>
            <span className="av">{m.photo ? <img src={m.photo} alt="" /> : m.name[0]}</span>
            <div className="grow"><Link to={`/members/${m.id}`} style={{ color: 'inherit' }}><b>{titled(m, data.levels)}</b></Link>
              <div className="muted">خد {l.total}{l.used ? ` • صرف ${l.used}` : ''}</div></div>
            <b className="coupon-bal">{l.balance}</b>
            {canSpend && l.balance > 0 && <button className="chip" onClick={() => setOpen(open === m.id ? null : m.id)} aria-expanded={open === m.id}>صرف</button>}
            {open === m.id && <div className="row" style={{ width: '100%', gap: 6, flexWrap: 'wrap' }}>
              <input className="input" style={{ width: 90 }} inputMode="numeric" aria-label="عدد الكوبونات" placeholder="كام" value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g, ''))} />
              <input className="input grow" aria-label="الهدية" placeholder="خد إيه؟ (اختياري)" value={note} maxLength={80} onChange={e => setNote(e.target.value)} />
              <button className="btnp" onClick={() => spend(m.id, l.balance)} disabled={!amount}>اخصم</button>
            </div>}
            {l.spent.length > 0 && <div className="muted" style={{ width: '100%', fontSize: 12 }}>{l.spent.map(s => `${formatDay(s.date)}: ${s.amount}${s.note ? ` (${s.note})` : ''}`).join(' • ')}</div>}
          </div>
        ))}
      </div></div>
    );
  }
}

/** A coupon to print and hand out. */
function CouponCard({ w, month, level, name }: { w: Winner; month: string; level: string; name: string }) {
  const md = MEDALS[w.place - 1];
  return (
    <div className={`coupon ${md?.cls ?? ''}`}>
      <div className="c-head"><b>St. Stephan SCH</b><span>مدرسة الشمامسة والألحان</span></div>
      <div className="c-body">
        <div className="c-medal">{md?.icon}<small>المركز {w.place}</small></div>
        <div className="c-main"><div className="c-name">{name}</div><div className="c-sub">{level} • {monthName(month)}</div></div>
        <div className="c-val"><b>{w.value}</b><small>كوبون</small></div>
      </div>
      <div className="c-foot">بيتجمع في رصيدك ويتبدل بهدية</div>
    </div>
  );
}
