import { Link } from 'react-router-dom';
import { useAllowedLevel, useData, useStore } from '../data/store';
import { absenceStreak, needsFollowUp } from '../data/logic';
import { applyTheme, loadTheme } from '../theme';
import { useState } from 'react';
import logo from '../logo.png';
import Birthdays from './Birthdays';
import CopticToday from './CopticToday';

export default function Home() {
  const [data] = useData();
  const { update, cloud, servant, syncError, signOut } = useStore();
  const allowed = useAllowedLevel();
  const [theme, setTheme] = useState(loadTheme());
  const levels = [...data.levels].sort((a, b) => a.order - b.order).filter(l => allowed(l.id));
  const followUp = data.members.filter(m => needsFollowUp(absenceStreak(data, m)));
  const last = [...data.sessions].sort((a, b) => b.date.localeCompare(a.date))[0];
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
              <h1>مدرسة الشهيد اسطفانوس</h1>
              <div className="muted">إتعلم … رتل … افرح</div>
            </div>
          </div>
          <button className="icon" onClick={toggle} aria-label={theme === 'light' ? 'وضع النبيتي' : 'الوضع الفاتح'}>{theme === 'light' ? '☾' : '☀'}</button>
        </div>
      </header>
      <main className="main gutter wide dash">
        <CopticToday />
        <div className="card">
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
        </div>

        {followUp.length > 0 && (
          <div className="card alert">
            <div className="alert-t">{followUp.length} محتاجين افتقاد</div>
            <div className="muted">غابوا أكتر من مرتين ورا بعض: {followUp.map(m => m.name).join('، ')}</div>
            <Link to="/followup" className="btnp">افتقد دلوقتي</Link>
          </div>
        )}

        <Birthdays levelIds={allowed} />

        {last && (
          <div className="card row between">
            <div><div className="muted">آخر حصة: {data.levels.find(l => l.id === last.levelId)?.name}</div>
              <b>حضر {Object.values(last.attendance).filter(a => a === 'p').length} من {Object.keys(last.attendance).length}</b></div>
            <span className="muted">{last.date}</span>
          </div>
        )}

        <div className="row mobile-only"><Link to="/members" className="btn grow">المخدومين</Link><Link to="/library" className="btn grow">مكتبة الألحان</Link></div>
        <div className="row mobile-only"><Link to="/reports" className="btn grow">التقارير</Link><Link to="/dictionary" className="btn grow">القاموس القبطي</Link></div>
        {cloud
          ? <div className="row mobile-only">{servant?.role === 'lead' && <Link to="/team" className="btn grow">الفريق</Link>}<button className="btn grow" onClick={signOut}>خروج</button></div>
          : <Link to="/me" className="btn">جرّب تطبيق المخدوم</Link>}

        {hasExamples && (
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
