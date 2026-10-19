import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData, useStore } from '../data/store';
import type { Invite, Servant } from '../data/types';
import { waLink } from '../data/logic';

/** The team with their profiles. The lead servant also invites servants by Google email and chooses which levels each one runs. */
export default function Team() {
  const [data] = useData();
  const { servant: me } = useStore();
  const [servants, setServants] = useState<Servant[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [draft, setDraft] = useState<Invite | null>(null);
  const [editing, setEditing] = useState<Servant | null>(null);
  const [error, setError] = useState('');
  const levels = [...data.levels].sort((a, b) => a.order - b.order);

  useEffect(() => {
    let stop = () => {};
    (async () => {
      const [{ servantFb }, { onSnapshot }, paths] = await Promise.all([import('../firebase/app'), import('firebase/firestore'), import('../firebase/paths')]);
      const { db } = servantFb();
      const a = onSnapshot(paths.col(db, 'servants'), s => setServants(s.docs.map(d => d.data() as Servant)));
      const b = me?.role === 'lead' ? onSnapshot(paths.col(db, 'invites'), s => setInvites(s.docs.map(d => d.data() as Invite))) : () => {};
      stop = () => { a(); b(); };
    })();
    return () => stop();
  }, [me?.role]);

  if (!me) return <main className="main gutter"><div className="card">الصفحة دي للخدام. <Link to="/">ارجع</Link></div></main>;
  const lead = me.role === 'lead';

  const fs = async () => {
    const [{ servantFb }, firestore, paths] = await Promise.all([import('../firebase/app'), import('firebase/firestore'), import('../firebase/paths')]);
    return { db: servantFb().db, ...firestore, paths };
  };
  const levelNames = (ids: string[]) => ids.includes('*') ? 'كل المستويات' : ids.map(id => data.levels.find(l => l.id === id)?.name).filter(Boolean).join('، ') || 'من غير مستويات';
  const toggleLevel = (ids: string[], id: string) => id === '*' ? (ids.includes('*') ? [] : ['*'])
    : ids.includes(id) ? ids.filter(x => x !== id) : [...ids.filter(x => x !== '*'), id];

  const sendInvite = async () => {
    if (!draft) return;
    const email = draft.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setError('اكتب إيميل جوجل صحيح.'); return; }
    if (draft.levelIds.length === 0) { setError('اختار مستوى واحد على الأقل.'); return; }
    const { db, setDoc, paths } = await fs();
    await setDoc(paths.ref(db, 'invites', email), { ...draft, email, invitedBy: me.uid });
    setDraft(null); setError('');
  };
  const saveServant = async () => {
    if (!editing) return;
    const { db, setDoc, paths } = await fs();
    await setDoc(paths.ref(db, 'servants', editing.uid), editing);
    setEditing(null);
  };
  const removeServant = async (s: Servant) => { const { db, deleteDoc, paths } = await fs(); await deleteDoc(paths.ref(db, 'servants', s.uid)); setEditing(null); };
  const cancelInvite = async (i: Invite) => { const { db, deleteDoc, paths } = await fs(); await deleteDoc(paths.ref(db, 'invites', i.email)); };

  const levelPicker = (ids: string[], onChange: (ids: string[]) => void) => (
    <div className="chips">
      <button className="chip" aria-pressed={ids.includes('*')} onClick={() => onChange(toggleLevel(ids, '*'))}>كل المستويات</button>
      {levels.map(l => <button key={l.id} className="chip" aria-pressed={ids.includes('*') || ids.includes(l.id)} onClick={() => onChange(toggleLevel(ids, l.id))}>{l.name}</button>)}
    </div>
  );
  const rolePicker = (role: Servant['role'], onChange: (r: Servant['role']) => void) => (
    <div className="seg">
      <button aria-pressed={role === 'servant'} onClick={() => onChange('servant')}>خادم</button>
      <button aria-pressed={role === 'lead'} onClick={() => onChange('lead')}>خادم مسؤول</button>
    </div>
  );

  return (
    <>
      <header className="top gutter"><div className="row">
        <Link to="/" className="icon" aria-label="رجوع">→</Link><h1>الفريق</h1>
      </div></header>
      <main className="main gutter">
        <div className="card"><h2>الخدام</h2><div className="list">
          {servants.map(s => (
            <div key={s.uid} className="li servant-li">
              <span className="av">{s.photo ? <img src={s.photo} alt="" /> : s.name[0]}</span>
              <div className="grow">
                <b>{s.name}{s.uid === me.uid ? ' (أنت)' : ''}</b>
                <div className="muted">{[s.role === 'lead' ? 'خادم مسؤول' : 'خادم', s.rank, levelNames(s.levelIds)].filter(Boolean).join(' • ')}</div>
                {s.about && <div className="muted">{s.about}</div>}
              </div>
              <div className="row li-actions">
              {s.phone && s.uid !== me.uid && <a className="btn" style={{ minHeight: 36 }} href={waLink(s.phone, '')} target="_blank" rel="noopener noreferrer">واتساب</a>}
              {s.uid === me.uid && <Link className="btn" style={{ minHeight: 36 }} to="/profile">بروفايلي</Link>}
              {lead && <button className="btn" style={{ minHeight: 36 }} onClick={() => setEditing(s)}>صلاحيات</button>}
              </div>
            </div>
          ))}
        </div></div>

        {lead && editing && (
          <div className="card">
            <h2>{editing.name}</h2>
            <div className="muted" dir="ltr" style={{ textAlign: 'right' }}>{editing.email}</div>
            {editing.uid !== me.uid && rolePicker(editing.role, role => setEditing({ ...editing, role }))}
            {levelPicker(editing.levelIds, levelIds => setEditing({ ...editing, levelIds }))}
            <div className="row"><button className="btn grow" onClick={() => setEditing(null)}>إلغاء</button><button className="btnp grow" onClick={saveServant}>احفظ</button></div>
            {editing.uid !== me.uid && <button className="btn" onClick={() => removeServant(editing)}>شيله من الفريق</button>}
          </div>
        )}

        {lead && invites.length > 0 && (
          <div className="card"><h2>دعوات مستنية</h2><div className="list">
            {invites.map(i => (
              <div key={i.email} className="li">
                <div className="grow"><b dir="ltr">{i.email}</b><div className="muted">{levelNames(i.levelIds)}</div></div>
                <button className="btn" style={{ minHeight: 36 }} onClick={() => cancelInvite(i)}>إلغاء</button>
              </div>
            ))}
          </div>
          <div className="note">الخادم يفتح التطبيق ويدخل بنفس إيميل جوجل ده، وهيلاقي زرار يقبل الدعوة.</div></div>
        )}

        {lead && draft && (
          <div className="card">
            <h2>ضيف خادم</h2>
            <label className="field" htmlFor="email"><span>إيميل جوجل بتاعه</span>
              <input id="email" className="input" dir="ltr" inputMode="email" placeholder="name@gmail.com" value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} /></label>
            {rolePicker(draft.role, role => setDraft({ ...draft, role }))}
            <div className="field"><span>المستويات اللي هيخدمها</span>{levelPicker(draft.levelIds, levelIds => setDraft({ ...draft, levelIds }))}</div>
            {error && <div className="alert-t" role="alert">{error}</div>}
            <div className="row"><button className="btn grow" onClick={() => { setDraft(null); setError(''); }}>إلغاء</button><button className="btnp grow" onClick={sendInvite}>ابعت الدعوة</button></div>
          </div>
        )}
      </main>
      {lead && !draft && <div className="bar gutter"><div>
        <button className="btnp grow" onClick={() => setDraft({ email: '', role: 'servant', levelIds: [], invitedBy: me.uid })}>ضيف خادم</button>
      </div></div>}
    </>
  );
}
