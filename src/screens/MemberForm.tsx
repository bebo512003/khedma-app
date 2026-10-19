import { useState, type ChangeEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useData, useIsLead, useStore } from '../data/store';
import { RANKS, type Gender, type Member } from '../data/types';
import { cancelled, shrinkPhoto as shrink } from '../data/photo';
import { GRADES, contact, hashPin, levelForGrade, newPin, todayISO, uid, waLink } from '../data/logic';

export default function MemberForm() {
  const { memberId } = useParams();
  const [data, update] = useData();
  const nav = useNavigate();
  const existing = data.members.find(m => m.id === memberId);
  const [m, setM] = useState<Member>(existing ?? {
    id: uid(), code: String(data.nextCode).padStart(4, '0'), name: '', gender: 'm', levelId: 'l2', grade: 'تالتة ابتدائي',
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const [shownPin, setShownPin] = useState('');
  const [pinBusy, setPinBusy] = useState(false);
  const { cloud } = useStore();
  const lead = useIsLead();
  const set = (p: Partial<Member>) => setM(x => ({ ...x, ...p }));

  const onPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    try { set({ photo: await shrink(f) }); } catch (e) { if (!cancelled(e)) setError('الصورة دي مش هتنفع، جرّب صورة تانية.'); }
  };

  const save = () => {
    if (!m.name.trim()) { setError('اكتب اسم المخدوم.'); return; }
    const clean: Member = { ...m, name: m.name.trim(), rank: m.gender === 'm' ? m.rank : undefined, example: existing?.example };
    update(d => existing
      ? { ...d, members: d.members.map(x => x.id === clean.id ? clean : x) }
      : { ...d, members: [...d.members, clean], nextCode: d.nextCode + 1 });
    nav(existing ? `/members/${clean.id}` : '/members', { replace: true });
  };
  /** New PIN: shown once to the servant, stored only as a hash. */
  const makePin = async () => {
    const pin = newPin();
    if (!cloud) {
      const pinHash = await hashPin(m.id, pin);
      set({ pinHash });
      if (existing) update(d => ({ ...d, members: d.members.map(x => x.id === m.id ? { ...x, pinHash } : x) }));
      setShownPin(pin);
      return;
    }
    // Cloud: creates the member's Firebase login. The member must already be saved so the login has someone to point to.
    setPinBusy(true); setError('');
    try {
      const { createMemberLogin } = await import('../firebase/accounts');
      const account = await createMemberLogin(existing ?? m, pin);
      set({ account });
      update(d => ({ ...d, members: d.members.map(x => x.id === m.id ? { ...x, account } : x) }));
      setShownPin(pin);
    } catch {
      setError(navigator.onLine ? 'ماقدرناش نعمل الرقم السري، جرّب تاني.' : 'عمل الرقم السري محتاج نت.');
    }
    setPinBusy(false);
  };
  const remove = () => {
    update(d => ({ ...d, members: d.members.filter(x => x.id !== m.id) }));
    // Their login and the copy the member app reads go too, so the old code and PIN stop working.
    if (cloud) Promise.all([import('../firebase/app'), import('firebase/firestore'), import('../firebase/paths')]).then(([{ servantFb }, { deleteDoc }, paths]) => {
      const db = servantFb().db;
      for (const r of [paths.ref(db, 'memberViews', m.id), paths.ref(db, 'logins', m.code), ...(m.account ? [paths.ref(db, 'accounts', m.account.uid)] : [])]) deleteDoc(r).catch(() => undefined);
    });
    nav('/members', { replace: true });
  };

  return (
    <>
      <header className="top gutter"><div className="row between">
        <div className="row"><Link to={existing ? `/members/${m.id}` : '/members'} className="icon" aria-label="رجوع">→</Link><h1>{existing ? `تعديل ${m.name}` : 'مخدوم جديد'}</h1></div>
        <span className="tag tag-ex">كود {m.code}</span>
      </div></header>
      <main className="main gutter">
        <div className="row">
          <label className="av" style={{ width: 76, height: 76, borderRadius: 18, cursor: 'pointer' }} htmlFor="photo" aria-label="صورة المخدوم">
            {m.photo ? <img src={m.photo} alt="" /> : 'صورة'}
          </label>
          <input id="photo" type="file" accept="image/*" hidden onChange={onPhoto} />
          <label className="field grow" htmlFor="name"><span>الاسم</span>
            <input id="name" className="input" value={m.name} onChange={e => set({ name: e.target.value })} placeholder="الاسم التلاتي" /></label>
        </div>

        <div className="field"><span>النوع</span>
          <div className="seg">{(['m', 'f'] as Gender[]).map(g =>
            <button key={g} aria-pressed={m.gender === g} onClick={() => set({ gender: g })}>{g === 'm' ? 'ذكر' : 'أنثى'}</button>)}</div>
        </div>

        <label className="field" htmlFor="grade"><span>السنة الدراسية</span>
          <select id="grade" className="input" value={m.grade} onChange={e => set({ grade: e.target.value, levelId: levelForGrade(e.target.value) })}>
            {GRADES.map(g => <option key={g}>{g}</option>)}
          </select></label>

        <label className="field" htmlFor="birth"><span>تاريخ الميلاد</span>
          <input id="birth" type="date" className="input" value={m.birthdate ?? ''} max={todayISO()} onChange={e => set({ birthdate: e.target.value || undefined })} /></label>

        <div className="field"><span>المستوى</span>
          <div className="chips">{data.levels.map(l =>
            <button key={l.id} className="chip" aria-pressed={m.levelId === l.id} onClick={() => set({ levelId: l.id })}>{l.name}</button>)}</div>
        </div>

        {m.gender === 'm' && (
          <div className="field"><span>الرتبة الشماسية</span>
            <div className="chips">
              <button className="chip" aria-pressed={!m.rank} onClick={() => set({ rank: undefined })}>لسه</button>
              {RANKS.map(r => <button key={r} className="chip" aria-pressed={m.rank === r} onClick={() => set({ rank: r })}>{r}</button>)}
            </div>
          </div>
        )}

        <label className="field" htmlFor="ownphone"><span>موبايل المخدوم (واتساب)</span>
          <input id="ownphone" className="input" inputMode="tel" dir="ltr" style={{ textAlign: 'right' }} value={m.phone ?? ''} onChange={e => set({ phone: e.target.value || undefined })} placeholder="للكبار اللي معاهم موبايل" /></label>

        <label className="field" htmlFor="phone"><span>موبايل ولي الأمر (واتساب)</span>
          <input id="phone" className="input" inputMode="tel" dir="ltr" style={{ textAlign: 'right' }} value={m.parentPhone ?? ''} onChange={e => set({ parentPhone: e.target.value || undefined })} placeholder="01xxxxxxxxx" /></label>
        <div className="note">رسايل الافتقاد وأعياد الميلاد بتروح لموبايل المخدوم لو موجود، ولو مش موجود بتروح لولي الأمر.</div>

        <div className="card">
          <div className="row between"><b>دخول المخدوم للتطبيق</b><span className="muted">{m.pinHash || m.account ? 'معمول له رقم سري' : 'لسه مالوش رقم سري'}</span></div>
          {shownPin ? (
            <>
              <div className="row between"><span>الكود <b dir="ltr">{m.code}</b></span><span>الرقم السري <b dir="ltr" style={{ fontSize: 20, letterSpacing: 4 }}>{shownPin}</b></span></div>
              <div className="note">الرقم ده بيظهر مرة واحدة بس. ابعته دلوقتي أو اكتبه عندك.{existing ? '' : ' هيتحفظ لما تدوس احفظ.'}</div>
              {contact(m).who && <a className="btnp" target="_blank" rel="noopener noreferrer"
                href={waLink(contact(m).phone, `بيانات دخول ${m.name || 'المخدوم'} لتطبيق مدرسة الشهيد اسطفانوس للشمامسة:\nالكود: ${m.code}\nالرقم السري: ${shownPin}`)}>{contact(m).who === 'self' ? 'ابعتهمله على واتساب' : 'ابعتهم لولي الأمر على واتساب'}</a>}
            </>
          ) : null}
          {existing && <Link to={`/cards?member=${m.id}`} className="btn">اطبع كارت الـ QR</Link>}
          {shownPin ? null : cloud && !existing
            ? <div className="note">احفظ المخدوم الأول، وبعدين افتحه تاني واعمله رقم سري.</div>
            : <button className="btn" disabled={pinBusy} onClick={makePin}>{pinBusy ? 'بيتعمل…' : m.pinHash || m.account ? 'اعمل رقم سري جديد' : 'اعمل رقم سري'}</button>}
        </div>

        {error && <div className="alert-t" role="alert">{error}</div>}

        {existing && lead && (confirmDelete
          ? <div className="card alert"><b>تمسح {m.name} نهائي؟</b><div className="row"><button className="btn grow" onClick={() => setConfirmDelete(false)}>لا</button><button className="btnp grow" onClick={remove}>امسح</button></div></div>
          : <button className="btn" onClick={() => setConfirmDelete(true)}>امسح المخدوم</button>)}
      </main>
      <div className="bar gutter"><div>
        <Link to={existing ? `/members/${m.id}` : '/members'} replace className="btn">إلغاء</Link>
        <button className="btnp grow" onClick={save}>احفظ</button>
      </div></div>
    </>
  );
}
