import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../data/store';
import { DAY_NAMES, DEFAULT_NOTIFY, HYMNS_TAG, hourLabel, withDefaults, type NotifySettings, type Reminder } from '../data/notify';
import PushToggle from './PushToggle';

const HOURS = Array.from({ length: 17 }, (_, i) => i + 7);

/** The lead servant sets when reminders go out; everyone else sees the schedule. */
export default function Notify() {
  const { servant } = useStore();
  const nav = useNavigate();
  const lead = servant?.role === 'lead';
  const [s, setS] = useState<NotifySettings | null>(null);
  const [log, setLog] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

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

  const block = (k: 'hymn' | 'session', heading: string, hint: string) => {
    const r = s[k];
    return (
      <div className="card">
        <div className="row between"><h2>{heading}</h2>
          <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={r.on} disabled={!lead} onChange={e => edit(k, { on: e.target.checked })} /> شغّال</label></div>
        <div className="muted">{hint}</div>
        <div className="field"><span>الأيام</span><div className="chips">
          {DAY_NAMES.map((d, i) => <button key={d} className="chip" disabled={!lead} aria-pressed={r.days.includes(i)}
            onClick={() => edit(k, { days: r.days.includes(i) ? r.days.filter(x => x !== i) : [...r.days, i].sort() })}>{d}</button>)}
        </div></div>
        <label className="field"><span>الساعة (بتوقيت مصر)</span>
          <select className="input" value={r.hour} disabled={!lead} onChange={e => edit(k, { hour: +e.target.value })}>
            {HOURS.map(h => <option key={h} value={h}>{hourLabel(h)}</option>)}
          </select></label>
        <label className="field"><span>العنوان</span><input className="input" maxLength={60} value={r.title} disabled={!lead} onChange={e => edit(k, { title: e.target.value })} /></label>
        <label className="field"><span>الرسالة</span><textarea maxLength={200} value={r.body} disabled={!lead} onChange={e => edit(k, { body: e.target.value })} /></label>
        {log[k] && <div className="muted">آخر مرة اتبعت: {log[k]}</div>}
      </div>
    );
  };

  return (
    <>
      <header className="top gutter"><div className="row">
        <button className="icon" onClick={() => nav(-1)} aria-label="رجوع">→</button><h1>التنبيهات</h1>
      </div></header>
      <main className="main gutter wide">
        <PushToggle who="servant" always />
        {block('hymn', 'تنبيه مراجعة الألحان', 'بيوصل للمخدومين بس.')}
        {block('session', 'تنبيه الحصة', 'بيوصل للمخدومين والخدام، قبل الحصة بيوم.')}
        <div className="note">كلمة {HYMNS_TAG} بتتبدل بألحان كل مخدوم اللي لسه ما خلصهاش (لحد ٣ ألحان). التنبيه ممكن يتأخر لحد ساعة عن ميعاده.
          {!lead && ' المواعيد دي بيعدّلها الخادم المسؤول.'}</div>
        {msg && <div className="note" role="status">{msg}</div>}
      </main>
      {lead && <div className="bar gutter"><div>
        <button className="btn" disabled={busy} onClick={() => save({ ...s, testAt: Date.now(), testUid: servant!.uid }, 'هيوصلك تنبيه تجربة على الموبايلات اللي مفعّل عليها التنبيهات خلال ساعة.')}>ابعتلي تجربة</button>
        <button className="btnp grow" disabled={busy} onClick={() => save(s)}>احفظ</button>
      </div></div>}
    </>
  );
}
