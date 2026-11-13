import { partsCount, hymnsCount, medal, pointsCount, pointsWhy, POINTS, sessionsCount } from '../data/logic';
import { useG, useView } from './Layout';

const monthName = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { month: 'long' });

export default function MemberRank() {
  const v = useView();
  const g = useG();
  const b = v.breakdown;
  // Members see the top 3 and their own place only, never the full list.
  const shown = [...v.top];
  if (!shown.some(r => r.id === v.memberId)) shown.push({ id: v.memberId, name: v.name, photo: v.photo, points: v.points, place: v.place, why: pointsWhy(v.breakdown, v.gender === 'f') });
  const parts = ([
    [`حضور ${sessionsCount(b.attended)}${b.lateOff ? ` (اتخصم ${b.lateOff} تأخير)` : ''}`, b.attendance],
    ['تقييم الحصص (متوسط كل حصة)', b.rating],
    [`${g('وصلت "حافظه"', 'وصلتي "حافظاه"')} في ${hymnsCount(b.memorized)}`, b.memorizedPts],
    [`${g('وصلت "بيقوله لوحده"', 'وصلتي "بتقوله لوحدها"')} في ${hymnsCount(b.solo)}`, b.soloPts],
    [`${g('حفظت', 'حفظتي')} ${partsCount(b.partsM)}`, b.partsMPts],
    [`${g('قلت', 'قولتي')} ${partsCount(b.partsS)} لوحدك`, b.partsSPts],
  ] as [string, number][]).filter(([, pts], i) => i < 1 || pts > 0);

  return (
    <>
      <header className="top gutter"><div><h1>ترتيب {v.levelName}</h1><div className="muted">شهر {monthName.format(new Date(`${v.month}-15`))} • الترتيب بيبدأ من الأول كل شهر</div></div></header>
      <main className="main gutter">
        <div className="card"><div className="list">
          {shown.map(r => (
            <div key={r.id} className={medal(r.place, r.points) ? `li medal ${medal(r.place, r.points)!.cls}` : 'li'} style={r.id === v.memberId ? { outline: '2px solid var(--act)', borderRadius: 12, paddingInline: 8 } : undefined}>
              <b className="place">{medal(r.place, r.points) ? <><span>{medal(r.place, r.points)!.icon}</span><small>{medal(r.place, r.points)!.name}</small></> : r.place}</b>
              <div className="av">{r.photo ? <img src={r.photo} alt="" /> : r.name[0]}</div>
              <div className="grow"><b>{r.id === v.memberId ? g('أنت', 'انتي') : r.name}</b>{r.why && <div className="muted" style={{ fontSize: 12 }}>{r.why}</div>}</div>
              <span className="muted">{r.points} نقطة</span>
            </div>
          ))}
        </div></div>
        {v.place > 1 && v.gap > 0 && (
          <div className="card"><b>{g('عشان تطلع الأول ناقصك', 'عشان تطلعي الأولى ناقصك')} {pointsCount(v.gap)}</b>
            <div className="note">{g('لو حضرت في ميعادك، أو قلت لحن لوحدك', 'لو حضرتي في ميعادك، أو قولتي لحن لوحدك')} (من {POINTS.solo} نقط)، {g('توصل', 'توصلي')}.</div></div>
        )}
        {v.coupons && <div className="card">
          <div className="row between"><h2>رصيد الكوبونات</h2><b className="coupon-bal">{v.coupons.balance}</b></div>
          {(val => val ? <div className="note">{g('لو الشهر خلص وأنت في مركزك ده هتاخد', 'لو الشهر خلص وانتي في مركزك ده هتاخدي')} {val} كوبون في رصيدك. الأول {v.coupons.values[0]}، التاني {v.coupons.values[1] ?? 0}، التالت {v.coupons.values[2] ?? 0}.</div>
            : <div className="note">الأول كل شهر بياخد {v.coupons.values[0]} كوبون، والتاني {v.coupons.values[1] ?? 0}، والتالت {v.coupons.values[2] ?? 0}، وبتتجمع من شهر للتاني {g('وتبدلها', 'وتبدليها')} بهدايا.</div>)(v.points > 0 ? v.coupons.values[v.place - 1] ?? 0 : 0)}
          {v.coupons.earned.slice().reverse().slice(0, 6).map(e => <div key={e.month} className="row between"><span>{monthName.format(new Date(`${e.month}-15`))} • المركز {e.place}</span><b>+{e.value}</b></div>)}
          {v.coupons.spent.slice().reverse().slice(0, 6).map((s, i) => <div key={i} className="row between muted"><span>{g('صرفت', 'صرفتي')}{s.note ? ` على ${s.note}` : ''}</span><b>−{s.amount}</b></div>)}
        </div>}
        <div className="card"><h2>نقطك الشهر ده جت منين</h2>
          {parts.map(([k, val]) => <div key={k} className="row between"><span>{k}</span><b>{val}</b></div>)}
          <div className="row between" style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}><b>المجموع</b><b>{b.total}</b></div>
        </div>
        <div className="note">{g('بتشوف الذهبي والفضي والبرونزي وترتيبك أنت بس.', 'بتشوفي الذهبي والفضي والبرونزي وترتيبك انتي بس.')} لو النقط اتساوت، الأعلى اللي حضر أكتر، وبعدها اللي ماشي أكتر في ألحان الترم.</div>
      </main>
    </>
  );
}
