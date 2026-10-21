import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData, useStore } from '../data/store';
import { DEFAULT_PERMS, PERMS, ROLE_LABELS, type Invite, type Perm, type Role, type Servant } from '../data/types';
import { waLink } from '../data/logic';

/** Alphabetical by the name itself, so تاسوني and أبونا don't all bunch together. */
const byName = (n: string) => n.trim().replace(/^(تاسوني|أبونا|ابونا|القمص|القس)\s+/, '');

/** The team with their profiles. The admin also invites servants by Google email and chooses each one's role, levels and permissions. */
export default function Team() {
  const [data] = useData();
  const { servant: me } = useStore();
  const [servants, setServants] = useState<Servant[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [draft, setDraft] = useState<Invite | null>(null);
  const [editing, setEditing] = useState<Servant | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // A phone servant's password, shown once right after it's made.
  const [made, setMade] = useState<{ name: string; phone: string; password: string } | null>(null);
  const [name, setName] = useState('');
  const levels = [...data.levels].sort((a, b) => a.order - b.order);

  useEffect(() => {
    let stop = () => {};
    (async () => {
      const [{ servantFb }, { onSnapshot }, paths] = await Promise.all([import('../firebase/app'), import('firebase/firestore'), import('../firebase/paths')]);
      const { db } = servantFb();
      const a = onSnapshot(paths.col(db, 'servants'), s => setServants(s.docs.map(d => d.data() as Servant).sort((a, b) => byName(a.name).localeCompare(byName(b.name), 'ar'))));
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
    const api = await import('../firebase/servantPhone');
    const phone = /^[+\d\s-]+$/.test(raw) ? api.localPhone(raw) : null;
    if (/^[+\d\s-]+$/.test(raw) && !phone) { setError('اكتب رقم موبايل مصري صحيح، زي 01012345678.'); return; }
    if (!phone && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(raw)) { setError('اكتب إيميل جوجل صحيح أو رقم موبايل.'); return; }
    if (phone && !name.trim()) { setError('اكتب اسم الخادم.'); return; }
    if (draft.levelIds.length === 0) { setError('اختار مستوى واحد على الأقل.'); return; }
    if (phone && servants.some(s => s.email === phone)) { setError('الرقم ده متسجل لخادم قبل كده. افتحه واعمله باسورد جديد.'); return; }
    const { db, setDoc, paths } = await fs();
    const perms = draft.role === 'servant' ? draft.perms ?? [] : undefined;
    if (!phone) {
      await setDoc(paths.ref(db, 'invites', raw), JSON.parse(JSON.stringify({ ...draft, email: raw, invitedBy: me.uid, perms })));
      setDraft(null); setError('');
      return;
    }
    // No SMS: the admin makes the login here and hands the servant their first password.
    setBusy(true); setError('');
    try {
      const password = api.newPassword();
      const { uid, n } = await api.createServantLogin(phone, password);
      const sv: Servant = { uid, name: name.trim(), email: phone, phone, role: draft.role, levelIds: draft.levelIds, login: n, ...(perms ? { perms } : {}) };
      await setDoc(paths.ref(db, 'servants', uid), JSON.parse(JSON.stringify(sv)));
      setMade({ name: sv.name, phone, password }); setDraft(null); setName('');
    } catch { setError(navigator.onLine ? 'ماقدرناش نعمل الحساب، جرّب تاني.' : 'محتاج نت للخطوة دي.'); }
    setBusy(false);
  };
  /** A browser can't change someone else's password, so the admin makes them a new login and moves their record to it. */
  const resetPassword = async (s: Servant) => {
    setBusy(true); setError('');
    try {
      const api = await import('../firebase/servantPhone');
      const { db, setDoc, deleteDoc, paths } = await fs();
      const password = api.newPassword();
      const { uid, n } = await api.createServantLogin(s.email, password, s.login ?? 0);
      await setDoc(paths.ref(db, 'servants', uid), JSON.parse(JSON.stringify({ ...s, uid, login: n })));
      await deleteDoc(paths.ref(db, 'servants', s.uid));
      setMade({ name: s.name, phone: s.email, password }); setEditing(null);
    } catch { setError(navigator.onLine ? 'ماقدرناش نعمل باسورد جديد، جرّب تاني.' : 'محتاج نت للخطوة دي.'); }
    setBusy(false);
  };
  const saveServant = async () => {
    if (!editing) return;
    const { db, setDoc, paths } = await fs();
    await setDoc(paths.ref(db, 'servants', editing.uid), JSON.parse(JSON.stringify({ ...editing, perms: editing.role === 'servant' ? editing.perms ?? PERMS.map(([p]) => p) : undefined })));
    setEditing(null);
  };
  const removeServant = async (s: Servant) => { const { db, deleteDoc, paths } = await fs(); await deleteDoc(paths.ref(db, 'servants', s.uid));
    if (s.login) await deleteDoc(paths.ref(db, 'servantLogins', s.email)).catch(() => undefined);
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

        {admin && made && (
          <div className="card">
            <h2>✓ حساب {made.name} جاهز</h2>
            <div className="row between"><span>الرقم <b dir="ltr">{made.phone}</b></span><span>الباسورد <b dir="ltr" style={{ fontSize: 20, letterSpacing: 3 }}>{made.password}</b></span></div>
            <div className="alert-t">الباسورد ده بيظهر مرة واحدة بس. ابعته للخادم دلوقتي، ويقدر يغيّره من بروفايله.</div>
            <a className="btnp" href={waLink(made.phone, `بيانات دخولك لتطبيق مدرسة الشهيد اسطفانوس للشمامسة:\nافتح ${location.origin}${location.pathname} ودوس «ادخل برقم التليفون»\nالرقم: ${made.phone}\nالباسورد: ${made.password}`)} target="_blank" rel="noopener noreferrer">ابعتهوله على واتساب</a>
            <button className="btn" onClick={() => setMade(null)}>تمام</button>
          </div>
        )}

        {admin && editing && (
          <div className="card">
            <h2>{editing.name}</h2>
            <div className="muted" dir="ltr" style={{ textAlign: 'right' }}>{editing.email}</div>
            {editing.uid !== me.uid && rolePicker(editing.role, role => setEditing({ ...editing, role }))}
            <div className="field"><span>المستويات</span>{levelPicker(editing.levelIds, levelIds => setEditing({ ...editing, levelIds }))}</div>
            {editing.role === 'servant' && permPicker(editing.perms, perms => setEditing({ ...editing, perms }))}
            <div className="row"><button className="btn grow" onClick={() => setEditing(null)}>إلغاء</button><button className="btnp grow" onClick={saveServant}>احفظ</button></div>
            {editing.login && <button className="btn" disabled={busy} onClick={() => resetPassword(editing)}>{busy ? 'بيتعمل…' : 'اعمله باسورد جديد'}</button>}
            {error && <div className="alert-t" role="alert">{error}</div>}
            {editing.uid !== me.uid && <button className="btn" onClick={() => removeServant(editing)}>شيله من الفريق</button>}
          </div>
        )}

        {admin && invites.length > 0 && (
          <div className="card"><h2>دعوات مستنية</h2><div className="list">
            {invites.map(i => (
              <div key={i.email} className="li">
                <div className="grow"><b dir="ltr">{i.email}</b><div className="muted">{[ROLE_LABELS[i.role], levelNames(i.levelIds), permNames(i)].filter(Boolean).join(' • ')}</div></div>
                <button className="btn" style={{ minHeight: 36 }} onClick={() => cancelInvite(i)}>إلغاء</button>
              </div>
            ))}
          </div>
          <div className="note">الخادم يفتح التطبيق ويدخل بنفس إيميل جوجل ده، وهيلاقي زرار يقبل الدعوة. ولو ضفته برقم موبايله هتاخد منه باسورد تبعتهوله، ويدخل بـ «ادخل برقم التليفون».</div></div>
        )}

        {admin && draft && (
          <div className="card">
            <h2>ضيف خادم</h2>
            <label className="field" htmlFor="email"><span>إيميل جوجل بتاعه أو رقم موبايله</span>
              <input id="email" className="input" dir="ltr" inputMode="email" placeholder="name@gmail.com أو 01012345678" value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} /></label>
            {/^[+\d\s-]{3,}$/.test(draft.email.trim()) && <label className="field" htmlFor="sname"><span>اسمه</span>
              <input id="sname" className="input" value={name} maxLength={80} onChange={e => setName(e.target.value)} /></label>}
            {rolePicker(draft.role, role => setDraft({ ...draft, role }))}
            <div className="field"><span>المستويات اللي هيخدمها</span>{levelPicker(draft.levelIds, levelIds => setDraft({ ...draft, levelIds }))}</div>
            {draft.role === 'servant' && permPicker(draft.perms, perms => setDraft({ ...draft, perms }))}
            {error && <div className="alert-t" role="alert">{error}</div>}
            <div className="row"><button className="btn grow" onClick={() => { setDraft(null); setError(''); }}>إلغاء</button><button className="btnp grow" disabled={busy} onClick={sendInvite}>{/^[+\d\s-]{3,}$/.test(draft.email.trim()) ? (busy ? 'بيتعمل…' : 'اعمل حسابه') : 'ابعت الدعوة'}</button></div>
          </div>
        )}
      </main>
      {admin && !draft && <div className="bar gutter"><div>
        <button className="btnp grow" onClick={() => setDraft({ email: '', role: 'servant', levelIds: [], perms: DEFAULT_PERMS, invitedBy: me.uid })}>ضيف خادم</button>
      </div></div>}
    </>
  );
}
