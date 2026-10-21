import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData, useStore } from '../data/store';
import { DAY_NAMES, DEFAULT_NOTIFY, HYMNS_TAG, hourLabel, newReminder, withDefaults, type CustomReminder, type NotifySettings, type Reminder } from '../data/notify';
import { todayISO } from '../data/logic';
import PushToggle from './PushToggle';

const HOURS = Array.from({ length: 17 }, (_, i) => i + 7);

/** The lead servant sets when reminders go out; everyone else sees the schedule. */
export default function Notify() {
  const { servant } = useStore();
  const [data] = useData();
  const levels = [...(data?.levels ?? [])].sort((a, b) => a.order - b.order);
  const nav = useNavigate();
  const lead = !servant || servant.role === 'lead' || servant.role === 'admin';
  const [s, setS] = useState<NotifySettings | null>(null);
  const [log, setLog] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [askDelete, setAskDelete] = useState('');

  useEffect(() => {
    if (!servant) { setS(DEFAULT_NOTIFY); return; }
    (async () => {
      const [{ servantFb }, { getDoc }, paths] = await Promise.all([import('../firebase/app'), import('firebase/firestore'), import('../firebase/paths')]);
      const db = servantFb().db;
      const [a, b] = await Promise.all([getDoc(paths.ref(db, 'settings', 'notify')), getDoc(paths.ref(db, 'settings', 'notifyLog'))]).catch(() => [null, null]);
      setS(withDefaults(a?.data() as Partial<NotifySettings> | undefined));
      setLog((b?.data() ?? {}) as Record<string, string>);
    })();
  }, [servant]);
  if (!s) return <main className="main gutter"><div className="note">بيحمّل…</div></main>;

  const save = async (next: NotifySettings, done = 'اتحفظ.') => {
    setBusy(true); setMsg('');
    try {
      const [{ servantFb }, { setDoc }, paths] = await Promise.all([import('../firebase/app'), import('firebase/firestore'), import('../firebase/paths')]);
      await setDoc(paths.ref(servantFb().db, 'settings', 'notify'), JSON.parse(JSON.stringify(next)));
      setS(next); setMsg(done);
    } catch { setMsg('مقدرناش نحفظ دلوقتي. اتأكد إن معاك نت وجرّب تاني.'); }
    setBusy(false);
  };
  const edit = (k: 'hymn' | 'session', x: Partial<Reminder>) => setS({ ...s, [k]: { ...s[k], ...x } });
  const custom = s.custom ?? [];
  const editCustom = (id: string, x: Partial<CustomReminder>) => setS({ ...s, custom: custom.map(r => r.id === id ? { ...r, ...x } : r) });

  const form = (r: Reminder, change: (x: Partial<Reminder>) => void, heading: ReactNode, hint: ReactNode, logKey: string, once?: boolean, footer?: ReactNode) => {
    return (
      <div className="card" key={logKey}>
        <div className="row between"><h2>{heading}</h2>
          <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={r.on} disabled={!lead} onChange={e => change({ on: e.target.checked })} /> شغّال</label></div>
        {hint}
        {!once && <div className="field"><span>الأيام</span><div className="chips">
          {DAY_NAMES.map((d, i) => <button key={d} className="chip" disabled={!lead} aria-pressed={r.days.includes(i)}
            onClick={() => change({ days: r.days.includes(i) ? r.days.filter(x => x !== i) : [...r.days, i].sort() })}>{d}</button>)}
        </div></div>}
        <label className="field"><span>الساعة (بتوقيت مصر)</span>
          <select className="input" value={r.hour} disabled={!lead} onChange={e => change({ hour: +e.target.value })}>
            {HOURS.map(h => <option key={h} value={h}>{hourLabel(h)}</option>)}
          </select></label>
        <label className="field"><span>العنوان</span><input className="input" maxLength={60} value={r.title} disabled={!lead} onChange={e => change({ title: e.target.value })} /></label>
        <label className="field"><span>الرسالة</span><textarea maxLength={200} value={r.body} disabled={!lead} onChange={e => change({ body: e.target.value })} /></label>
        {log[logKey] && <div className="muted">آخر مرة اتبعت: {log[logKey]}</div>}
        {footer}
      </div>
    );
  };
  const block = (k: 'hymn' | 'session', heading: string, hint: string) => form(s[k], x => edit(k, x), heading, <div className="muted">{hint}</div>, k);

  const TO = [['members', 'المخدومين'], ['servants', 'الخدام'], ['all', 'الكل']] as const;
  const customBlock = (r: CustomReminder) => form(r, x => editCustom(r.id, x), r.title || 'تنبيه جديد', <>
    <div className="field"><span>يوصل لمين</span><div className="chips">
      {TO.map(([v, l]) => <button key={v} className="chip" disabled={!lead} aria-pressed={r.to === v} onClick={() => editCustom(r.id, { to: v })}>{l}</button>)}
    </div></div>
    <div className="field"><span>المستوى</span><div className="chips">
      <button className="chip" disabled={!lead} aria-pressed={!r.levelIds.length} onClick={() => editCustom(r.id, { levelIds: [] })}>كل المستويات</button>
      {levels.map(l => <button key={l.id} className="chip" disabled={!lead} aria-pressed={r.levelIds.includes(l.id)}
        onClick={() => editCustom(r.id, { levelIds: r.levelIds.includes(l.id) ? r.levelIds.filter(x => x !== l.id) : [...r.levelIds, l.id] })}>{l.name}</button>)}
    </div></div>
    <div className="field"><span>بيتكرر</span><div className="chips">
      <button className="chip" disabled={!lead} aria-pressed={!r.date} onClick={() => editCustom(r.id, { date: undefined })}>كل أسبوع</button>
      <button className="chip" disabled={!lead} aria-pressed={!!r.date} onClick={() => editCustom(r.id, { date: r.date ?? todayISO() })}>مرة واحدة</button>
    </div></div>
    {r.date && <label className="field"><span>اليوم</span><input type="date" className="input" value={r.date} min={todayISO()} disabled={!lead} onChange={e => editCustom(r.id, { date: e.target.value || todayISO() })} /></label>}
  </>, `c:${r.id}`, !!r.date, lead && (askDelete === r.id
      ? <div className="row"><button className="btn grow" onClick={() => setAskDelete('')}>لا</button><button className="btnp grow" onClick={() => { setAskDelete(''); save({ ...s, custom: custom.filter(x => x.id !== r.id) }, 'التنبيه اتمسح.'); }}>امسحه</button></div>
      : <button className="btn" onClick={() => setAskDelete(r.id)}>امسح التنبيه ده</button>));

  return (
    <>
      <header className="top gutter"><div className="row">
        <button className="icon" onClick={() => nav(-1)} aria-label="رجوع">→</button><h1>التنبيهات</h1>
      </div></header>
      <main className="main gutter wide">
        <PushToggle who="servant" always />
        {block('hymn', 'تنبيه مراجعة الألحان', 'بيوصل للمخدومين بس.')}
        {block('session', 'تنبيه الحصة', 'بيوصل للمخدومين والخدام، قبل الحصة بيوم.')}
        {custom.map(customBlock)}
        {lead && <button className="btn" onClick={() => setS({ ...s, custom: [...custom, newReminder()] })}>+ ضيف تنبيه</button>}
        <div className="note">كلمة {HYMNS_TAG} بتتبدل بألحان كل مخدوم اللي لسه ما خلصهاش (لحد ٣ ألحان). التنبيه ممكن يتأخر لحد ساعة عن ميعاده.
          {!lead && ' المواعيد دي بيعدّلها الخادم المسؤول.'}</div>
        {msg && <div className="note" role="status">{msg}</div>}
      </main>
      {lead && <div className="bar gutter"><div>
        <button className="btn" disabled={busy} onClick={() => save({ ...s, testAt: Date.now(), testUid: servant!.uid }, 'هيوصلك تنبيه تجربة على الموبايلات اللي مفعّل عليها التنبيهات خلال ساعة.')}>ابعتلي تجربة</button>
        <button className="btnp grow" disabled={busy} onClick={() => {
          const bad = custom.find(r => !r.title.trim() || !r.body.trim() || (!r.date && !r.days.length));
          if (bad) { setMsg(!bad.title.trim() || !bad.body.trim() ? 'اكتب عنوان ورسالة لكل تنبيه جديد.' : `اختار يوم واحد على الأقل لـ «${bad.title}».`); return; }
          save(s);
        }}>احفظ</button>
      </div></div>}
    </>
  );
}
