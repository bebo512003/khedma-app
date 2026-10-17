import { hymnsCount, POINTS, sessionsCount } from '../data/logic';
import { useView } from './Layout';

const monthName = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { month: 'long' });

export default function MemberRank() {
  const v = useView();
  const b = v.breakdown;
  // Members see the top 3 and their own place only, never the full list.
  const shown = [...v.top];
  if (v.place > 3) shown.push({ id: v.memberId, name: v.name, photo: v.photo, points: v.points, place: v.place });
  const parts: [string, number][] = [
    [`حضور ${sessionsCount(b.attended)}`, b.attendance],
    ['تقييم الحصص (متوسط كل حصة)', b.rating],
    [`وصلت "حافظه" في ${hymnsCount(b.memorized)}`, b.memorized * POINTS.memorized],
    [`وصلت "بيقوله لوحده" في ${hymnsCount(b.solo)}`, b.solo * POINTS.solo],
  ];

  return (
    <>
      <header className="top gutter"><div><h1>ترتيب {v.levelName}</h1><div className="muted">شهر {monthName.format(new Date(`${v.month}-15`))} • الترتيب بيبدأ من الأول كل شهر</div></div></header>
      <main className="main gutter">
        <div className="card"><div className="list">
          {shown.map(r => (
            <div key={r.id} className="li" style={r.id === v.memberId ? { background: 'var(--bg)', borderRadius: 10, paddingInline: 8 } : undefined}>
              <b style={{ width: 22, color: r.place === 1 ? 'var(--s2)' : undefined }}>{r.place}</b>
              <div className="av">{r.photo ? <img src={r.photo} alt="" /> : r.name[0]}</div>
              <b className="grow">{r.id === v.memberId ? 'أنت' : r.name}</b>
              <span className="muted">{r.points} نقطة</span>
            </div>
          ))}
        </div></div>
        {v.place > 1 && v.gap > 0 && (
          <div className="card"><b>عشان تطلع الأول ناقصك {v.gap} نقط</b>
            <div className="note">لو حضرت وخدت تقييم كويس، أو قلت لحن لوحدك ({POINTS.solo} نقط)، توصل.</div></div>
        )}
        <div className="card"><h2>نقطك الشهر ده جت منين</h2>
          {parts.map(([k, val]) => <div key={k} className="row between"><span>{k}</span><b>{val}</b></div>)}
          <div className="row between" style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}><b>المجموع</b><b>{b.total}</b></div>
        </div>
        <div className="note">بتشوف أول 3 وترتيبك أنت بس، مش ترتيب كل اللي معاك.</div>
      </main>
    </>
  );
}
