import { hymnLabel } from '../data/parts';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAllowedLevel, useCan, useData } from '../data/store';
import { LATE_GRACE_MIN, currentTerm, curriculumKey, formatDay, lateBy, todayISO, uid } from '../data/logic';

/** Every saved session, newest first; tapping one opens it to check, correct or delete. */
export default function Sessions() {
  const [data, update] = useData();
  const allowed = useAllowedLevel();
  const canAdd = useCan('sessions');
  const nav = useNavigate();
  const [old, setOld] = useState<{ levelId: string; date: string; hymnId: string; summary: string } | null>(null);
  /** A past session recorded by its date only: no attendance or ratings, so it changes nobody's points or absences. */
  const addOld = () => {
    if (!old?.levelId || !old.date) return;
    const id = uid();
    const term = currentTerm(data, old.date);
    update(d => ({ ...d, sessions: [...d.sessions, {
      id, date: old.date, levelId: old.levelId, termId: term?.id ?? '', hymnIds: old.hymnId ? [old.hymnId] : [],
      attendance: {}, ratings: {}, savedAt: Date.now(), ...(old.summary.trim() ? { summary: old.summary.trim() } : {}),
    }] }));
    setOld(null);
    nav(`/summary/${id}`);
  };
  const oldTerm = old ? currentTerm(data, old.date || todayISO()) : undefined;
  const oldHymns = old && oldTerm ? (data.curricula[curriculumKey(oldTerm.id, old.levelId)] ?? []).map(h => data.hymns.find(x => x.id === h)).filter(h => !!h) : [];
  const levels = [...data.levels].sort((a, b) => a.order - b.order).filter(l => allowed(l.id));
  const [levelId, setLevelId] = useState('');
  const sessions = data.sessions.filter(s => allowed(s.levelId) && (!levelId || s.levelId === levelId)).sort((a, b) => b.date.localeCompare(a.date) || (b.startedAt ?? 0) - (a.startedAt ?? 0) || (b.savedAt ?? 0) - (a.savedAt ?? 0));

  return (
    <>
      <header className="top gutter"><h1>سجل الحصص</h1><div className="muted">دوس على أي حصة تشوفها أو تعدلها أو تمسحها</div></header>
      <main className="main gutter">
        {canAdd && !old && <button className="btn" onClick={() => setOld({ levelId: levels[0]?.id ?? '', date: '', hymnId: '', summary: '' })}>سجّل حصة قديمة بالتاريخ بس</button>}
        {old && <div className="card">
          <h2>حصة قديمة</h2>
          <div className="note">بتتسجل من غير حضور ولا تقييم، فمش بتغيّر نقط ولا غياب حد. تقدر تضيف الحضور بعدين من تعديل الحصة لو حبيت.</div>
          <label className="field"><span>المستوى</span>
            <select className="input" value={old.levelId} onChange={e => setOld({ ...old, levelId: e.target.value, hymnId: '' })}>
              {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
          <label className="field"><span>كانت امتى؟</span>
            <input className="input" type="date" max={todayISO()} value={old.date} onChange={e => setOld({ ...old, date: e.target.value })} /></label>
          <label className="field"><span>لحن الحصة (اختياري)</span>
            <select className="input" value={old.hymnId} onChange={e => setOld({ ...old, hymnId: e.target.value })}>
              <option value="">من غير لحن</option>
              {oldHymns.map(h => <option key={h.id} value={h.id}>{h.nameAr}</option>)}</select></label>
          <label className="field"><span>اتعمل فيها إيه؟ (اختياري)</span>
            <textarea className="input" rows={2} value={old.summary} onChange={e => setOld({ ...old, summary: e.target.value })} /></label>
          <div className="row"><button className="btn grow" onClick={() => setOld(null)}>إلغاء</button>
            <button className="btnp grow" disabled={!old.date || !old.levelId} onClick={addOld}>سجّلها</button></div>
        </div>}
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
                  <div className="muted">{data.levels.find(l => l.id === s.levelId)?.name}{hymn ? ` • ${hymnLabel(hymn, s.partId)}` : ''}</div></div>
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
