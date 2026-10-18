import { useState } from 'react';
import { useData } from '../data/store';
import { birthdayWhen, DEFAULT_BIRTHDAY, yearsCount, fillTemplate, upcomingBirthdays, waLink, waNumber } from '../data/logic';

/** Birthdays in the coming week, each with a WhatsApp greeting the servant can edit before sending. */
export default function Birthdays({ levelIds }: { levelIds?: (id: string) => boolean }) {
  const [data, update] = useData();
  const list = upcomingBirthdays(data.members.filter(m => !levelIds || levelIds(m.levelId)));
  const [tpl, setTpl] = useState(data.templates.birthday ?? DEFAULT_BIRTHDAY);
  const [editing, setEditing] = useState(false);
  if (list.length === 0) return null;
  const save = () => { update(d => ({ ...d, templates: { ...d.templates, birthday: tpl } })); setEditing(false); };

  return (
    <div className="card">
      <div className="row between"><h2>أعياد ميلاد الأسبوع ده</h2>
        <button className="chip" onClick={() => editing ? save() : setEditing(true)}>{editing ? 'احفظ الرسالة' : 'عدّل الرسالة'}</button></div>
      {editing && <>
        <textarea aria-label="نص رسالة عيد الميلاد" value={tpl} onChange={e => setTpl(e.target.value)} />
        <div className="note">الخانات: {'{الاسم}'} و{'{السن}'}، و{'{طيب}'} بتتكتب طيب أو طيبة حسب النوع.</div>
      </>}
      <div className="list">
        {list.map(({ member: m, daysAway, age }) => (
          <div key={m.id} className="li">
            <span className="av">{m.photo ? <img src={m.photo} alt="" /> : m.name[0]}</span>
            <div className="grow"><b>{m.name}</b><div className="muted">{birthdayWhen(daysAway)} • {m.gender === 'f' ? 'هتتم' : 'هيتم'} {yearsCount(age)}{waNumber(m.parentPhone) ? '' : ' • مفيش رقم ولي أمر'}</div></div>
            <a className={daysAway === 0 ? 'btnp' : 'btn'} style={{ minHeight: 44 }} target="_blank" rel="noopener noreferrer"
              href={waLink(m.parentPhone, fillTemplate(tpl, { 'الاسم': m.name.split(' ')[0], 'السن': age, 'طيب': m.gender === 'f' ? 'طيبة' : 'طيب' }))}>هنّي</a>
          </div>
        ))}
      </div>
    </div>
  );
}
