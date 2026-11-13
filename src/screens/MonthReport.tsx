import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAllowedLevel, useData } from '../data/store';
import { monthName, monthReport, parentVars, PARENTS_TPL, shiftMonth, thisMonth } from '../data/monthReport';
import { fillTemplate, medal, sessionsCount, titled, waLink, waNumber } from '../data/logic';
import Icon from '../ui/Icon';
import { BackButton } from '../ui/back';


/** The month in review for each of the servant's levels: what the bell opens on the 1st and before the ranking resets. */
export default function MonthReport() {
  const { month: asked } = useParams();
  // A mistyped link opens last month instead of breaking.
  const month = asked && /^\d{4}-(0[1-9]|1[0-2])$/.test(asked) ? asked : shiftMonth(thisMonth(), -1);
  const [data] = useData();
  const allowed = useAllowedLevel();
  const levels = [...data.levels].sort((a, b) => a.order - b.order).filter(l => allowed(l.id));
  const current = month === thisMonth();

  return (
    <>
      <header className="top gutter"><div className="row between">
        <div className="row">
          <BackButton />
          <div><h1>تقرير {monthName(month)}</h1><div className="muted">{current ? 'الشهر لسه ما خلصش، والترتيب بيتصفّر أول الشهر الجاي' : 'ملخص الشهر لكل مستوى'}</div></div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <Link className="icon" to={`/month/${shiftMonth(month, -1)}`} aria-label="الشهر اللي قبله"><Icon name="back" size={18} /></Link>
          {!current && <Link className="icon" to={`/month/${shiftMonth(month, 1)}`} aria-label="الشهر اللي بعده" style={{ transform: 'scaleX(-1)' }}><Icon name="back" size={18} /></Link>}
        </div>
      </div></header>
      <main className="main gutter wide dash">
        {levels.map(l => {
          const r = monthReport(data, l.id, month);
          if (!r.sessions) return <div key={l.id} className="card"><h2>{l.name}</h2><div className="note">مفيش حصص متسجلة في الشهر ده.</div></div>;
          const diff = r.rate !== null && r.prevRate !== null ? r.rate - r.prevRate : null;
          return (
            <div key={l.id} className="card">
              <h2>{l.name}</h2>
              <div className="row between">
                <div><div className="muted">الحصص</div><b>{sessionsCount(r.sessions)}</b></div>
                <div><div className="muted">الحضور</div><b>{r.rate ?? '–'}%</b>
                  {diff !== null && diff !== 0 && <span className={diff > 0 ? 'muted' : 'alert-t'}> {diff > 0 ? `▲ ${diff}` : `▼ ${-diff}`}</span>}</div>
                <div><div className="muted">نقط المستوى</div><b>{r.points}</b></div>
              </div>
              {r.top.length > 0 && <>
                <b>{current ? 'الأوائل لحد دلوقتي' : 'أوائل الشهر'}</b>
                <div className="list">
                  {r.top.map(t => (
                    <Link key={t.member.id} to={`/members/${t.member.id}`} className="li">
                      <span style={{ fontSize: 22 }} title={medal(t.place, t.points)?.name}>{medal(t.place, t.points)?.icon}</span>
                      <span className="av">{t.member.photo ? <img src={t.member.photo} alt="" /> : t.member.name[0]}</span>
                      <b className="grow">{titled(t.member, data.levels)}</b><span className="muted">{t.points} نقطة</span>
                    </Link>
                  ))}
                </div>
              </>}
              {r.milestones.length > 0 && <>
                <b>وصلوا لمرحلة جديدة في لحن</b>
                <div className="muted">{r.milestones.map(x => `${titled(x.member, data.levels)}${x.solo ? ' (قاله لوحده)' : ' (حفظ)'}`).join('، ')}</div>
              </>}
              {r.slipped.length > 0 && <>
                <b className="alert-t">مستواهم نزل</b>
                <div className="list">
                  {r.slipped.map(x => (
                    <Link key={x.member.id} to={`/members/${x.member.id}`} className="li">
                      <span className="av">{x.member.photo ? <img src={x.member.photo} alt="" /> : x.member.name[0]}</span>
                      <div className="grow"><b>{titled(x.member, data.levels)}</b><div className="muted">{x.why.join(' • ')}</div></div>
                    </Link>
                  ))}
                </div>
              </>}
            </div>
          );
        })}
        {!current && <ParentsReport month={month} levelIds={levels.map(l => l.id)} />}
        <Link to="/ranking" className="btn span">الترتيب الكامل لكل مستوى</Link>
        <Link to="/reports" className="btn span">التقارير التفصيلية وتصدير إكسيل</Link>
      </main>
    </>
  );
}

