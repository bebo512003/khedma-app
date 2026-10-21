import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData, useIsLead, useStore } from '../data/store';
import { count } from '../data/logic';
import { renumber, repeatedCodes } from '../data/codes';

const people = (n: number) => count(n, 'مخدوم', 'مخدومين', 'مخدومين');

/** Lead only: every member gets a fresh code by their level now (1001… for the first level). Logins keep their PINs. */
export default function MemberCodes() {
  const [data, update] = useData();
  const lead = useIsLead();
  const { cloud } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ moved: number; retired: string[] } | null>(null);

  const plan = useMemo(() => renumber(data), [data]);
  const repeated = repeatedCodes(data.members);
  const changing = data.members.filter(m => plan.get(m.id) !== m.code);
  // Two members on one code who both have a login: no telling whose it is, so both get a new PIN.
  const unclear = data.members.filter(m => m.account && repeated.has(m.code) && data.members.filter(x => x.code === m.code && x.account).length > 1);
  const sample = [...data.levels].sort((a, b) => a.order - b.order);

  if (!lead) return <main className="main gutter"><div className="card">الخادم المسؤول بس هو اللي يقدر يرقّم الأكواد من جديد.</div></main>;

  const run = async () => {
    setBusy(true); setError('');
    const retiredIds = new Set(unclear.map(m => m.id));
    try {
      if (cloud) {
        const { moveLogins, retireAccounts } = await import('../firebase/accounts');
        const moves = changing.filter(m => m.account && !retiredIds.has(m.id)).map(m => ({ from: m.code, to: plan.get(m.id)! }));
        if ((moves.length || unclear.length) && !navigator.onLine) throw new Error('offline');
        await moveLogins(moves);
        if (unclear.length) {
          const { deleteDoc } = await import('firebase/firestore');
          const { servantFb } = await import('../firebase/app');
          const { ref } = await import('../firebase/paths');
          await Promise.all([...new Set(unclear.map(m => m.code))].map(c => deleteDoc(ref(servantFb().db, 'logins', c)).catch(() => undefined)));
          await retireAccounts(unclear.map(m => m.account!.uid));
        }
      }
      update(d => {
        const codes = renumber(d);
        return {
          ...d,
          members: d.members.map(m => ({ ...m, code: codes.get(m.id) ?? m.code, ...(retiredIds.has(m.id) ? { account: undefined, pinHash: undefined } : {}) })),
        };
      });
      setDone({ moved: changing.length, retired: unclear.map(m => m.name) });
    } catch (e) {
      setError((e as Error).message === 'offline' || !navigator.onLine ? 'الترقيم محتاج نت عشان ينقل بيانات الدخول.' : 'ماقدرناش نخلّص، جرّب تاني.');
    }
    setBusy(false);
  };

  return (
    <>
      <header className="top gutter"><div className="row">
        <Link to="/members" className="icon" aria-label="رجوع">→</Link><h1>ترقيم الأكواد</h1>
      </div></header>
      <main className="main gutter">
        {done ? (
          <div className="card">
            <h2>✓ اترقّم {people(done.moved)}</h2>
            <div className="note">اطبع كروت QR من جديد، الكروت القديمة مش هتشتغل. الرقم السري لكل واحد زي ما هو، بس يدخل بالكود الجديد.</div>
            {done.retired.length > 0 && <div className="alert-t">محتاجين رقم سري جديد: {done.retired.join('، ')}</div>}
            <div className="row" style={{ gap: 6 }}><Link to="/cards" className="btnp grow">كروت QR</Link><Link to="/members" className="btn grow">المخدومين</Link></div>
          </div>
        ) : (
          <div className="card">
            <div className="note">كل مخدوم هياخد كود جديد من 4 أرقام: أول رقم هو المستوى، والباقي عدّ بالترتيب الأبجدي.</div>
            <div className="list">
              {sample.map((l, i) => <div key={l.id} className="li"><span className="grow">{l.name}</span><b dir="ltr">{i + 1}001، {i + 1}002…</b></div>)}
            </div>
            <div className="muted">الكود بيتحط مرة واحدة لما المخدوم يتضاف، ولو اتنقل مستوى كوده بيفضل زي ما هو، عشان الكود هو اللي بيدخل بيه وهو اللي على الكارت. لو حبيت الأكواد ترجع تطابق المستويات (مثلاً أول السنة) ارقّم من هنا تاني.</div>
            {repeated.size > 0 && <div className="alert-t">فيه {count(repeated.size, 'كود متكرر', 'كودين متكررين', 'أكواد متكررة')} دلوقتي.</div>}
            <div>هيتغير كود {people(changing.length)} من {data.members.length}.</div>
            {unclear.length > 0 && <div className="alert-t">{unclear.map(m => m.name).join('، ')} عندهم نفس الكود وكل واحد له رقم سري، فهيحتاجوا رقم سري جديد.</div>}
            {error && <div className="alert-t" role="alert">{error}</div>}
            <button className="btnp" aria-disabled={busy || !changing.length} onClick={() => !busy && changing.length && run()}>{busy ? 'بيترقّم…' : 'رقّم الأكواد'}</button>
          </div>
        )}
      </main>
    </>
  );
}
