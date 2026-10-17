import { useState } from 'react';
import { useData } from '../data/store';
import { absenceStreak, fillTemplate, waLink, waNumber } from '../data/logic';
import type { Member } from '../data/types';

/** Absent members with an editable message. WhatsApp opens with the text filled in; the servant presses send from their own number. */
export default function FollowUpList({ members }: { members: Member[] }) {
  const [data, update] = useData();
  const [tpl, setTpl] = useState(data.templates.absence);
  const save = () => update(d => ({ ...d, templates: { ...d.templates, absence: tpl } }));

  return (
    <div className="card alert">
      <div><div className="alert-t">محتاجين افتقاد ({members.length})</div><div className="muted">غابوا أكتر من مرتين ورا بعض</div></div>
      <label className="field" htmlFor="tpl"><span>نص الرسالة</span>
        <textarea id="tpl" value={tpl} onChange={e => setTpl(e.target.value)} onBlur={save} />
      </label>
      <div className="note">الخانات: {'{الاسم}'} و{'{الغياب}'}. التعديل هنا بيتحفظ كقالب للمرات الجاية.</div>
      <div className="list">
        {members.map(m => {
          const streak = absenceStreak(data, m);
          const text = fillTemplate(tpl, { 'الاسم': m.name, 'الغياب': streak });
          const hasNum = !!waNumber(m.parentPhone);
          return (
            <div key={m.id} className="li">
              <span className="av">{m.photo ? <img src={m.photo} alt="" /> : m.name[0]}</span>
              <div className="grow"><b>{m.name}</b><div className="muted">غاب {streak} مرات{hasNum ? '' : ' • مفيش رقم ولي أمر'}</div></div>
              <a className="btn" style={{ minHeight: 44 }} href={waLink(m.parentPhone, text)} target="_blank" rel="noopener">واتساب</a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