const sentKey = (month: string, id: string) => `parents:${month}:${id}`;
const wasSent = (month: string, id: string) => { try { return !!localStorage.getItem(sentKey(month, id)); } catch { return false; } };

/** Each member's month on WhatsApp to their parent (or to them when no parent number), sent from the servant's own phone. */
function ParentsReport({ month, levelIds }: { month: string; levelIds: string[] }) {
  const [data, update] = useData();
  const [open, setOpen] = useState(false);
  const [tpl, setTpl] = useState(data.templates.parents ?? PARENTS_TPL);
  const [, tick] = useState(0);
  const save = () => update(d => ({ ...d, templates: { ...d.templates, parents: tpl } }));
  const members = data.members.filter(m => levelIds.includes(m.levelId) && data.sessions.some(s => s.levelId === m.levelId && s.date.startsWith(month)))
    .sort((a, b) => levelIds.indexOf(a.levelId) - levelIds.indexOf(b.levelId) || a.name.localeCompare(b.name, 'ar'));
  const done = members.filter(m => wasSent(month, m.id)).length;
  if (!members.length) return null;
  return (
    <div className="card span">
      <div className="row between">
        <div><h2>تقرير الشهر لأولياء الأمور</h2><div className="muted">رسالة واتساب لكل ولي أمر من رقمك • {done} من {members.length} اتبعتوا</div></div>
        <button className="btn" onClick={() => setOpen(!open)}>{open ? 'اقفل' : 'افتح'}</button>
      </div>
      {open && <>
        <label className="field" htmlFor="ptpl"><span>نص الرسالة</span>
          <textarea id="ptpl" value={tpl} onChange={e => setTpl(e.target.value)} onBlur={save} style={{ minHeight: 150 }} />
        </label>
        <div className="note">الخانات: {'{الاسم} {الشهر} {الحضور} {النقط} {الألحان}'}. بتتملي لكل واحد لوحدها وبصيغة المؤنث للبنات. التعديل بيتحفظ للشهور الجاية.</div>
        {tpl !== PARENTS_TPL && <button className="btn" onClick={() => { setTpl(PARENTS_TPL); update(d => ({ ...d, templates: { ...d.templates, parents: PARENTS_TPL } })); }}>رجّع النص الأصلي</button>}
        <div className="list">
          {members.map(m => {
            const to = waNumber(m.parentPhone) ? { phone: m.parentPhone, who: 'لولي الأمر' } : waNumber(m.phone) ? { phone: m.phone, who: m.gender === 'f' ? 'على موبايلها' : 'على موبايله' } : null;
            const sent = wasSent(month, m.id);
            const text = fillTemplate(tpl, parentVars(data, m, month));
            return (
              <div key={m.id} className="li">
                <span className="av">{m.photo ? <img src={m.photo} alt="" /> : m.name[0]}</span>
                <div className="grow"><b>{titled(m, data.levels)}</b><div className="muted">{data.levels.find(l => l.id === m.levelId)?.name} • {to ? to.who : 'مفيش رقم'}{sent ? ' • اتبعت ✓' : ''}</div></div>
                {to && <a className={sent ? 'btn' : 'btnp'} style={{ minHeight: 44 }} target="_blank" rel="noopener"
                  href={waLink(to.phone, text)}
                  onClick={() => { try { localStorage.setItem(sentKey(month, m.id), '1'); } catch { /* the mark is only a reminder */ } tick(n => n + 1); }}>واتساب</a>}
                {!to && <button className="btn" style={{ minHeight: 44 }} data-text={text} onClick={() => navigator.clipboard?.writeText(text).then(() => { try { localStorage.setItem(sentKey(month, m.id), '1'); } catch { /* reminder only */ } tick(n => n + 1); })}>انسخ</button>}
              </div>
            );
          })}
        </div>
      </>}
    </div>
  );
}
