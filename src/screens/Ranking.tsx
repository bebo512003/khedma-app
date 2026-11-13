import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAllowedLevel, useData } from '../data/store';
import { monthName, shiftMonth, thisMonth } from '../data/monthReport';
import { medal, pointsWhy, monthBreakdown, POINTS, ranking, titled } from '../data/logic';
import { download, xlsxBlob } from '../data/xlsx';
import { BackButton } from '../ui/back';

const KEY = 'khedma.rankLevel';

/** The full month ranking of a level. Members only see the top 3 and their own place; servants see everyone. */
export default function Ranking() {
  const [data] = useData();
  const allowed = useAllowedLevel();
  const levels = [...data.levels].sort((a, b) => a.order - b.order).filter(l => allowed(l.id));
  const [levelId, setLevelId] = useState(() => { try { return localStorage.getItem(KEY) ?? ''; } catch { return ''; } });
  // Early in a month with no sessions yet, open on last month's final ranking instead of a list of zeros.
  const [month, setMonth] = useState(() => data.sessions.some(x => x.date.startsWith(thisMonth())) ? thisMonth() : shiftMonth(thisMonth(), -1));
  // Until a level is picked, open on the first one that has learners.
  const level = levels.find(l => l.id === levelId) ?? levels.find(l => data.members.some(m => m.levelId === l.id)) ?? levels[0];
  const pick = (id: string) => { setLevelId(id); try { localStorage.setItem(KEY, id); } catch { /* private mode */ } };
  const rows = level ? ranking(data, level.id, month) : [];
  const current = month === thisMonth();
  // Every month from the first session to now, newest first, to jump straight to any of them.
  const first = data.sessions.reduce((a, x) => (x.date.slice(0, 7) < a ? x.date.slice(0, 7) : a), thisMonth());
  const months: string[] = [];
  for (let m = thisMonth(); m >= first && months.length < 120; m = shiftMonth(m, -1)) months.push(m);
  const exportSheet = () => {
    if (!level) return;
    const head = ['المركز', 'الوسام', 'الكود', 'الاسم', 'نقط الحضور', 'التقييم', 'وصل حافظه', 'قاله لوحده', 'المجموع'];
    const body = rows.map(r => { const b = monthBreakdown(data, r.member.id, month); return [r.place, medal(r.place, r.points)?.name ?? '', r.member.code ?? '', titled(r.member, data.levels), b.attendance, b.rating, b.memorized, b.solo, r.points]; });
    download(xlsxBlob([{ name: 'الترتيب', rows: [head, ...body], widths: [8, 9, 8, 26, 11, 9, 10, 10, 9] }]), `ترتيب ${level.name} - ${monthName(month)}.xlsx`);
  };
  // Same points share the same place, so a tie never reads as one beating the other.

  return (
    <>
      <header className="top gutter"><div className="row between">
        <div className="row">
          <BackButton />
          <div><h1>ترتيب الدارسين</h1><div className="muted">{monthName(month)}{current ? ' • الترتيب بيتصفّر أول الشهر الجاي' : ''}</div></div>
        </div>
      </div></header>
      <main className="main gutter">
        <label className="row" style={{ gap: 8 }}><span className="muted">الشهر</span>
          <select className="input grow" value={month} onChange={e => setMonth(e.target.value)}>
            {months.map(m => <option key={m} value={m}>{monthName(m)}</option>)}
          </select></label>
        {levels.length > 1 && <div className="chips">
          {levels.map(l => <button key={l.id} className="chip" aria-pressed={l.id === level?.id} onClick={() => pick(l.id)}>{l.name}</button>)}
        </div>}
        {!level ? <div className="note">مفيش مستويات مسموحلك بيها.</div>
          : !rows.length ? <div className="note">مفيش دارسين في {level.name}.</div>
          : <div className="card"><div className="list">
            {rows.map(r => {
              const b = monthBreakdown(data, r.member.id, month);
              const md = medal(r.place, r.points);
              return (
                <Link key={r.member.id} to={`/members/${r.member.id}`} className={md ? `li medal ${md.cls}` : 'li'}>
                  <b className="place">{md ? <><span>{md.icon}</span><small>{md.name}</small></> : r.place}</b>
                  <span className="av">{r.member.photo ? <img src={r.member.photo} alt="" /> : r.member.name[0]}</span>
                  <div className="grow"><b>{titled(r.member, data.levels)}</b>
                    <div className="muted">{pointsWhy(b, r.member.gender === 'f')}</div></div>
                  <b>{r.points}</b>
                </Link>
              );
            })}
          </div></div>}
        {rows.length > 0 && <button className="btn" onClick={exportSheet}>نزّل الترتيب إكسيل</button>}
        <Link className="btn" to="/coupons">{data.coupons ? 'الكوبونات وأرصدة الأوائل' : 'شغّل كوبونات الأوائل كل شهر'}</Link>
        <div className="note">النقط من الحضور ({POINTS.attendance} للحصة) وتقييم كل حصة، ونقط كل لحن لما حد يوصل "حافظه" أو "بيقوله لوحده" فيه (الأصلي {POINTS.memorized} و{POINTS.solo}، والخادم المسؤول بيغيرها من تعديل اللحن)، في الحصة أو لما يسمّع لايف أو من الأبلكيشن. لو النقط اتساوت، الأعلى اللي حضر أكتر، ولو الحضور اتساوى، اللي ماشي أكتر في ألحان الترم، وبعدها تقييم الحصص، وبعدها اللي اتأخر أقل. اللي متساويين في كل ده بياخدوا نفس المركز.</div>
      </main>
    </>
  );
}
