import { Link, useParams } from 'react-router-dom';
import { useData } from '../data/store';
import { absenceStreak, needsFollowUp, sessionAverage } from '../data/logic';
import FollowUpList from './FollowUpList';

const fmt = (ms = 0) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export default function Summary() {
  const { sessionId } = useParams();
  const [data] = useData();
  const s = data.sessions.find(x => x.id === sessionId);
  if (!s) return <main className="main gutter"><div className="card">الحصة دي مش موجودة. <Link to="/">ارجع للرئيسية</Link></div></main>;

  const level = data.levels.find(l => l.id === s.levelId);
  const ids = Object.keys(s.attendance);
  const present = ids.filter(id => s.attendance[id] === 'p');
  const excused = ids.filter(id => s.attendance[id] === 'e').length;
  const avgs = present.map(id => sessionAverage(s, id)).filter((x): x is number => x !== null);
  const avg = avgs.length ? (avgs.reduce((a, b) => a + b, 0) / avgs.length).toFixed(1) : '–';
  const followUp = data.members.filter(m => m.levelId === s.levelId && s.attendance[m.id] === 'a' && needsFollowUp(absenceStreak(data, m)));
  const ms = Object.values(s.milestones ?? {});
  const memorized = ms.reduce((a, m) => a + m.memorized, 0), solo = ms.reduce((a, m) => a + m.solo, 0);

  return (
    <>
      <header className="top gutter"><div><h1>اتحفظت الحصة</h1><div className="muted">{level?.name} • {s.date}</div></div></header>
      <main className="main gutter">
        <div className="hero">
          <div className="row" style={{ gap: 24 }}>
            <div><div className="big">{fmt(s.durationMs)}</div><div className="muted" style={{ color: 'var(--on-hero)' }}>وقت تسجيل الحصة</div></div>
          </div>
          {memorized + solo > 0 && <div>اتقدّموا في الألحان: {memorized ? `${memorized} وصلوا "حافظه"` : ''}{memorized && solo ? ' و' : ''}{solo ? `${solo} وصلوا "بيقوله لوحده"` : ''}</div>}
        </div>
        <div className="card"><div className="stats">
          <div className="stat"><b>{present.length} / {ids.length}</b><span className="muted">حضروا</span></div>
          <div className="stat"><b>{excused}</b><span className="muted">اعتذر</span></div>
          <div className="stat"><b>{avg}</b><span className="muted">متوسط التقييم</span></div>
        </div></div>
        {followUp.length > 0
          ? <FollowUpList members={followUp} />
          : <div className="card"><div className="note">مفيش حد محتاج افتقاد من الحصة دي.</div></div>}
      </main>
      <div className="bar gutter"><div><Link to="/" className="btnp grow">الرئيسية</Link></div></div>
    </>
  );
}
