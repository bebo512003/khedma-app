import { useRef, useState, type PointerEvent } from 'react';
import { useData, useIsLead } from '../data/store';
import { uid } from '../data/logic';
import type { Level } from '../data/types';
import { BackButton } from '../ui/back';

export default function Levels() {
  const [data, update] = useData();
  const sorted = [...data.levels].sort((a, b) => a.order - b.order);
  /** While dragging: the order on screen, saved when the finger lifts. */
  const [dragOrder, setDragOrder] = useState<string[] | null>(null);
  const [dragging, setDragging] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const levels = dragOrder ? dragOrder.map(id => sorted.find(l => l.id === id)!).filter(Boolean) : sorted;
  const [editing, setEditing] = useState<Level | null>(null);
  const lead = useIsLead();

  const save = () => {
    if (!editing || !editing.name.trim()) return;
    const l = { ...editing, name: editing.name.trim(), grades: editing.grades.trim() };
    update(d => ({ ...d, levels: d.levels.some(x => x.id === l.id) ? d.levels.map(x => x.id === l.id ? l : x) : [...d.levels, l] }));
    setEditing(null);
  };
  const count = (id: string) => data.members.filter(m => m.levelId === id).length;
  const [sure, setSure] = useState(false);
  const known = editing && data.levels.some(x => x.id === editing.id);
  const n = editing ? count(editing.id) : 0;
  const sessionsN = editing ? data.sessions.filter(x => x.levelId === editing.id).length : 0;
  /** A level with learners can't go: they'd have nowhere to be. Its sessions stay in the log. */
  const remove = () => {
    if (!editing || n) return;
    const id = editing.id;
    update(d => ({
      ...d,
      levels: d.levels.filter(x => x.id !== id),
      curricula: Object.fromEntries(Object.entries(d.curricula).filter(([k]) => !k.endsWith(`:${id}`) && k !== id)),
    }));
    setEditing(null); setSure(false);
  };

  const startDrag = (e: PointerEvent, id: string) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(id); setDragOrder(sorted.map(l => l.id));
  };
  const moveDrag = (e: PointerEvent) => {
    if (!dragging || !dragOrder || !listRef.current) return;
    const rows = [...listRef.current.querySelectorAll<HTMLElement>('[data-level]')];
    const to = rows.findIndex(r => { const b = r.getBoundingClientRect(); return e.clientY < b.top + b.height / 2; });
    const next = dragOrder.filter(x => x !== dragging);
    const at = to < 0 ? next.length : Math.min(to, next.length);
    next.splice(at, 0, dragging);
    if (next.join() !== dragOrder.join()) setDragOrder(next);
  };
  const endDrag = () => {
    if (dragOrder && dragOrder.join() !== sorted.map(l => l.id).join())
      update(d => ({ ...d, levels: d.levels.map(l => ({ ...l, order: dragOrder.indexOf(l.id) + 1 })) }));
    setDragging(''); setDragOrder(null);
  };

  return (
    <>
      <header className="top gutter"><div className="row">
        <BackButton /><h1>المستويات</h1>
      </div></header>
      <main className="main gutter">
        <div className="card"><div className="list" ref={listRef}>
          {levels.map(l => (
            <div key={l.id} data-level className={`li${dragging === l.id ? ' dragging' : ''}`} style={{ borderBottom: '1px solid var(--line)' }}>
              {lead && <span className="drag" aria-label={`اسحب ${l.name} لفوق أو لتحت`} role="button"
                onPointerDown={e => startDrag(e, l.id)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>⋮⋮</span>}
              <button className="grow" style={{ background: 'none', border: 0, textAlign: 'right', color: 'inherit', padding: 0, font: 'inherit' }} onClick={() => lead && setEditing(l)}>
                <b>{l.name}</b><div className="muted">{l.grades} • {count(l.id)} مخدوم</div></button>
              {lead && <button className="btn" style={{ minHeight: 36 }} onClick={() => setEditing(l)}>تعديل</button>}
            </div>
          ))}
        </div></div>
        {lead && levels.length > 1 && <div className="note">اسحب من ⋮⋮ عشان ترتّب المستويات. الترتيب ده بيبان في كل الأبلكيشن. أكواد المخدومين الموجودين مش بتتغير، بس المخدومين الجداد بياخدوا رقم المستوى في مكانه الجديد.</div>}
        {!lead && <div className="note">المستويات بيعدّلها الخادم المسؤول.</div>}
        {editing && (
          <div className="card">
            <h2>{data.levels.some(x => x.id === editing.id) ? 'تعديل المستوى' : 'مستوى جديد'}</h2>
            <label className="field" htmlFor="lname"><span>اسم المستوى</span>
              <input id="lname" className="input" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></label>
            <label className="field" htmlFor="lgrades"><span>السنين الدراسية</span>
              <input id="lgrades" className="input" placeholder="مثلاً: أولى وتانية ابتدائي" value={editing.grades} onChange={e => setEditing({ ...editing, grades: e.target.value })} /></label>
            <div className="row"><button className="btn grow" onClick={() => { setEditing(null); setSure(false); }}>إلغاء</button><button className="btnp grow" onClick={save}>احفظ</button></div>
            {known && (n > 0
              ? <div className="note">عشان تمسح المستوى ده انقل الـ{n} مخدوم اللي فيه لمستوى تاني الأول (من تعديل كل مخدوم).</div>
              : sure
                ? <div className="card alert"><b>تمسح مستوى {editing.name}؟</b>
                    <div className="note">منهجه هيتشال.{sessionsN ? ` حصصه (${sessionsN}) هتفضل في سجل الحصص.` : ''}</div>
                    <div className="row"><button className="btn grow" onClick={() => setSure(false)}>لا</button><button className="btnp grow" onClick={remove}>امسح</button></div></div>
                : <button className="btn" onClick={() => setSure(true)}>امسح المستوى</button>)}
          </div>
        )}
      </main>
      {lead && <div className="bar gutter"><div>
        <button className="btnp grow" onClick={() => setEditing({ id: uid(), name: '', grades: '', order: Math.max(0, ...data.levels.map(l => l.order)) + 1 })}>مستوى جديد</button>
      </div></div>}
    </>
  );
}
