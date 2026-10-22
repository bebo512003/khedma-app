import { useState } from 'react';
import { useData } from '../data/store';
import { birthdayWhen, contact, DEFAULT_BIRTHDAY, MONTHS, monthBirthdays, yearsCount, fillTemplate, upcomingBirthdays, waLink, titled } from '../data/logic';

/** Birthdays in the coming week, each with a WhatsApp greeting the servant can edit before sending. */
export default function Birthdays({ levelIds }: { levelIds?: (id: string) => boolean }) {
  const [data, update] = useData();
  const mine = data.members.filter(m => !levelIds || levelIds(m.levelId));
  const list = upcomingBirthdays(mine);
  // Only the month is known: they show all month long, with no day or age.
  const month = monthBirthdays(mine);
  const [tpl, setTpl] = useState(data.templates.birthday ?? DEFAULT_BIRTHDAY);
  const [editing, setEditing] = useState(false);
  if (list.length === 0 && month.length === 0) return null;
  const save = () => { update(d => ({ ...d, templates: { ...d.templates, birthday: tpl } })); setEditing(false); };

  return (
    <div className="card">
      <div className="row between"><h2>{list.length ? 'أعياد ميلاد الأسبوع ده' : 'أعياد ميلاد الشهر ده'}</h2>
        <button className="chip" onClick={() => editing ? save() : setEditing(true)}>{editing ? 'احفظ الرسالة' : 'عدّل الرسالة'}</button></div>
      {editing && <>
        <textarea aria-label="نص رسالة عيد الميلاد" value={tpl} onChange={e => setTpl(e.target.value)} />
        <div className="note">الخانات: {'{الاسم}'} و{'{السن}'}، و{'{طيب}'} بتتكتب طيب أو طيبة حسب النوع.</div>
      </>}
      <div className="list">
        {list.map(({ member: m, daysAway, age }) => (
          <div key={m.id} className="li">
            <span className="av">{m.photo ? <img src={m.photo} alt="" /> : m.name[0]}</span>
            <div className="grow"><b>{titled(m, data.levels)}</b><div className="muted">{birthdayWhen(daysAway)} • {m.gender === 'f' ? 'هتتم' : 'هيتم'} {yearsCount(age)}{contact(m).who ? '' : ' • مفيش رقم'}</div></div>
            <a className={daysAway === 0 ? 'btnp' : 'btn'} style={{ minHeight: 44 }} target="_blank" rel="noopener noreferrer"
              href={waLink(contact(m).phone, fillTemplate(tpl, { 'الاسم': titled({ ...m, name: m.name.split(' ')[0] }, data.levels), 'السن': age, 'طيب': m.gender === 'f' ? 'طيبة' : 'طيب' }))}>هنّي</a>
          </div>
        ))}
      </div>
      {month.length > 0 && <>
        {list.length > 0 && <b>وفي {MONTHS[new Date().getMonth()]} كمان</b>}
        <div className="muted" style={{ fontSize: 13 }}>دول عارفين شهر ميلادهم بس، من غير اليوم.</div>
        <div className="list">
          {month.map(m => (
            <div key={m.id} className="li">
              <span className="av">{m.photo ? <img src={m.photo} alt="" /> : m.name[0]}</span>
              <div className="grow"><b>{titled(m, data.levels)}</b><div className="muted">مولود في {MONTHS[m.birthMonth! - 1]}{contact(m).who ? '' : ' • مفيش رقم'}</div></div>
              <a className="btn" style={{ minHeight: 44 }} target="_blank" rel="noopener noreferrer"
                href={waLink(contact(m).phone, fillTemplate(tpl, { 'الاسم': titled({ ...m, name: m.name.split(' ')[0] }, data.levels), 'السن': '', 'طيب': m.gender === 'f' ? 'طيبة' : 'طيب' }))}>هنّي</a>
            </div>
          ))}
        </div>
      </>}
    </div>
  );
}
