import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAllowedLevel, useData } from '../data/store';
import { monthName, monthReport, shiftMonth, thisMonth } from '../data/monthReport';
import { sessionsCount, titled } from '../data/logic';
import Icon from '../ui/Icon';

const MEDAL = ['🥇', '🥈', '🥉'];

/** The month in review for each of the servant's levels: what the bell opens on the 1st and before the ranking resets. */
export default function MonthReport() {
  const { month: asked } = useParams();
  // A mistyped link opens last month instead of breaking.
  const month = asked && /^\d{4}-(0[1-9]|1[0-2])$/.test(asked) ? asked : shiftMonth(thisMonth(), -1);
  const [data] = useData();
  const allowed = useAllowedLevel();
  const nav = useNavigate();
  const levels = [...data.levels].sort((a, b) => a.order - b.order).filter(l => allowed(l.id));
  const current = month === thisMonth();

  return (
    <>
      <header className="top gutter"><div className="row between">
        <div className="row">
          <button className="icon" onClick={() => nav(-1)} aria-label="رجوع"><Icon name="back" size={20} /></button>
          <div><h1>تقرير {monthName(month)}</h1><div className="muted">{current ? 'الشهر لسه ما خلصش، والترتيب بيتصفّر أول الشهر الجاي' : 'ملخص الشهر لكل مستوى'}</div></div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <Link className="icon" to={`/month/${shiftMonth(month, -1)}`} aria-label="الشهر اللي قبله"><Icon name="back" size={18} /></Link>
          {!current && <Link className="icon" to={`/month/${shiftMonth(month, 1)}`} aria-label="الشهر اللي بعده" style={{ transform: 'scaleX(-1)' }}><Icon name="back" size={18} /></Link>}
        </div>
      </div></header>
      <main className="main gutter wide dash">
        {levels.map(l => {
          const r = monthReport(data, l.id, month);
          if (!r.sessions) return <div key={l.id} className="card"><h2>{l.name}</h2><div className="note">مفيش حصص متسجلة في الشهر ده.</div></div>;
          const diff = r.rate !== null && r.prevRate !== null ? r.rate - r.prevRate : null;
          return (
            <div key={l.id} className="card">
              <h2>{l.name}</h2>
              <div className="row between">
                <div><div className="muted">الحصص</div><b>{sessionsCount(r.sessions)}</b></div>
                <div><div className="muted">الحضور</div><b>{r.rate ?? '–'}%</b>
                  {diff !== null && diff !== 0 && <span className={diff > 0 ? 'muted' : 'alert-t'}> {diff > 0 ? `▲ ${diff}` : `▼ ${-diff}`}</span>}</div>
                <div><div className="muted">نقط المستوى</div><b>{r.points}</b></div>
              </div>
              {r.top.length > 0 && <>
                <b>{current ? 'الأوائل لحد دلوقتي' : 'أوائل الشهر'}</b>
                <div className="list">
                  {r.top.map((t, i) => (
                    <Link key={t.member.id} to={`/members/${t.member.id}`} className="li">
                      <span style={{ fontSize: 22 }}>{MEDAL[i]}</span>
                      <span className="av">{t.member.photo ? <img src={t.member.photo} alt="" /> : t.member.name[0]}</span>
                      <b className="grow">{titled(t.member, data.levels)}</b><span className="muted">{t.points} نقطة</span>
                    </Link>
                  ))}
                </div>
              </>}
              {r.milestones.length > 0 && <>
                <b>وصلوا لمرحلة جديدة في لحن</b>
                <div className="muted">{r.milestones.map(x => `${titled(x.member, data.levels)}${x.solo ? ' (قاله لوحده)' : ' (حفظ)'}`).join('، ')}</div>
              </>}
              {r.slipped.length > 0 && <>
                <b className="alert-t">مستواهم نزل</b>
                <div className="list">
                  {r.slipped.map(x => (
                    <Link key={x.member.id} to={`/members/${x.member.id}`} className="li">
                      <span className="av">{x.member.photo ? <img src={x.member.photo} alt="" /> : x.member.name[0]}</span>
                      <div className="grow"><b>{titled(x.member, data.levels)}</b><div className="muted">{x.why.join(' • ')}</div></div>
                    </Link>
                  ))}
                </div>
              </>}
            </div>
          );
        })}
        <Link to="/ranking" className="btn span">الترتيب الكامل لكل مستوى</Link>
        <Link to="/reports" className="btn span">التقارير التفصيلية وتصدير إكسيل</Link>
      </main>
    </>
  );
}
