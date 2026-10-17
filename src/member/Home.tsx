import { Link, useNavigate } from 'react-router-dom';
import { useData } from '../data/store';
import { currentTerm, curriculumKey, formatDay, isoDate, monthPoints, nextFriday, POINTS, ranking, todayISO } from '../data/logic';
import { STATUS_LABELS } from '../data/types';
import { useMember } from './session';

export default function MemberHome() {
  const [data] = useData();
  const { member, signOut } = useMember();
  const nav = useNavigate();
  if (!member) return null;
  const level = data.levels.find(l => l.id === member.levelId);
  const month = todayISO().slice(0, 7);
  const rows = ranking(data, member.levelId, month);
  const pos = rows.findIndex(r => r.member.id === member.id) + 1;
  const mine = monthPoints(data, member.id, month);
  const gap = Math.max(0, (rows[0]?.points ?? 0) - mine);
  const term = currentTerm(data);
  const hymns = (data.curricula[curriculumKey(term?.id, member.levelId)] ?? [])
    .map(id => ({ hymn: data.hymns.find(h => h.id === id), status: data.progress[member.id]?.[id] ?? 0 }))
    .filter((x): x is { hymn: NonNullable<typeof x.hymn>; status: typeof x.status } => !!x.hymn);
  const memorized = hymns.filter(h => h.status >= 2).length;
  const goal = hymns.find(h => h.status === 2) ?? hymns.find(h => h.status < 2);
  const mySessions = data.sessions.filter(s => s.attendance[member.id] !== undefined);
  const rate = mySessions.length ? Math.round(100 * mySessions.filter(s => s.attendance[member.id] === 'p').length / mySessions.length) : null;

  return (
    <>
      <header className="top gutter"><div className="row between">
        <div className="row">
          <div className="av" style={{ width: 48, height: 48 }}>{member.photo ? <img src={member.photo} alt="" /> : member.name[0]}</div>
          <div><h1>أهلاً يا {member.name.split(' ')[0]}</h1><div className="muted">{[level?.name, member.rank].filter(Boolean).join(' • ')}</div></div>
        </div>
        <button className="btn" style={{ minHeight: 40 }} onClick={() => { signOut(); nav('/me', { replace: true }); }}>خروج</button>
      </div></header>
      <main className="main gutter">
        <Link to="/me/rank" className="hero" style={{ textDecoration: 'none' }}>
          <div className="row between">
            <div><div className="big">#{pos || '–'}</div><div>ترتيبك في {level?.name}</div></div>
            <div style={{ textAlign: 'left' }}><div className="big">{mine}</div><div>نقطة الشهر ده</div></div>
          </div>
          {pos > 1 && gap > 0 && <div style={{ color: 'var(--gold)' }}>{gap} نقط وتبقى الأول</div>}
          {pos === 1 && mine > 0 && <div style={{ color: 'var(--gold)' }}>أنت الأول الشهر ده، حافظ عليها</div>}
        </Link>

        {goal && (
          <div className="card">
            <b>هدف الجمعة الجاية</b>
            <div className="muted">{goal.status === 2
              ? `لو قلت "${goal.hymn.nameAr}" لوحدك تاخد ${POINTS.solo} نقط`
              : `لو حفظت "${goal.hymn.nameAr}" تاخد ${POINTS.memorized} نقط`}</div>
          </div>
        )}

        <div className="card">
          <div className="row between"><h2>ألحاني الترم ده</h2><span className="muted">{memorized} من {hymns.length} حافظهم</span></div>
          <div className="list">
            {hymns.map(({ hymn, status }) => (
              <Link key={hymn.id} to={`/me/hymn/${hymn.id}`} className="li">
                <b className="grow">{hymn.nameAr}</b><span className={`pill st${status}`} style={{ display: 'inline-flex', alignItems: 'center' }}>{STATUS_LABELS[status]}</span>
              </Link>
            ))}
            {hymns.length === 0 && <div className="note">لسه الخدام ما حطوش ألحان الترم.</div>}
          </div>
        </div>

        <div className="card row between">
          <div><div className="muted">الحصة الجاية</div><b>{formatDay(isoDate(nextFriday()))}</b></div>
          {rate !== null && <div style={{ textAlign: 'left' }}><div className="muted">حضورك</div><b>{rate}%</b></div>}
        </div>
      </main>
    </>
  );
}
