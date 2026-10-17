import { useData } from '../data/store';
import { hymnsCount, monthBreakdown, POINTS, ranking, sessionsCount, todayISO } from '../data/logic';
import { useMember } from './session';

const monthName = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { month: 'long' });

export default function MemberRank() {
  const [data] = useData();
  const { member } = useMember();
  if (!member) return null;
  const level = data.levels.find(l => l.id === member.levelId);
  const month = todayISO().slice(0, 7);
  const rows = ranking(data, member.levelId, month);
  const pos = rows.findIndex(r => r.member.id === member.id);
  const b = monthBreakdown(data, member.id, month);
  const gap = Math.max(0, (rows[0]?.points ?? 0) - b.total);
  // Members see the top 3 and their own place only, never the full list.
  const shown = rows.slice(0, 3).map((r, i) => ({ ...r, place: i + 1 }));
  if (pos >= 3) shown.push({ ...rows[pos], place: pos + 1 });
  const parts: [string, number][] = [
    [`حضور ${sessionsCount(b.attended)}`, b.attendance],
    ['تقييم الحصص (متوسط كل حصة)', b.rating],
    [`وصلت "حافظه" في ${hymnsCount(b.memorized)}`, b.memorized * POINTS.memorized],
    [`وصلت "بيقوله لوحده" في ${hymnsCount(b.solo)}`, b.solo * POINTS.solo],
  ];

  return (
    <>
      <header className="top gutter"><div><h1>ترتيب {level?.name}</h1><div className="muted">شهر {monthName.format(new Date())} • الترتيب بيبدأ من الأول كل شهر</div></div></header>
      <main className="main gutter">
        <div className="card"><div className="list">
          {shown.map(r => (
            <div key={r.member.id} className="li" style={r.member.id === member.id ? { background: 'var(--bg)', borderRadius: 10, paddingInline: 8 } : undefined}>
              <b style={{ width: 22, color: r.place === 1 ? 'var(--s2)' : undefined }}>{r.place}</b>
              <div className="av">{r.member.photo ? <img src={r.member.photo} alt="" /> : r.member.name[0]}</div>
              <b className="grow">{r.member.id === member.id ? 'أنت' : r.member.name}</b>
              <span className="muted">{r.points} نقطة</span>
            </div>
          ))}
        </div></div>
        {pos > 0 && gap > 0 && (
          <div className="card"><b>عشان تطلع الأول ناقصك {gap} نقط</b>
            <div className="note">لو حضرت وخدت تقييم كويس، أو قلت لحن لوحدك ({POINTS.solo} نقط)، توصل.</div></div>
        )}
        <div className="card"><h2>نقطك الشهر ده جت منين</h2>
          {parts.map(([k, v]) => <div key={k} className="row between"><span>{k}</span><b>{v}</b></div>)}
          <div className="row between" style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}><b>المجموع</b><b>{b.total}</b></div>
        </div>
        <div className="note">بتشوف أول 3 وترتيبك أنت بس، مش ترتيب كل اللي معاك.</div>
      </main>
    </>
  );
}
