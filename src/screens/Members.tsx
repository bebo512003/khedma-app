import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../data/store';
import { absenceStreak, birthdayWhen, needsFollowUp, upcomingBirthdays } from '../data/logic';

export default function Members() {
  const [data] = useData();
  const [level, setLevel] = useState<string>('all');
  const [q, setQ] = useState('');
  const levels = [...data.levels].sort((a, b) => a.order - b.order);
  const list = data.members
    .filter(m => level === 'all' || m.levelId === level)
    .filter(m => !q || m.name.includes(q) || m.code.includes(q))
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  const birthdays = new Map(upcomingBirthdays(data.members).map(b => [b.member.id, b.daysAway]));

  return (
    <>
      <header className="top gutter">
        <div className="row between">
          <div className="row"><Link to="/" className="icon" aria-label="رجوع">→</Link><div><h1>المخدومين</h1><div className="muted">{data.members.length} مخدوم</div></div></div>
          <div className="row" style={{ gap: 6 }}><Link to={`/cards${level !== 'all' ? `?level=${level}` : ''}`} className="btn" style={{ minHeight: 44 }}>كروت QR</Link><Link to="/members/new" className="btnp" style={{ minHeight: 44 }}>+ مخدوم</Link></div>
        </div>
        <input id="search" className="input" placeholder="دوّر بالاسم أو الكود" value={q} onChange={e => setQ(e.target.value)} />
        <div className="chips">
          <button className="chip" aria-pressed={level === 'all'} onClick={() => setLevel('all')}>الكل</button>
          {levels.map(l => <button key={l.id} className="chip" aria-pressed={level === l.id} onClick={() => setLevel(l.id)}>{l.name}</button>)}
        </div>
      </header>
      <main className="main gutter wide">
        <div className="card" style={{ paddingBlock: 4 }}><div className="list cols">
          {list.length === 0 && <div className="li muted">مفيش نتايج.</div>}
          {list.map(m => {
            const streak = absenceStreak(data, m);
            return (
              <Link key={m.id} to={`/members/${m.id}`} className="li">
                <span className="av">{m.photo ? <img src={m.photo} alt="" /> : m.name[0]}</span>
                <div className="grow"><b>{m.name}</b><div className="muted">{m.code} • {data.levels.find(l => l.id === m.levelId)?.name}{m.rank ? ` • ${m.rank}` : ''}</div></div>
                {needsFollowUp(streak) && <span className="tag tag-alert">غاب {streak} مرات</span>}
                {birthdays.has(m.id) && <span className="tag tag-ex">عيد {m.gender === 'f' ? 'ميلادها' : 'ميلاده'} {birthdayWhen(birthdays.get(m.id)!)}</span>}
                {m.example && <span className="tag tag-ex">مثال</span>}
              </Link>
            );
          })}
        </div></div>
      </main>
    </>
  );
}
