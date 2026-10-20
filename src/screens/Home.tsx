import { Link } from 'react-router-dom';
import { useAllowedLevel, useData, useIsLead, useStore, useCan } from '../data/store';
import { absenceStreak, watchList, needsFollowUp } from '../data/logic';
import { applyTheme, loadTheme } from '../theme';
import { useState } from 'react';
import logo from '../logo.png';
import Birthdays from './Birthdays';
import CopticToday from './CopticToday';
import PushToggle from './PushToggle';
import Icon from '../ui/Icon';
import { usePending } from './usePending';

export default function Home() {
  const [data] = useData();
  const canReports = useCan('reports'), canSessions = useCan('sessions');
  const { update, cloud, syncError, servant } = useStore();
  const allowed = useAllowedLevel();
  const lead = useIsLead();
  const [theme, setTheme] = useState(loadTheme());
  const levels = [...data.levels].sort((a, b) => a.order - b.order).filter(l => allowed(l.id));
  const followUp = data.members.filter(m => needsFollowUp(absenceStreak(data, m)));
  const watch = watchList(data, allowed);
  const pending = usePending();
  const last = data.sessions.filter(s => allowed(s.levelId)).sort((a, b) => b.date.localeCompare(a.date))[0];
  const hasExamples = data.members.some(m => m.example);

  const toggle = () => { const t = theme === 'light' ? 'maroon' : 'light'; applyTheme(t); setTheme(t); };
  const clearExamples = () => update(d => ({
    ...d,
    members: d.members.filter(m => !m.example),
    sessions: d.sessions.filter(s => !s.id.startsWith('ex-')),
    progress: Object.fromEntries(Object.entries(d.progress).filter(([id]) => d.members.some(m => m.id === id && !m.example))),
  }));

  return (
    <>
      <header className="top gutter mobile-only">
        <div className="row between">
          <div className="row">
            <img src={logo} alt="شعار مدرسة الشهيد اسطفانوس للشمامسة" width={48} height={48} />
            <div>
              <h1 className="brand-t">مدرسة الشهيد اسطفانوس</h1>
              <div className="muted">{servant ? `أهلاً يا ${servant.name.split(' ')[0]}` : 'إتعلم … رتل … افرح'}</div>
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            {!servant && <button className="icon" onClick={toggle} aria-label={theme === 'light' ? 'وضع النبيتي' : 'الوضع الفاتح'}><Icon name={theme === 'light' ? 'moon' : 'sun'} size={20} /></button>}
            {servant && canSessions && <Link to="/reviews" className="icon bell" aria-label={pending ? `التسميع، ${pending} مستني` : 'التسميع'}><Icon name="bell" size={20} />{pending > 0 && <span className="count">{pending > 9 ? '9+' : pending}</span>}</Link>}
            {servant && <Link to="/profile" className="av" style={{ width: 44, height: 44 }} aria-label="بروفايلي">{servant.photo ? <img src={servant.photo} alt="" /> : servant.name[0]}</Link>}
          </div>
        </div>
      </header>
      <main className="main gutter wide dash">
        <CopticToday />
        {canSessions && <div className="card">
          <h2>ابدأ حصة</h2>
          <div className="list">
            {levels.map(l => {
              const n = data.members.filter(m => m.levelId === l.id).length;
              return (
                <Link key={l.id} to={`/session/${l.id}`} className="li">
                  <div className="grow"><b>{l.name}</b><div className="muted">{l.grades} • {n} مخدوم</div></div>
                  <span className="btnp" style={{ minHeight: 40 }}>ابدأ</span>
                </Link>
              );
            })}
          </div>
        </div>}

        {followUp.length > 0 && (
          <div className="card alert">
            <div className="alert-t">{followUp.length} محتاجين افتقاد</div>
            <div className="muted">غابوا أكتر من مرتين ورا بعض: {followUp.map(m => m.name).join('، ')}</div>
            <Link to="/followup" className="btnp">افتقد دلوقتي</Link>
          </div>
        )}

        {pending > 0 && (
          <Link to="/reviews" className="card row between" style={{ color: 'inherit', textDecoration: 'none' }}>
            <div><b>{pending === 1 ? 'تسميع واحد مستنيك' : `${pending} تسميعات مستنياك`}</b><div className="muted">مخدومين سجّلوا ألحانهم من البيت</div></div>
            <span className="btnp" style={{ minHeight: 40 }}>اسمع</span>
          </Link>
        )}

        {watch.length > 0 && (
          <div className="card">
            <h2>خلّي بالك منهم <span className="muted">({watch.length})</span></h2>
            <div className="note">لسه مش محتاجين افتقاد، بس ممكن كلمة تشجيع دلوقتي تفرق.</div>
            <div className="list">
              {watch.slice(0, 8).map(({ member: m, reasons }) => (
                <Link key={m.id} to={`/members/${m.id}`} className="li">
                  <span className="av">{m.photo ? <img src={m.photo} alt="" /> : m.name[0]}</span>
                  <div className="grow"><b>{m.name}</b><div className="muted">{reasons.join(' • ')}</div></div>
                </Link>
              ))}
            </div>
            {watch.length > 8 && <div className="muted">و{watch.length - 8} كمان</div>}
          </div>
        )}

        {cloud && <PushToggle who="servant" />}

        <Birthdays levelIds={allowed} />

        {last && (
          <Link to={`/summary/${last.id}`} className="card row between" style={{ color: 'inherit', textDecoration: 'none' }}>
            <div><div className="muted">آخر حصة: {data.levels.find(l => l.id === last.levelId)?.name}</div>
              <b>حضر {Object.values(last.attendance).filter(a => a === 'p').length} من {Object.keys(last.attendance).length}</b></div>
            <span className="muted">{last.date}</span>
          </Link>
        )}

        <div className="card mobile-only">
          <h2>اختصارات</h2>
          <div className="tiles tiles4">
            {([['/curriculum', 'list', 'المنهج'], ['/books', 'books', 'الكتب'], ['/reports', 'chart', 'التقارير'], ['/sessions', 'clock', 'سجل الحصص']] as const).filter(([to]) => to !== '/reports' || canReports).map(([to, icon, label]) =>
              <Link key={to} to={to} className="tile"><Icon name={icon} />{label}</Link>)}
          </div>
        </div>
        {!cloud && <Link to="/me" className="btn">جرّب تطبيق المخدوم</Link>}

        {hasExamples && lead && (
          <div className="card">
            <div className="note">الأسماء اللي موجودة دلوقتي أمثلة عشان تجرب. لما تضيف المخدومين الحقيقيين امسح الأمثلة.</div>
            <button className="btn" onClick={clearExamples}>امسح الأمثلة</button>
          </div>
        )}
        {syncError && <div className="card alert"><div className="alert-t">في مشكلة في المزامنة</div><div className="note">{syncError}</div></div>}
        <div className="note span">{cloud
          ? 'بيشتغل من غير نت، وأول ما النت يرجع كل حاجة بتتزامن مع باقي الخدام.'
          : 'كل حاجة بتتحفظ على الموبايل ده وبتشتغل من غير نت.'}</div>
      </main>
    </>
  );
}
