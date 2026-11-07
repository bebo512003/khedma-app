import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { STATUS_LABELS } from '../data/types';
import { formatDay, isoDate } from '../data/logic';
import { Bell, useNotes, useView } from './Layout';
import Submit from './Submit';

/** «التسميع»: pick a hymn of this term (and its part, if it's split), record it, and see the servants' replies. */
export default function Recite() {
  const v = useView();
  const { subs } = useNotes();
  const [q, setQ] = useSearchParams();
  const hymn = v.hymns.find(h => h.id === q.get('h'));
  const [part, setPart] = useState<string | undefined>(() => q.get('part') ?? undefined);
  const pick = (id: string, p?: string) => { setPart(p); setQ(p ? { h: id, part: p } : { h: id }, { replace: true }); };
  const waiting = subs.filter(s => s.pending).length;

  return (
    <>
      <header className="top gutter"><div className="row between">
        <div><h1>التسميع</h1><div className="muted">سجّل اللحن من البيت والخادم هيسمعه ويرد عليك</div></div>
        <Bell />
      </div></header>
      <main className="main gutter recite">
        {waiting > 0 && <div className="note">عندك {waiting} تسميع مستني رد الخادم.</div>}
        {v.hymns.length === 0 && <div className="card"><div className="note">مفيش ألحان في منهج الترم لسه.</div></div>}
        {!hymn && v.hymns.length > 0 && <div className="card" style={{ paddingBlock: 4 }}><div className="list">
          <div className="muted" style={{ paddingTop: 8 }}>اختار اللحن اللي هتسمّعه</div>
          {v.hymns.map(h => (
            <div key={h.id}>
              <button className="li" style={h.parts?.length ? { borderBottom: 0 } : undefined} onClick={() => pick(h.id, h.parts?.length ? h.parts.find(p => (h.partStatus?.[p.id] ?? 0) < 2)?.id ?? h.parts[0].id : undefined)}>
                <b className="grow" style={{ textAlign: 'start' }}>{h.nameAr}{h.parts?.length ? <span className="muted"> • {h.parts.length} أجزاء</span> : null}</b>
                <span className={`pill st${h.status}`}>{STATUS_LABELS[h.status]}</span>
              </button>
              {h.parts?.length ? <div className="chips parts">{h.parts.map(p => {
                const s = h.partStatus?.[p.id] ?? 0;
                return <button key={p.id} className={`chip st${s}`} onClick={() => pick(h.id, p.id)} aria-label={`${p.name}: ${STATUS_LABELS[s]}`}>{p.name}{s >= 2 ? ' ✓' : ''}</button>;
              })}</div> : null}
            </div>
          ))}
        </div></div>}
        {hymn && <>
          <div className="row between">
            <div><b>{hymn.nameAr}</b>{hymn.nameCoptic && <div className="muted">{hymn.nameCoptic}</div>}</div>
            <button className="btn" onClick={() => setQ({}, { replace: true })}>غيّر اللحن</button>
          </div>
          <Submit hymnId={hymn.id} hymnName={hymn.nameAr} parts={hymn.parts} part={part} onPart={p => pick(hymn.id, p)} />
          <Link className="btn" to={`/me/hymn/${hymn.id}${part ? `?part=${part}` : ''}`}>افتح نص اللحن وتسجيلاته</Link>
        </>}
        {!hymn && subs.length > 0 && <div className="card">
          <h2>آخر تسميعاتك</h2>
          <div className="list">{subs.slice(0, 8).map(s => (
            <button key={s.id} className="li" onClick={() => pick(s.hymnId, s.partId)}>
              <div className="grow" style={{ textAlign: 'start' }}><b>{s.hymnName}{s.partName ? ` (${s.partName})` : ''}</b><div className="muted">{formatDay(isoDate(new Date(s.at)))}</div></div>
              {s.pending ? <span className="tag">مستني الرد</span> : s.review && <span className={`pill st${s.review.status}`}>{STATUS_LABELS[s.review.status]}</span>}
            </button>
          ))}</div>
        </div>}
      </main>
    </>
  );
}
