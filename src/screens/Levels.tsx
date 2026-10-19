import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useData, useIsLead } from '../data/store';
import { uid } from '../data/logic';
import type { Level } from '../data/types';

export default function Levels() {
  const [data, update] = useData();
  const levels = [...data.levels].sort((a, b) => a.order - b.order);
  const [editing, setEditing] = useState<Level | null>(null);
  const lead = useIsLead();

  const save = () => {
    if (!editing || !editing.name.trim()) return;
    const l = { ...editing, name: editing.name.trim(), grades: editing.grades.trim() };
    update(d => ({ ...d, levels: d.levels.some(x => x.id === l.id) ? d.levels.map(x => x.id === l.id ? l : x) : [...d.levels, l] }));
    setEditing(null);
  };
  const count = (id: string) => data.members.filter(m => m.levelId === id).length;

  return (
    <>
      <header className="top gutter"><div className="row">
        <Link to="/curriculum" className="icon" aria-label="رجوع">→</Link><h1>المستويات</h1>
      </div></header>
      <main className="main gutter">
        <div className="card"><div className="list">
          {levels.map(l => (
            <button key={l.id} className="li" style={{ background: 'none', border: 0, borderBottom: '1px solid var(--line)', textAlign: 'right' }} onClick={() => lead && setEditing(l)}>
              <div className="grow"><b>{l.name}</b><div className="muted">{l.grades} • {count(l.id)} مخدوم</div></div>{lead && <span className="muted">تعديل</span>}
            </button>
          ))}
        </div></div>
        {!lead && <div className="note">المستويات بيعدّلها الخادم المسؤول.</div>}
        {editing && (
          <div className="card">
            <h2>{data.levels.some(x => x.id === editing.id) ? 'تعديل المستوى' : 'مستوى جديد'}</h2>
            <label className="field" htmlFor="lname"><span>اسم المستوى</span>
              <input id="lname" className="input" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></label>
            <label className="field" htmlFor="lgrades"><span>السنين الدراسية</span>
              <input id="lgrades" className="input" placeholder="مثلاً: أولى وتانية ابتدائي" value={editing.grades} onChange={e => setEditing({ ...editing, grades: e.target.value })} /></label>
            <div className="row"><button className="btn grow" onClick={() => setEditing(null)}>إلغاء</button><button className="btnp grow" onClick={save}>احفظ</button></div>
          </div>
        )}
      </main>
      {lead && <div className="bar gutter"><div>
        <button className="btnp grow" onClick={() => setEditing({ id: uid(), name: '', grades: '', order: Math.max(0, ...data.levels.map(l => l.order)) + 1 })}>مستوى جديد</button>
      </div></div>}
    </>
  );
}
