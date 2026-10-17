import { Link } from 'react-router-dom';
import { useData, useStore } from '../data/store';
import { absenceStreak, needsFollowUp } from '../data/logic';
import { applyTheme, loadTheme } from '../theme';
import { useState } from 'react';
import logo from '../logo.png';

export default function Home() {
  const [data] = useData();
  const { update } = useStore();
  const [theme, setTheme] = useState(loadTheme());
  const levels = [...data.levels].sort((a, b) => a.order - b.order);
  const followUp = data.members.filter(m => needsFollowUp(absenceStreak(data, m)));
  const last = [...data.sessions].sort((a, b) => b.date.localeCompare(a.date))[0];
  const hasExamples = data.members.some(m => m.example);

  const toggle = () => { const t = theme === 'light' ? 'maroon' : 'light'; applyTheme(t); setTheme(t); };
  const clearExamples = () => update(d => ({
    ...d,
    members: d.members.filter(m => !m.example),
    sessions: d.sessions.filter(s => !s.id.startsWith('ex-')),
  }));

  return (
    <>
      <header className="top gutter">
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
      <main className="main gutter">
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

        {last && (
          <div className="card row between">
            <div><div className="muted">آخر حصة: {data.levels.find(l => l.id === last.levelId)?.name}</div>
              <b>حضر {Object.values(last.attendance).filter(a => a === 'p').length} من {Object.keys(last.attendance).length}</b></div>
            <span className="muted">{last.date}</span>
          </div>
        )}

        <Link to="/members" className="btn">المخدومين</Link>

        {hasExamples && (
          <div className="card">
            <div className="note">الأسماء اللي موجودة دلوقتي أمثلة عشان تجرب. لما تضيف المخدومين الحقيقيين امسح الأمثلة.</div>
            <button className="btn" onClick={clearExamples}>امسح الأمثلة</button>
          </div>
        )}
        <div className="note">كل حاجة بتتحفظ على الموبايل ده وبتشتغل من غير نت. المزامنة مع باقي الخدام هتتضاف لما نربط Firebase.</div>
      </main>
    </>
  );
}
