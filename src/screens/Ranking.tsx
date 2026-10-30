import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAllowedLevel, useData } from '../data/store';
import { monthName, shiftMonth, thisMonth } from '../data/monthReport';
import { hymnsCount, monthBreakdown, ranking, titled } from '../data/logic';
import Icon from '../ui/Icon';

const MEDAL = ['🥇', '🥈', '🥉'];
const KEY = 'khedma.rankLevel';

/** The full month ranking of a level. Members only see the top 3 and their own place; servants see everyone. */
export default function Ranking() {
  const [data] = useData();
  const allowed = useAllowedLevel();
  const nav = useNavigate();
  const levels = [...data.levels].sort((a, b) => a.order - b.order).filter(l => allowed(l.id));
  const [levelId, setLevelId] = useState(() => { try { return localStorage.getItem(KEY) ?? ''; } catch { return ''; } });
  const [month, setMonth] = useState(thisMonth());
  // Until a level is picked, open on the first one that has learners.
  const level = levels.find(l => l.id === levelId) ?? levels.find(l => data.members.some(m => m.levelId === l.id)) ?? levels[0];
  const pick = (id: string) => { setLevelId(id); try { localStorage.setItem(KEY, id); } catch { /* private mode */ } };
  const rows = level ? ranking(data, level.id, month) : [];
  const current = month === thisMonth();
  // Same points share the same place, so a tie never reads as one beating the other.
  const places = rows.map((r, i) => (i && rows[i - 1].points === r.points ? -1 : i + 1));
  for (let i = 1; i < places.length; i++) if (places[i] === -1) places[i] = places[i - 1];

  return (
    <>
      <header className="top gutter"><div className="row between">
        <div className="row">
          <button className="icon" onClick={() => nav(-1)} aria-label="رجوع"><Icon name="back" size={20} /></button>
          <div><h1>ترتيب الدارسين</h1><div className="muted">{monthName(month)}{current ? ' • الترتيب بيتصفّر أول الشهر الجاي' : ''}</div></div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button className="icon" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="الشهر اللي قبله"><Icon name="back" size={18} /></button>
          {!current && <button className="icon" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="الشهر اللي بعده" style={{ transform: 'scaleX(-1)' }}><Icon name="back" size={18} /></button>}
        </div>
      </div></header>
      <main className="main gutter">
        {levels.length > 1 && <div className="chips">
          {levels.map(l => <button key={l.id} className="chip" aria-pressed={l.id === level?.id} onClick={() => pick(l.id)}>{l.name}</button>)}
        </div>}
        {!level ? <div className="note">مفيش مستويات مسموحلك بيها.</div>
          : !rows.length ? <div className="note">مفيش دارسين في {level.name}.</div>
          : <div className="card"><div className="list">
            {rows.map((r, i) => {
              const b = monthBreakdown(data, r.member.id, month);
              const p = places[i];
              return (
                <Link key={r.member.id} to={`/members/${r.member.id}`} className="li">
                  <b style={{ width: 28, textAlign: 'center', fontSize: p <= 3 && r.points > 0 ? 20 : undefined }}>{p <= 3 && r.points > 0 ? MEDAL[p - 1] : p}</b>
                  <span className="av">{r.member.photo ? <img src={r.member.photo} alt="" /> : r.member.name[0]}</span>
                  <div className="grow"><b>{titled(r.member, data.levels)}</b>
                    <div className="muted">نقط الحضور {b.attendance} • التقييم {b.rating}{b.memorized ? ` • حفظ ${hymnsCount(b.memorized)}` : ''}{b.solo ? ` • قال لوحده ${hymnsCount(b.solo)}` : ''}</div></div>
                  <b>{r.points}</b>
                </Link>
              );
            })}
          </div></div>}
        <div className="note">النقط من الحضور وتقييم كل حصة، وزيادة لما حد يوصل "حافظه" أو "بيقوله لوحده" في لحن. نفس النقط يعني نفس المركز.</div>
      </main>
    </>
  );
}
