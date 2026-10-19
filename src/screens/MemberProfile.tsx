import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useData, useCan } from '../data/store';
import { STATUS_LABELS, type HymnStatus } from '../data/types';
import {
  absenceStreak, contact, formatTime, isLate, lateBy, currentTerm, curriculumKey, formatDay, monthBreakdown, needsFollowUp, ranking,
  sessionAverage, todayISO, waLink, yearsCount,
} from '../data/logic';
import Icon from '../ui/Icon';

const age = (birthdate: string) => {
  const [y, m, d] = birthdate.split('-').map(Number);
  const t = new Date();
  return t.getFullYear() - y - (t.getMonth() + 1 < m || (t.getMonth() + 1 === m && t.getDate() < d) ? 1 : 0);
};

type Tab = 'hymns' | 'ratings' | 'info';

/** What a servant sees on tapping a member: their details and progress. Editing is one tap away, not the default. */
export default function MemberProfile() {
  const { memberId } = useParams();
  const [data, update] = useData();
  const edit = useCan('members');
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>('hymns');
  const m = data.members.find(x => x.id === memberId);
  if (!m) return <main className="main gutter"><div className="card">المخدوم ده مش موجود. <Link to="/members">ارجع للمخدومين</Link></div></main>;

  const level = data.levels.find(l => l.id === m.levelId);
  const term = currentTerm(data);
  const hymns = (data.curricula[curriculumKey(term?.id, m.levelId)] ?? []).map(id => data.hymns.find(h => h.id === id)).filter(h => !!h);
  const status = (id: string) => (data.progress[m.id]?.[id] ?? 0) as HymnStatus;
  const done = hymns.filter(h => status(h.id) >= 2).length;
  const month = todayISO().slice(0, 7);
  const points = monthBreakdown(data, m.id, month).total;
  const place = ranking(data, m.levelId, month).findIndex(r => r.member.id === m.id) + 1;
  const mine = data.sessions.filter(s => s.attendance[m.id] !== undefined).sort((a, b) => b.date.localeCompare(a.date));
  const rate = mine.length ? Math.round(100 * mine.filter(s => s.attendance[m.id] === 'p').length / mine.length) : null;
  const streak = absenceStreak(data, m);
  const rated = mine.filter(s => s.ratings[m.id]);
  const c = contact(m);
  const setStatus = (hymnId: string, s: HymnStatus) =>
    update(d => ({ ...d, progress: { ...d.progress, [m.id]: { ...(d.progress[m.id] ?? {}), [hymnId]: s } } }));
  const row = (label: string, value?: string) => value ? <div className="kv"><span className="muted">{label}</span><b>{value}</b></div> : null;

  return (
    <>
      <header className="top gutter">
        <div className="row between">
          <button className="icon" onClick={() => nav(-1)} aria-label="رجوع"><Icon name="back" size={20} /></button>
          <div className="row" style={{ gap: 8 }}>
            {c.phone && <a className="icon" href={waLink(c.phone, '')} target="_blank" rel="noopener noreferrer" aria-label="واتساب"><Icon name="whatsapp" size={20} /></a>}
            <Link to={`/cards?member=${m.id}`} className="icon" aria-label="كارت QR"><Icon name="qr" size={20} /></Link>
            {edit && <Link to={`/members/${m.id}/edit`} className="icon" aria-label="تعديل"><Icon name="edit" size={20} /></Link>}
          </div>
        </div>
        <div className="profile-hero">
          <span className="av">{m.photo ? <img src={m.photo} alt="" /> : m.name[0]}</span>
          <div className="grow">
            <h1>{m.name}</h1>
            <div className="muted">كود {m.code} • {m.gender === 'f' ? 'أنثى' : 'ذكر'}{m.grade ? ` • ${m.grade}` : ''}</div>
            <div className="chips" style={{ marginTop: 6 }}>
              {level && <span className="tag tag-soft">{level.name}</span>}
              {m.rank && <span className="tag tag-soft">رتبة: {m.rank}</span>}
            </div>
          </div>
        </div>
        <div className="stats">
          <div className="stat dark"><b>{place ? `#${place}` : '–'}</b><span>ترتيبه في المستوى</span></div>
          <div className="stat"><b>{points}</b><span className="muted">نقطة الشهر ده</span></div>
          <div className="stat"><b>{rate === null ? '–' : `${rate}%`}</b><span className="muted">حضور</span></div>
        </div>
        <div className="ptabs" role="tablist">
          {([['hymns', 'الألحان'], ['ratings', 'التقييمات'], ['info', 'البيانات']] as const).map(([k, l]) =>
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}
        </div>
      </header>

      <main className="main gutter">
        {needsFollowUp(streak) && <div className="card alert"><div className="alert-t">غاب {streak} مرات ورا بعض، ومحتاج افتقاد.</div>
          <Link to="/followup" className="btn">افتح الافتقاد</Link></div>}

        {tab === 'hymns' && <>
          <div className="row between"><b>منهج {term?.name ?? 'الترم'}</b><span className="muted">{done} من {hymns.length} حافظهم أو أكتر</span></div>
          {hymns.length > 0 && <div className="progress-bar"><div style={{ width: `${Math.round(100 * done / hymns.length)}%` }} /></div>}
          {hymns.length === 0 && <div className="note">منهج الترم فاضي لـ{level?.name}.</div>}
          <div className="card" style={{ paddingBlock: 4 }}>
            {hymns.map(h => {
              const s = status(h.id);
              return (
                <div key={h.id} className="hrow">
                  <Link to={`/hymns/${h.id}`} style={{ color: "inherit" }}><b>{h.nameAr}</b></Link>
                  <div className="lvl" role="group" aria-label={`مستواه في ${h.nameAr}`}>
                    {STATUS_LABELS.map((l, i) =>
                      <button key={l} className={`st${i}`} aria-pressed={s === i} disabled={!edit && s !== i} onClick={() => setStatus(h.id, i as HymnStatus)}>{l}</button>)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="note">تغيير المستوى من هنا مش بيدي نقط. النقط بتيجي من لحن الحصة.</div>
        </>}

        {tab === 'ratings' && (rated.length === 0
          ? <div className="note">لسه مالوش تقييمات.</div>
          : <div className="card" style={{ paddingBlock: 4 }}><div className="list">
            {rated.slice(0, 20).map(s => (
              <Link key={s.id} to={`/summary/${s.id}`} className="li" style={{ alignItems: 'flex-start' }}>
                <div className="grow"><b>{formatDay(s.date)}</b>
                  <div className="muted">{s.hymnIds.map(id => data.hymns.find(h => h.id === id)?.nameAr).filter(Boolean).join('، ') || 'من غير لحن محدد'}</div>
                  {s.arrivals?.[m.id] && <div className="muted">وصل {formatTime(s.arrivals[m.id])}{isLate(s, m.id) ? ` • متأخر ${lateBy(s, m.id)} دقيقة` : ''}</div>}
                  {s.notes?.[m.id] && <div className="note">«{s.notes[m.id]}»</div>}</div>
                <b className="score">{sessionAverage(s, m.id)?.toFixed(1)}</b>
              </Link>
            ))}
          </div></div>)}

        {tab === 'info' && <div className="card">
          {m.birthdate && row('تاريخ الميلاد', `${formatDay(m.birthdate)} (${yearsCount(age(m.birthdate))})`)}
          {row('السنة الدراسية', m.grade)}
          {row('موبايله', m.phone)}
          {row('موبايل ولي الأمر', m.parentPhone)}
          {row('العنوان', m.address)}
          {row('دخول التطبيق', m.account || m.pinHash ? 'معمول له رقم سري' : 'لسه مالوش رقم سري')}
          {mine[0] && row('آخر حصة', `${formatDay(mine[0].date)} (${mine[0].attendance[m.id] === 'p' ? 'حضر' : mine[0].attendance[m.id] === 'e' ? 'اعتذر' : 'غاب'})`)}
          {edit && <Link to={`/members/${m.id}/edit`} className="btn">عدّل البيانات</Link>}
        </div>}
      </main>
    </>
  );
}
