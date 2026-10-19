import { Link, useNavigate, useParams } from 'react-router-dom';
import { useData } from '../data/store';
import { STATUS_LABELS, type HymnStatus } from '../data/types';
import {
  absenceStreak, contact, currentTerm, curriculumKey, formatDay, monthBreakdown, needsFollowUp, ranking,
  sessionAverage, todayISO, waLink, yearsCount,
} from '../data/logic';

const age = (birthdate: string) => {
  const [y, m, d] = birthdate.split('-').map(Number);
  const t = new Date();
  return t.getFullYear() - y - (t.getMonth() + 1 < m || (t.getMonth() + 1 === m && t.getDate() < d) ? 1 : 0);
};

/** What a servant sees on tapping a member: their details and progress. Editing is one tap away, not the default. */
export default function MemberProfile() {
  const { memberId } = useParams();
  const [data, update] = useData();
  const nav = useNavigate();
  const m = data.members.find(x => x.id === memberId);
  if (!m) return <main className="main gutter"><div className="card">المخدوم ده مش موجود. <Link to="/members">ارجع للمخدومين</Link></div></main>;

  const level = data.levels.find(l => l.id === m.levelId);
  const term = currentTerm(data);
  const hymns = (data.curricula[curriculumKey(term?.id, m.levelId)] ?? []).map(id => data.hymns.find(h => h.id === id)).filter(h => !!h);
  const month = todayISO().slice(0, 7);
  const points = monthBreakdown(data, m.id, month).total;
  const place = ranking(data, m.levelId, month).findIndex(r => r.member.id === m.id) + 1;
  const mine = data.sessions.filter(s => s.attendance[m.id] !== undefined).sort((a, b) => b.date.localeCompare(a.date));
  const rate = mine.length ? Math.round(100 * mine.filter(s => s.attendance[m.id] === 'p').length / mine.length) : null;
  const streak = absenceStreak(data, m);
  const recent = mine.filter(s => s.ratings[m.id]).slice(0, 5);
  const c = contact(m);
  const setStatus = (hymnId: string, s: HymnStatus) =>
    update(d => ({ ...d, progress: { ...d.progress, [m.id]: { ...(d.progress[m.id] ?? {}), [hymnId]: s } } }));

  const row = (label: string, value?: string) => value ? <div className="row between"><span className="muted">{label}</span><b>{value}</b></div> : null;

  return (
    <>
      <header className="top gutter"><div className="row between">
        <div className="row"><button className="icon" onClick={() => nav(-1)} aria-label="رجوع">→</button><h1>بروفايل المخدوم</h1></div>
        <Link to={`/members/${m.id}/edit`} className="btnp" style={{ minHeight: 40 }}>تعديل</Link>
      </div></header>
      <main className="main gutter wide dash">
        <div className="card profile-hero">
          <span className="av">{m.photo ? <img src={m.photo} alt="" /> : m.name[0]}</span>
          <div className="grow">
            <h2>{m.name}</h2>
            <div className="muted">{[level?.name, m.rank, m.grade].filter(Boolean).join(' • ')}</div>
            <span className="tag tag-ex">كود {m.code}</span>
          </div>
        </div>

        <div className="card">
          <h2>البيانات</h2>
          {row('النوع', m.gender === 'f' ? 'أنثى' : 'ذكر')}
          {m.birthdate && row('تاريخ الميلاد', `${formatDay(m.birthdate)} (${yearsCount(age(m.birthdate))})`)}
          {row('موبايله', m.phone)}
          {row('موبايل ولي الأمر', m.parentPhone)}
          {row('دخول التطبيق', m.account || m.pinHash ? 'معمول له رقم سري' : 'لسه مالوش رقم سري')}
          {c.phone && <a className="btn" href={waLink(c.phone, '')} target="_blank" rel="noopener noreferrer">{c.who === 'self' ? 'كلّمه على واتساب' : 'كلّم ولي الأمر على واتساب'}</a>}
        </div>

        <div className="card">
          <h2>الشهر ده</h2>
          <div className="stats">
            <div className="stat"><b>{points}</b><span className="muted">نقطة</span></div>
            <div className="stat"><b>{place ? `#${place}` : '–'}</b><span className="muted">ترتيبه في {level?.name}</span></div>
            <div className="stat"><b>{rate === null ? '–' : `${rate}%`}</b><span className="muted">حضوره</span></div>
          </div>
          {needsFollowUp(streak) && <div className="alert-t">غاب {streak} مرات ورا بعض، ومحتاج افتقاد.</div>}
        </div>

        <div className="card span">
          <div className="row between"><h2>مستواه في ألحان الترم</h2><span className="muted">اختار حالته في كل لحن</span></div>
          {hymns.length === 0 && <div className="note">منهج الترم فاضي لـ{level?.name}.</div>}
          <div className="list">
            {hymns.map(h => {
              const s = (data.progress[m.id]?.[h.id] ?? 0) as HymnStatus;
              return (
                <div key={h.id} className="li" style={{ flexWrap: 'wrap' }}>
                  <b className="grow">{h.nameAr}</b>
                  <div className="chips">{STATUS_LABELS.map((l, i) =>
                    <button key={l} className="chip" aria-pressed={s === i} onClick={() => setStatus(h.id, i as HymnStatus)}>{l}</button>)}</div>
                </div>
              );
            })}
          </div>
        </div>

        {recent.length > 0 && (
          <div className="card span">
            <h2>آخر تقييماته</h2>
            <div className="list">
              {recent.map(s => (
                <div key={s.id} className="li" style={{ flexWrap: 'wrap' }}>
                  <div className="grow"><b>{formatDay(s.date)}</b>
                    <div className="muted">{s.hymnIds.map(id => data.hymns.find(h => h.id === id)?.nameAr).filter(Boolean).join('، ') || 'من غير لحن محدد'}</div>
                    {s.notes?.[m.id] && <div className="note">{s.notes[m.id]}</div>}</div>
                  <b>{sessionAverage(s, m.id)?.toFixed(1)} / 5</b>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
