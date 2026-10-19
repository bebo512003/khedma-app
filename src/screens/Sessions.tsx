import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAllowedLevel, useData } from '../data/store';
import { LATE_GRACE_MIN, formatDay, lateBy } from '../data/logic';

/** Every saved session, newest first; tapping one opens it to check, correct or delete. */
export default function Sessions() {
  const [data] = useData();
  const allowed = useAllowedLevel();
  const levels = [...data.levels].sort((a, b) => a.order - b.order).filter(l => allowed(l.id));
  const [levelId, setLevelId] = useState('');
  const sessions = data.sessions.filter(s => allowed(s.levelId) && (!levelId || s.levelId === levelId)).sort((a, b) => b.date.localeCompare(a.date) || (b.startedAt ?? 0) - (a.startedAt ?? 0));

  return (
    <>
      <header className="top gutter"><h1>سجل الحصص</h1><div className="muted">دوس على أي حصة تشوفها أو تعدلها أو تمسحها</div></header>
      <main className="main gutter">
        {levels.length > 1 && <div className="chips">
          <button className="chip" aria-pressed={!levelId} onClick={() => setLevelId('')}>الكل</button>
          {levels.map(l => <button key={l.id} className="chip" aria-pressed={levelId === l.id} onClick={() => setLevelId(l.id)}>{l.name}</button>)}
        </div>}
        {sessions.length === 0 && <div className="card"><div className="note">لسه مفيش حصص متسجلة.</div></div>}
        {sessions.length > 0 && <div className="card" style={{ paddingBlock: 4 }}><div className="list">
          {sessions.map(s => {
            const ids = Object.keys(s.attendance);
            const present = ids.filter(id => s.attendance[id] === 'p');
            const late = present.filter(id => (lateBy(s, id) ?? 0) > LATE_GRACE_MIN).length;
            const hymn = data.hymns.find(h => h.id === s.hymnIds[0]);
            return (
              <Link key={s.id} to={`/summary/${s.id}`} className="li">
                <div className="grow"><b>{formatDay(s.date)}</b>
                  <div className="muted">{data.levels.find(l => l.id === s.levelId)?.name}{hymn ? ` • ${hymn.nameAr}` : ''}</div></div>
                <div style={{ textAlign: 'center' }}><b>{present.length}/{ids.length}</b><div className="muted">حضروا</div></div>
                {late > 0 && <span className="tag tag-alert">{late} اتأخروا</span>}
              </Link>
            );
          })}
        </div></div>}
      </main>
    </>
  );
}
