import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAllowedLevel, useData } from '../data/store';
import { LATE_GRACE_MIN, absenceStreak, formatDay, formatTime, lateBy, needsFollowUp, sessionAverage } from '../data/logic';
import FollowUpList from './FollowUpList';
import Icon from '../ui/Icon';

const fmt = (ms = 0) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/** One saved session: right after it ends, and from the session log, where it can be corrected or deleted. */
export default function Summary() {
  const { sessionId } = useParams();
  const [data, update] = useData();
  const nav = useNavigate();
  const fresh = !!(useLocation().state as { fresh?: boolean } | null)?.fresh;
  const allowed = useAllowedLevel();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const s = data.sessions.find(x => x.id === sessionId && allowed(x.levelId));
  if (!s) return <main className="main gutter"><div className="card">الحصة دي مش موجودة. <Link to="/sessions">سجل الحصص</Link></div></main>;

  const level = data.levels.find(l => l.id === s.levelId);
  const hymn = data.hymns.find(h => h.id === s.hymnIds[0]);
  const name = (id: string) => data.members.find(m => m.id === id)?.name ?? 'مخدوم اتمسح';
  const ids = Object.keys(s.attendance);
  const present = ids.filter(id => s.attendance[id] === 'p');
  const excused = ids.filter(id => s.attendance[id] === 'e');
  const absent = ids.filter(id => s.attendance[id] === 'a');
  const avgs = present.map(id => sessionAverage(s, id)).filter((x): x is number => x !== null);
  const avg = avgs.length ? (avgs.reduce((a, b) => a + b, 0) / avgs.length).toFixed(1) : '–';
  const followUp = data.members.filter(m => m.levelId === s.levelId && s.attendance[m.id] === 'a' && needsFollowUp(absenceStreak(data, m)));
  const ms = Object.values(s.milestones ?? {});
  const memorized = ms.reduce((a, m) => a + m.memorized, 0), solo = ms.reduce((a, m) => a + m.solo, 0);
  const scanned = present.filter(id => s.arrivals?.[id]).sort((a, b) => s.arrivals![a] - s.arrivals![b]);
  const late = scanned.filter(id => (lateBy(s, id) ?? 0) > LATE_GRACE_MIN);
  const remove = () => { update(d => ({ ...d, sessions: d.sessions.filter(x => x.id !== s.id) })); nav('/sessions', { replace: true }); };

  return (
    <>
      <header className="top gutter">
        <div className="row between">
          {!fresh && <button className="icon" onClick={() => nav(-1)} aria-label="رجوع"><Icon name="back" size={20} /></button>}
          <div className="grow"><h1>{fresh ? 'اتحفظت الحصة' : `حصة ${level?.name ?? ''}`}</h1>
            <div className="muted">{fresh ? `${level?.name} • ` : ''}{formatDay(s.date)}{hymn ? ` • ${hymn.nameAr}` : ''}</div></div>
          <Link to={`/sessions/${s.id}/edit`} className="icon" aria-label="تعديل الحصة"><Icon name="edit" size={20} /></Link>
        </div>
      </header>
      <main className="main gutter">
        <div className="hero">
          <div className="row" style={{ gap: 24 }}>
            <div><div className="big">{fmt(s.durationMs)}</div><div className="muted" style={{ color: 'var(--on-hero)' }}>وقت تسجيل الحصة</div></div>
            {s.startedAt && <div><div className="big">{formatTime(s.startedAt)}</div><div className="muted" style={{ color: 'var(--on-hero)' }}>ميعاد البداية</div></div>}
          </div>
          {memorized + solo > 0 && <div>اتقدّموا في الألحان: {memorized ? `${memorized} وصلوا "حافظه"` : ''}{memorized && solo ? ' و' : ''}{solo ? `${solo} وصلوا "بيقوله لوحده"` : ''}</div>}
        </div>
        <div className="card"><div className="stats">
          <div className="stat"><b>{present.length} / {ids.length}</b><span className="muted">حضروا</span></div>
          <div className="stat"><b>{late.length}</b><span className="muted">اتأخروا</span></div>
          <div className="stat"><b>{avg}</b><span className="muted">متوسط التقييم</span></div>
        </div></div>

        {scanned.length > 0 && (
          <div className="card">
            <h2>مواعيد الوصول</h2>
            <div className="list">
              {scanned.map(id => {
                const l = lateBy(s, id) ?? 0;
                return (
                  <div key={id} className="li">
                    <b className="grow">{name(id)}</b>
                    {l > LATE_GRACE_MIN && <span className="tag tag-alert">متأخر {l} د</span>}
                    <span className="muted">{formatTime(s.arrivals![id])}</span>
                  </div>
                );
              })}
            </div>
            {present.length > scanned.length && <div className="note">{present.length - scanned.length} اتسجلوا حاضرين من غير اسكان، فمالهمش ميعاد وصول.</div>}
            {!s.startedAt && <div className="note">الحصة دي مالهاش ميعاد بداية، فمش محسوب مين اتأخر. حطه من تعديل الحصة.</div>}
          </div>
        )}

        <div className="card">
          <h2>الحضور</h2>
          {[['حضروا', present], ['اعتذروا', excused], ['غابوا', absent]].map(([label, list]) => (list as string[]).length > 0 && (
            <div key={label as string}><b>{label}</b> <span className="muted">({(list as string[]).length})</span>
              <div className="note">{(list as string[]).map(name).join('، ')}</div></div>
          ))}
        </div>

        {fresh && (followUp.length > 0
          ? <FollowUpList members={followUp} />
          : <div className="card"><div className="note">مفيش حد محتاج افتقاد من الحصة دي.</div></div>)}

        {!fresh && (confirmDelete
          ? <div className="card alert"><b>تمسح حصة {formatDay(s.date)}؟</b>
            <div className="note">الحضور والتقييمات والنقط بتاعتها هتتشال. مستوى الألحان اللي اتغير فيها هيفضل زي ما هو.</div>
            <div className="row"><button className="btn grow" onClick={() => setConfirmDelete(false)}>لا</button><button className="btnp grow" onClick={remove}>امسح</button></div></div>
          : <button className="btn" onClick={() => setConfirmDelete(true)}>امسح الحصة</button>)}
      </main>
      {fresh && <div className="bar gutter"><div><Link to="/sessions" className="btn">سجل الحصص</Link><Link to="/" className="btnp grow">الرئيسية</Link></div></div>}
    </>
  );
}
