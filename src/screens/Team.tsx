import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData, useStore } from '../data/store';
import { DEFAULT_PERMS, PERMS, ROLE_LABELS, type Invite, type Perm, type Role, type Servant } from '../data/types';
import { waLink } from '../data/logic';

/** The team with their profiles. The admin also invites servants by Google email and chooses each one's role, levels and permissions. */
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
      const b = me?.role === 'admin' ? onSnapshot(paths.col(db, 'invites'), s => setInvites(s.docs.map(d => d.data() as Invite))) : () => {};
      stop = () => { a(); b(); };
    })();
    return () => stop();
  }, [me?.role]);

  if (!me) return <main className="main gutter"><div className="card">الصفحة دي للخدام. <Link to="/">ارجع</Link></div></main>;
  const admin = me.role === 'admin';

  const fs = async () => {
    const [{ servantFb }, firestore, paths] = await Promise.all([import('../firebase/app'), import('firebase/firestore'), import('../firebase/paths')]);
    return { db: servantFb().db, ...firestore, paths };
  };
  const levelNames = (ids: string[]) => ids.includes('*') ? 'كل المستويات' : ids.map(id => data.levels.find(l => l.id === id)?.name).filter(Boolean).join('، ') || 'من غير مستويات';
  const toggleLevel = (ids: string[], id: string) => id === '*' ? (ids.includes('*') ? [] : ['*'])
    : ids.includes(id) ? ids.filter(x => x !== id) : [...ids.filter(x => x !== '*'), id];

  const sendInvite = async () => {
    if (!draft) return;
    const raw = draft.email.trim().toLowerCase();
    // A mobile number invites them to sign in by phone; it's stored as +20… like the sign-in gives it.
    const phone = /^[+\d\s-]+$/.test(raw) ? (await import('../firebase/servantPhone')).toE164(raw) : null;
    const email = phone ?? raw;
    if (!phone && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setError(/^[+\d\s-]+$/.test(raw) ? 'اكتب رقم موبايل مصري صحيح، زي 01012345678.' : 'اكتب إيميل جوجل صحيح.'); return; }
    if (draft.levelIds.length === 0) { setError('اختار مستوى واحد على الأقل.'); return; }
    const { db, setDoc, paths } = await fs();
    await setDoc(paths.ref(db, 'invites', email), JSON.parse(JSON.stringify({ ...draft, email, invitedBy: me.uid, perms: draft.role === 'servant' ? draft.perms ?? [] : undefined })));
    setDraft(null); setError('');
  };
  const saveServant = async () => {
    if (!editing) return;
    const { db, setDoc, paths } = await fs();
    await setDoc(paths.ref(db, 'servants', editing.uid), JSON.parse(JSON.stringify({ ...editing, perms: editing.role === 'servant' ? editing.perms ?? PERMS.map(([p]) => p) : undefined })));
    setEditing(null);
  };
  const removeServant = async (s: Servant) => { const { db, deleteDoc, paths } = await fs(); await deleteDoc(paths.ref(db, 'servants', s.uid));
    // A leftover invite would let them join again on their own.
    await deleteDoc(paths.ref(db, 'invites', s.email)).catch(() => undefined); setEditing(null); };
  const cancelInvite = async (i: Invite) => { const { db, deleteDoc, paths } = await fs(); await deleteDoc(paths.ref(db, 'invites', i.email)); };

  const levelPicker = (ids: string[], onChange: (ids: string[]) => void) => (
    <div className="chips">
      <button className="chip" aria-pressed={ids.includes('*')} onClick={() => onChange(toggleLevel(ids, '*'))}>كل المستويات</button>
      {levels.map(l => <button key={l.id} className="chip" aria-pressed={ids.includes('*') || ids.includes(l.id)} onClick={() => onChange(toggleLevel(ids, l.id))}>{l.name}</button>)}
    </div>
  );
  const rolePicker = (role: Role, onChange: (r: Role) => void) => (
    <div className="field"><span>الدور</span>
      <div className="seg">
        {(['servant', 'lead', 'admin'] as const).map(r => <button key={r} aria-pressed={role === r} onClick={() => onChange(r)}>{ROLE_LABELS[r]}</button>)}
      </div>
      <span className="muted">{role === 'admin' ? 'كل حاجة، وكمان بيدير الفريق ويوزع الصلاحيات.' : role === 'lead' ? 'كل حاجة في المدرسة (المستويات والترم ومسح المخدومين والتنبيهات)، من غير إدارة الفريق.' : 'بس الصلاحيات اللي هتختارها تحت.'}</span>
    </div>
  );
  // Missing perms (servants from before permissions existed) means every permission.
  const permPicker = (perms: Perm[] | undefined, onChange: (p: Perm[]) => void) => {
    const cur = perms ?? PERMS.map(([p]) => p);
    return (
      <div className="field"><span>الصلاحيات</span>
        {PERMS.map(([p, label]) => (
          <label key={p} className="row" style={{ gap: 8, minHeight: 36 }}>
            <input type="checkbox" checked={cur.includes(p)} onChange={e => onChange(e.target.checked ? [...cur, p] : cur.filter(x => x !== p))} />{label}
          </label>
        ))}
        <span className="muted">أي خادم يقدر يشوف المخدومين والألحان ويعمل افتقاد.</span>
      </div>
    );
  };
  const permNames = (s: { role: Role; perms?: Perm[] }) => s.role !== 'servant' || !s.perms ? '' : s.perms.length === 1 ? 'صلاحية واحدة' : s.perms.length === 2 ? 'صلاحيتين' : s.perms.length ? `${s.perms.length} صلاحيات` : 'مشاهدة بس';

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
                <div className="muted">{[ROLE_LABELS[s.role] ?? 'خادم', s.rank, levelNames(s.levelIds), permNames(s)].filter(Boolean).join(' • ')}</div>
                {s.about && <div className="muted">{s.about}</div>}
              </div>
              <div className="row li-actions">
              {s.phone && s.uid !== me.uid && <a className="btn" style={{ minHeight: 36 }} href={waLink(s.phone, '')} target="_blank" rel="noopener noreferrer">واتساب</a>}
              {s.uid === me.uid && <Link className="btn" style={{ minHeight: 36 }} to="/profile">بروفايلي</Link>}
              {admin && <button className="btn" style={{ minHeight: 36 }} onClick={() => setEditing(s)}>صلاحيات</button>}
              </div>
            </div>
          ))}
        </div></div>

        {admin && editing && (
          <div className="card">
            <h2>{editing.name}</h2>
            <div className="muted" dir="ltr" style={{ textAlign: 'right' }}>{editing.email.replace(/^\+2/, '')}</div>
            {editing.uid !== me.uid && rolePicker(editing.role, role => setEditing({ ...editing, role }))}
            <div className="field"><span>المستويات</span>{levelPicker(editing.levelIds, levelIds => setEditing({ ...editing, levelIds }))}</div>
            {editing.role === 'servant' && permPicker(editing.perms, perms => setEditing({ ...editing, perms }))}
            <div className="row"><button className="btn grow" onClick={() => setEditing(null)}>إلغاء</button><button className="btnp grow" onClick={saveServant}>احفظ</button></div>
            {editing.uid !== me.uid && <button className="btn" onClick={() => removeServant(editing)}>شيله من الفريق</button>}
          </div>
        )}

        {admin && invites.length > 0 && (
          <div className="card"><h2>دعوات مستنية</h2><div className="list">
            {invites.map(i => (
              <div key={i.email} className="li">
                <div className="grow"><b dir="ltr">{i.email.replace(/^\+2/, '')}</b><div className="muted">{[ROLE_LABELS[i.role], levelNames(i.levelIds), permNames(i)].filter(Boolean).join(' • ')}</div></div>
                <button className="btn" style={{ minHeight: 36 }} onClick={() => cancelInvite(i)}>إلغاء</button>
              </div>
            ))}
          </div>
          <div className="note">الخادم يفتح التطبيق ويدخل بنفس إيميل جوجل ده، أو بـ «ادخل برقم الموبايل» لو ضفته برقمه، وهيلاقي زرار يقبل الدعوة.</div></div>
        )}

        {admin && draft && (
          <div className="card">
            <h2>ضيف خادم</h2>
            <label className="field" htmlFor="email"><span>إيميل جوجل بتاعه أو رقم موبايله</span>
              <input id="email" className="input" dir="ltr" inputMode="email" placeholder="name@gmail.com أو 01012345678" value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} /></label>
            {rolePicker(draft.role, role => setDraft({ ...draft, role }))}
            <div className="field"><span>المستويات اللي هيخدمها</span>{levelPicker(draft.levelIds, levelIds => setDraft({ ...draft, levelIds }))}</div>
            {draft.role === 'servant' && permPicker(draft.perms, perms => setDraft({ ...draft, perms }))}
            {error && <div className="alert-t" role="alert">{error}</div>}
            <div className="row"><button className="btn grow" onClick={() => { setDraft(null); setError(''); }}>إلغاء</button><button className="btnp grow" onClick={sendInvite}>ابعت الدعوة</button></div>
          </div>
        )}
      </main>
      {admin && !draft && <div className="bar gutter"><div>
        <button className="btnp grow" onClick={() => setDraft({ email: '', role: 'servant', levelIds: [], perms: DEFAULT_PERMS, invitedBy: me.uid })}>ضيف خادم</button>
      </div></div>}
    </>
  );
}
