import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAllowedLevel, useData, useCan, useIsLead, useStore } from '../data/store';
import { absenceStreak, birthdayWhen, count, fold, needsFollowUp, upcomingBirthdays } from '../data/logic';
import { forgetLogins } from '../data/forgetLogins';

const people = (n: number) => count(n, 'مخدوم', 'مخدومين', 'مخدومين');

export default function Members() {
  const [data, update] = useData();
  const edit = useCan('members');
  const lead = useIsLead();
  const allowed = useAllowedLevel();
  const { cloud } = useStore();
  // Choosing several members to move to another level or delete at once.
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [action, setAction] = useState<'' | 'move' | 'delete'>('');
  const [level, setLevel] = useState<string>('all');
  const [q, setQ] = useState('');
  const levels = [...data.levels].sort((a, b) => a.order - b.order);
  const list = data.members
    .filter(m => level === 'all' || m.levelId === level)
    .filter(m => !q || fold(m.name).includes(fold(q)) || m.code.includes(q.trim()))
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  const mayPick = list.filter(m => allowed(m.levelId));
  const chosen = data.members.filter(m => picked.has(m.id));
  const toggle = (id: string) => setPicked(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allOn = mayPick.length > 0 && mayPick.every(m => picked.has(m.id));
  const stop = () => { setPicking(false); setPicked(new Set()); setAction(''); };
  const move = (levelId: string) => {
    update(d => ({ ...d, members: d.members.map(m => picked.has(m.id) ? { ...m, levelId } : m) }));
    stop();
  };
  const remove = () => {
    const gone = chosen;
    update(d => ({ ...d, members: d.members.filter(m => !picked.has(m.id)) }));
    if (cloud) forgetLogins(gone);
    stop();
  };
  const birthdays = new Map(upcomingBirthdays(data.members).map(b => [b.member.id, b.daysAway]));

  return (
    <>
      <header className="top gutter">
        <div className="row between">
          <div className="row"><Link to="/" className="icon" aria-label="رجوع">→</Link><div><h1>المخدومين</h1><div className="muted">{data.members.length} مخدوم</div></div></div>
          {edit && <div className="row" style={{ gap: 6 }}>
            <button className="btn" style={{ minHeight: 44 }} aria-pressed={picking} onClick={() => picking ? stop() : setPicking(true)}>{picking ? 'إلغاء' : 'تحديد'}</button>
            {!picking && <Link to="/members/new" className="btnp" style={{ minHeight: 44 }}>+ مخدوم</Link>}
          </div>}
        </div>
        {edit && !picking && <div className="row" style={{ gap: 6 }}><Link to={`/cards${level !== 'all' ? `?level=${level}` : ''}`} className="btn grow" style={{ minHeight: 40 }}>كروت QR</Link><Link to="/members/import" className="btn grow" style={{ minHeight: 40 }}>إضافة من Excel</Link><Link to="/members/photos" className="btn grow" style={{ minHeight: 40 }}>صور كتير</Link></div>}
        <input id="search" className="input" placeholder="دوّر بالاسم أو الكود" value={q} onChange={e => setQ(e.target.value)} />
        <div className="chips">
          <button className="chip" aria-pressed={level === 'all'} onClick={() => setLevel('all')}>الكل</button>
          {levels.map(l => <button key={l.id} className="chip" aria-pressed={level === l.id} onClick={() => setLevel(l.id)}>{l.name}</button>)}
        </div>
      </header>
      <main className="main gutter wide" style={picking ? { paddingBottom: 180 } : undefined}>
        <div className="card" style={{ paddingBlock: 4 }}><div className="list cols">
          {list.length === 0 && <div className="li muted">مفيش نتايج.</div>}
          {picking && mayPick.length > 0 && <label className="li" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={allOn} onChange={() => setPicked(p => { const n = new Set(p); for (const m of mayPick) if (allOn) n.delete(m.id); else n.add(m.id); return n; })} />
            <b className="grow">حدد كل اللي في القايمة ({mayPick.length})</b></label>}
          {list.map(m => {
            const streak = absenceStreak(data, m);
            const inner = <>
                <span className="av">{m.photo ? <img src={m.photo} alt="" /> : m.name[0]}</span>
                <div className="grow"><b>{m.name}</b><div className="muted">{m.code} • {data.levels.find(l => l.id === m.levelId)?.name}{m.rank ? ` • ${m.rank}` : ''}</div></div>
                {needsFollowUp(streak) && <span className="tag tag-alert">غاب {streak} مرات</span>}
                {birthdays.has(m.id) && <span className="tag tag-ex">عيد {m.gender === 'f' ? 'ميلادها' : 'ميلاده'} {birthdayWhen(birthdays.get(m.id)!)}</span>}
                {m.example && <span className="tag tag-ex">مثال</span>}
            </>;
            if (!picking) return <Link key={m.id} to={`/members/${m.id}`} className="li">{inner}</Link>;
            const ok = allowed(m.levelId);
            return (
              <label key={m.id} className="li" style={{ cursor: ok ? 'pointer' : 'default', opacity: ok ? 1 : 0.5 }}>
                <input type="checkbox" checked={picked.has(m.id)} disabled={!ok} onChange={() => toggle(m.id)} aria-label={`حدد ${m.name}`} />
                {inner}
              </label>
            );
          })}
        </div></div>
      </main>
      {picking && <div className="bar gutter"><div style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        {action === 'move' && <div className="field"><span>تنقل {people(chosen.length)} لمستوى</span>
          <div className="chips">{levels.filter(l => allowed(l.id)).map(l => <button key={l.id} className="chip" onClick={() => move(l.id)}>{l.name}</button>)}
            <button className="chip" onClick={() => setAction('')}>رجوع</button></div></div>}
        {action === 'delete' && <div className="card alert"><b>تمسح {people(chosen.length)} نهائي؟</b>
          <div className="muted">الكود والرقم السري بتاعهم هيبطلوا يشتغلوا، ومينفعش ترجّعهم غير من النسخة الاحتياطية.</div>
          <div className="row"><button className="btn grow" onClick={() => setAction('')}>لا</button><button className="btnp grow" onClick={remove}>امسح</button></div></div>}
        {!action && <div className="row" style={{ gap: 6 }}>
          <span className="grow muted">{chosen.length ? `متحدد ${people(chosen.length)}` : 'حدد المخدومين من القايمة'}</span>
          <button className="btn" aria-disabled={!chosen.length} onClick={() => chosen.length && setAction('move')}>انقل</button>
          {lead && <button className="btn" aria-disabled={!chosen.length} onClick={() => chosen.length && setAction('delete')}>امسح</button>}
        </div>}
      </div></div>}
    </>
  );
}
