import { Link, useNavigate } from 'react-router-dom';
import { formatDay, isoDate, nextFriday, pointsCount, POINTS } from '../data/logic';
import { STATUS_LABELS } from '../data/types';
import { useView } from './Layout';
import { memberLogout } from './session';
import CopticToday from '../screens/CopticToday';
import PushToggle from '../screens/PushToggle';

export default function MemberHome() {
  const v = useView();
  const nav = useNavigate();
  const memorized = v.hymns.filter(h => h.status >= 2).length;
  const goal = v.hymns.find(h => h.status === 2) ?? v.hymns.find(h => h.status < 2);
  const logout = async () => { await memberLogout(); nav('/me', { replace: true }); };

  return (
    <>
      <header className="top gutter"><div className="row between">
        <div className="row">
          <Link to="/me/profile" className="av" style={{ width: 48, height: 48 }} aria-label="بياناتي">{v.photo ? <img src={v.photo} alt="" /> : v.name[0]}</Link>
          <div><h1>أهلاً يا {v.name.split(' ')[0]}</h1><div className="muted">{[v.levelName, v.rank].filter(Boolean).join(' • ')} • <Link to="/me/profile">بياناتي</Link></div></div>
        </div>
        <button className="btn" style={{ minHeight: 40 }} onClick={logout}>خروج</button>
      </div></header>
      <main className="main gutter wide dash">
        <Link to="/me/rank" className="hero" style={{ textDecoration: 'none' }}>
          <div className="row between">
            <div><div className="big">#{v.place || '–'}</div><div>ترتيبك في {v.levelName}</div></div>
            <div style={{ textAlign: 'left' }}><div className="big">{v.points}</div><div>نقطة الشهر ده</div></div>
          </div>
          {v.place > 1 && v.gap > 0 && <div style={{ color: 'var(--gold)' }}>{pointsCount(v.gap)} وتبقى الأول</div>}
          {v.place === 1 && v.points > 0 && <div style={{ color: 'var(--gold)' }}>أنت الأول الشهر ده، حافظ عليها</div>}
        </Link>

        <PushToggle who="member" />

        <CopticToday plain />

        {goal && (
          <div className="card">
            <b>هدف الجمعة الجاية</b>
            <div className="muted">{goal.status === 2
              ? `لو قلت "${goal.nameAr}" لوحدك تاخد ${POINTS.solo} نقط`
              : `لو حفظت "${goal.nameAr}" تاخد ${POINTS.memorized} نقط`}</div>
          </div>
        )}

        <div className="card">
          <div className="row between"><h2>ألحاني الترم ده</h2><span className="muted">{memorized} من {v.hymns.length} حافظهم</span></div>
          <div className="list">
            {v.hymns.map(h => (
              <Link key={h.id} to={`/me/hymn/${h.id}`} className="li">
                <b className="grow">{h.nameAr}</b><span className={`pill st${h.status}`} style={{ display: 'inline-flex', alignItems: 'center' }}>{STATUS_LABELS[h.status]}</span>
              </Link>
            ))}
            {v.hymns.length === 0 && <div className="note">لسه الخدام ما حطوش ألحان الترم.</div>}
          </div>
        </div>

        <div className="card row between">
          <div><div className="muted">الحصة الجاية</div><b>{formatDay(isoDate(nextFriday()))}</b></div>
          {v.attendanceRate !== null && <div style={{ textAlign: 'left' }}><div className="muted">حضورك</div><b>{v.attendanceRate}%</b></div>}
        </div>
      </main>
    </>
  );
}
