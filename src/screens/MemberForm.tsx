import { useState, type ChangeEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useData } from '../data/store';
import { RANKS, type Gender, type Member } from '../data/types';
import { hashPin, newPin, uid, waLink } from '../data/logic';

const GRADES = [
  'أولى ابتدائي', 'تانية ابتدائي', 'تالتة ابتدائي', 'رابعة ابتدائي', 'خامسة ابتدائي', 'سادسة ابتدائي',
  'أولى إعدادي', 'تانية إعدادي', 'تالتة إعدادي', 'أولى ثانوي', 'تانية ثانوي', 'تالتة ثانوي', 'جامعة', 'خريج',
];
/** Default level from school grade: grades 1-2 → ابتدائي 1, 3-6 → ابتدائي 2, prep and up → شباب. */
const levelForGrade = (g: string) => { const i = GRADES.indexOf(g); return i < 2 ? 'l1' : i < 6 ? 'l2' : 'l3'; };

/** Shrinks a photo to a 256px square JPEG (~15KB) so it can live inside the member record. */
function shrink(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = 256, c = document.createElement('canvas'); c.width = s; c.height = s;
      const side = Math.min(img.width, img.height);
      c.getContext('2d')!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, s, s);
      resolve(c.toDataURL('image/jpeg', 0.72));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

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
  const set = (p: Partial<Member>) => setM(x => ({ ...x, ...p }));

  const onPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    try { set({ photo: await shrink(f) }); } catch { setError('الصورة دي مش هتنفع، جرّب صورة تانية.'); }
  };

  const save = () => {
    if (!m.name.trim()) { setError('اكتب اسم المخدوم.'); return; }
    const clean: Member = { ...m, name: m.name.trim(), rank: m.gender === 'm' ? m.rank : undefined, example: existing?.example };
    update(d => existing
      ? { ...d, members: d.members.map(x => x.id === clean.id ? clean : x) }
      : { ...d, members: [...d.members, clean], nextCode: d.nextCode + 1 });
    nav('/members', { replace: true });
  };
  /** New PIN: shown once to the servant, stored only as a hash. */
  const makePin = async () => {
    const pin = newPin();
    const pinHash = await hashPin(m.id, pin);
    set({ pinHash });
    if (existing) update(d => ({ ...d, members: d.members.map(x => x.id === m.id ? { ...x, pinHash } : x) }));
    setShownPin(pin);
  };
  const remove = () => { update(d => ({ ...d, members: d.members.filter(x => x.id !== m.id) })); nav('/members', { replace: true }); };

  return (
    <>
      <header className="top gutter"><div className="row between">
        <div className="row"><Link to="/members" className="icon" aria-label="رجوع">→</Link><h1>{existing ? m.name : 'مخدوم جديد'}</h1></div>
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

        <label className="field" htmlFor="phone"><span>موبايل ولي الأمر (واتساب)</span>
          <input id="phone" className="input" inputMode="tel" dir="ltr" style={{ textAlign: 'right' }} value={m.parentPhone ?? ''} onChange={e => set({ parentPhone: e.target.value })} placeholder="01xxxxxxxxx" /></label>

        <div className="card">
          <div className="row between"><b>دخول المخدوم للتطبيق</b><span className="muted">{m.pinHash ? 'معمول له رقم سري' : 'لسه مالوش رقم سري'}</span></div>
          {shownPin ? (
            <>
              <div className="row between"><span>الكود <b dir="ltr">{m.code}</b></span><span>الرقم السري <b dir="ltr" style={{ fontSize: 20, letterSpacing: 4 }}>{shownPin}</b></span></div>
              <div className="note">الرقم ده بيظهر مرة واحدة بس. ابعته دلوقتي أو اكتبه عندك.{existing ? '' : ' هيتحفظ لما تدوس احفظ.'}</div>
              {m.parentPhone && <a className="btnp" target="_blank" rel="noopener noreferrer"
                href={waLink(m.parentPhone, `بيانات دخول ${m.name || 'المخدوم'} لتطبيق مدرسة الشهيد اسطفانوس للشمامسة:\nالكود: ${m.code}\nالرقم السري: ${shownPin}`)}>ابعتهم لولي الأمر على واتساب</a>}
            </>
          ) : <button className="btn" onClick={makePin}>{m.pinHash ? 'اعمل رقم سري جديد' : 'اعمل رقم سري'}</button>}
        </div>

        {error && <div className="alert-t" role="alert">{error}</div>}

        {existing && (confirmDelete
          ? <div className="card alert"><b>تمسح {m.name} نهائي؟</b><div className="row"><button className="btn grow" onClick={() => setConfirmDelete(false)}>لا</button><button className="btnp grow" onClick={remove}>امسح</button></div></div>
          : <button className="btn" onClick={() => setConfirmDelete(true)}>امسح المخدوم</button>)}
      </main>
      <div className="bar gutter"><div>
        <Link to="/members" className="btn">إلغاء</Link>
        <button className="btnp grow" onClick={save}>احفظ</button>
      </div></div>
    </>
  );
}
