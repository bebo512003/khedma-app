import ThemeButton from '../ui/ThemeButton';
import { Link, useNavigate } from 'react-router-dom';
import { formatDay, isoDate, nextFriday, pointsCount, hymnPoints, monthDue, daysLeftInMonth, DUE_WINDOW, STREAK_MIN, sessionsCount, todayISO } from '../data/logic';
import { monthName } from '../data/monthReport';
import { Bell, useG, useNotes, useStatus, useView } from './Layout';
import { memberLogout } from './session';
import CopticToday from '../screens/CopticToday';
import VerseToday from '../screens/VerseToday';
import PushToggle from '../screens/PushToggle';

export default function MemberHome() {
  const v = useView();
  const g = useG(), st = useStatus();
  const nav = useNavigate();
  const memorized = v.hymns.filter(h => h.status >= 2).length;
  const goal = v.hymns.find(h => h.status === 2) ?? v.hymns.find(h => h.status < 2);
  const { subs } = useNotes();
  const month = todayISO().slice(0, 7), left = daysLeftInMonth();
  const due = left <= DUE_WINDOW ? monthDue(v.hymns, month) : [];
  const sentFor = (d: { hymnId: string; partId?: string }) => subs.some(x => x.pending && x.hymnId === d.hymnId && (x.partId ?? '') === (d.partId ?? '') && isoDate(new Date(x.at)).startsWith(month));
  const meStar = v.star?.people.some(p => p.id === v.memberId);
  const logout = async () => { await memberLogout(); nav('/me', { replace: true }); };

  return (
    <>
      <header className="top gutter"><div className="row between">
        <div className="row">
          <Link to="/me/profile" className="av" style={{ width: 48, height: 48 }} aria-label="بياناتي">{v.photo ? <img src={v.photo} alt="" /> : v.name[0]}</Link>
          <div><h1>أهلاً يا {v.name.split(' ')[0]}</h1><div className="muted">{[v.levelName, v.rank].filter(Boolean).join(' • ')} • <Link to="/me/profile">بياناتي</Link></div></div>
        </div>
        <div className="row" style={{ gap: 8 }}><ThemeButton /><Bell /><button className="btn" style={{ minHeight: 40 }} onClick={logout}>خروج</button></div>
      </div></header>
      <main className="main gutter wide dash">
        <Link to="/me/rank" className="hero" style={{ textDecoration: 'none' }}>
          <div className="row between">
            <div><div className="big">#{v.place || '–'}</div><div>ترتيبك في {v.levelName}</div></div>
            <div style={{ textAlign: 'left' }}><div className="big">{v.points}</div><div>نقطة الشهر ده</div></div>
          </div>
          {v.place > 1 && v.gap > 0 && <div style={{ color: 'var(--gold)' }}>{pointsCount(v.gap)} {g('وتبقى الأول', 'وتبقي الأولى')}</div>}
          {v.place === 1 && v.points > 0 && <div style={{ color: 'var(--gold)' }}>{g('أنت الأول الشهر ده، حافظ عليها', 'انتي الأولى الشهر ده، حافظي عليها')}</div>}
        </Link>

        {v.star && <div className="card star-month">
          <div className="row">
            <span className="av" style={{ width: 52, height: 52, fontSize: 22 }}>{v.star.people[0].photo ? <img src={v.star.people[0].photo} alt="" /> : '⭐'}</span>
            <div className="grow">
              <b>{meStar ? `${g('انت نجم', 'انتي نجمة')} ${monthName(v.star.month)} 🎉` : `${v.star.people.length > 1 ? 'نجوم' : 'نجم'} ${monthName(v.star.month)} في ${v.levelName}`}</b>
              <div className="muted">{meStar ? g('الأول في المستوى الشهر اللي فات. كمّل كده!', 'الأولى في المستوى الشهر اللي فات. كمّلي كده!') : v.star.people.map(p => p.name).join(' و')}</div>
            </div>
          </div>
        </div>}

        {due.length > 0 && <div className="card due-month">
          <b>⏳ {left === 1 ? 'النهاردة آخر يوم في الشهر' : `فاضل ${left} أيام على آخر الشهر`}</b>
          <div className="muted">{g('لو ما حفظتش', 'لو ما حفظتيش')} {due.length > 1 ? 'دول' : 'ده'} قبل آخر الشهر، {due.length > 1 ? 'نقطهم' : 'نقطه'} بتروح.</div>
          <div className="list">
            {due.map(d => (
              <Link key={d.hymnId + (d.partId ?? '')} to={`/me/hymn/${d.hymnId}`} className="li">
                <b className="grow">{d.name}{d.partName ? ` (${d.partName})` : ''}</b>
                <span className="muted">{sentFor(d) ? g('بعتّ تسميعه، مستني رد', 'بعتّي تسميعه، مستنية رد') : g('سمّعه', 'سمّعيه')}</span>
              </Link>
            ))}
          </div>
        </div>}

        {v.coupons && <Link to="/me/rank" className="card coupon-home" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="row between">
            <div><b>🎟️ رصيد الكوبونات</b><div className="muted">{(val => val ? `${g('لو فضلت في مركزك لآخر الشهر هتاخد', 'لو فضلتي في مركزك لآخر الشهر هتاخدي')} ${val} كوبون كمان` : `الأول كل شهر بياخد ${v.coupons.values[0]} كوبون، ${g('وتبدلها', 'وتبدليها')} بهدايا`)(v.points > 0 ? v.coupons.values[v.place - 1] ?? 0 : 0)}</div></div>
            <b className="coupon-bal" style={{ fontSize: 28 }}>{v.coupons.balance}</b>
          </div>
        </Link>}

        <PushToggle who="member" />

        <CopticToday plain />
        <VerseToday />

        {goal && (
          <div className="card">
            <b>هدف الجمعة الجاية</b>
            <div className="muted">{goal.status === 2
              ? `${g('لو قلت', 'لو قولتي')} "${goal.nameAr}" ${g('لوحدك تاخد', 'لوحدك تاخدي')} ${hymnPoints(goal).solo} نقط`
              : `${g('لو حفظت', 'لو حفظتي')} "${goal.nameAr}" ${g('تاخد', 'تاخدي')} ${hymnPoints(goal).memorized} نقط`}</div>
          </div>
        )}

        <div className="card">
          <div className="row between"><h2>ألحاني الترم ده</h2><span className="muted">{memorized} من {v.hymns.length} {g('حافظهم', 'حافظاهم')}</span></div>
          <div className="list">
            {v.hymns.map(h => (
              <Link key={h.id} to={`/me/hymn/${h.id}`} className="li">
                <b className="grow">{h.nameAr}</b><span className={`pill st${h.status}`} style={{ display: 'inline-flex', alignItems: 'center' }}>{st(h.status)}</span>
              </Link>
            ))}
            {v.hymns.length === 0 && <div className="note">لسه الخدام ما حطوش ألحان الترم.</div>}
          </div>
        </div>

        <div className="card row between">
          <div><div className="muted">الحصة الجاية</div><b>{formatDay(isoDate(nextFriday()))}</b></div>
          {v.attendanceRate !== null && <div style={{ textAlign: 'left' }}><div className="muted">حضورك</div><b>{v.attendanceRate}%</b></div>}
        </div>
        {v.streak && (v.streak.now >= STREAK_MIN
          ? <div className="card streak"><b>🔥 {g('حاضر', 'حاضرة')} {sessionsCount(v.streak.now)} ورا بعض</b><div className="muted">{v.streak.best > v.streak.now ? `${g('أحسن سلسلة ليك', 'أحسن سلسلة ليكي')} ${sessionsCount(v.streak.best)}، ${g('قرّب تكسرها', 'قرّبتي تكسريها')}` : g('دي أحسن سلسلة ليك لحد دلوقتي، متكسرهاش', 'دي أحسن سلسلة ليكي لحد دلوقتي، متكسريهاش')}</div></div>
          : v.streak.best >= STREAK_MIN && <div className="card streak"><b>🔥 {g('أحسن سلسلة حضور ليك', 'أحسن سلسلة حضور ليكي')} {sessionsCount(v.streak.best)}</b><div className="muted">{g('احضر الحصص الجاية ورا بعض وابدأ سلسلة جديدة', 'احضري الحصص الجاية ورا بعض وابدأي سلسلة جديدة')}</div></div>)}
      </main>
    </>
  );
}
