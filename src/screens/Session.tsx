import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAllowedLevel, useData } from '../data/store';
import { CRITERIA, STATUS_LABELS, type Attendance, type HymnStatus, type Rating, type Session } from '../data/types';
import { LATE_GRACE_MIN, atTime, minutesLate, currentTerm, formatDay, formatTime, hhmm, todayISO, uid } from '../data/logic';
import Scanner from './Scanner';

type Mode = 'att' | 'rate' | 'hym';
const fmt = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/** A new session (/session/:levelId) or a correction to a saved one (/sessions/:sessionId/edit). */
export default function SessionRoute() {
  const { levelId = '', sessionId } = useParams();
  const [data] = useData();
  const allowed = useAllowedLevel();
  const editing = sessionId ? data.sessions.find(s => s.id === sessionId && allowed(s.levelId)) : undefined;
  if (sessionId && !editing) return <main className="main gutter"><div className="card">الحصة دي مش موجودة. <Link to="/sessions">سجل الحصص</Link></div></main>;
  return <SessionScreen key={sessionId ?? levelId} levelId={editing?.levelId ?? levelId} editing={editing} />;
}

function SessionScreen({ levelId, editing }: { levelId: string; editing?: Session }) {
  const [data, update] = useData();
  const nav = useNavigate();
  const allowed = useAllowedLevel();
  const level = allowed(levelId) ? data.levels.find(l => l.id === levelId) : undefined;
  const term = currentTerm(data);
  const termId = editing?.termId ?? term?.id;
  const hymnIds = data.curricula[`${termId}:${levelId}`] ?? [];
  const hymns = hymnIds.map(id => data.hymns.find(h => h.id === id)!).filter(Boolean);
  // A saved session keeps the members it recorded, even ones who moved level since.
  const members = useMemo(() => data.members.filter(m => m.levelId === levelId || (editing && editing.attendance[m.id] !== undefined))
    .sort((a, b) => a.name.localeCompare(b.name, 'ar')), [data.members, levelId, editing]);

  // One hymn per session: the servant picks it, and its status and the ratings belong to it. Other hymns are set from each member's profile.
  const lastHymn = [...data.sessions].filter(s => s.levelId === levelId).sort((a, b) => b.date.localeCompare(a.date))[0]?.hymnIds?.[0];
  const [hymnId, setHymnId] = useState<string | undefined>(() => editing ? editing.hymnIds[0] : hymnIds.includes(lastHymn ?? '') ? lastHymn : hymnIds[0]);
  const hymn = hymns.find(h => h.id === hymnId);
  const [mode, setMode] = useState<Mode>('att');
  const [att, setAtt] = useState<Record<string, Attendance>>(() => ({ ...Object.fromEntries(members.map(m => [m.id, 'a'])), ...editing?.attendance }));
  const [rate, setRate] = useState<Record<string, Rating>>(() => ({ ...editing?.ratings }));
  const [notes, setNotes] = useState<Record<string, string>>(() => ({ ...editing?.notes }));
  const [arrivals, setArrivals] = useState<Record<string, number>>(() => ({ ...editing?.arrivals }));
  const [date, setDate] = useState(editing?.date ?? todayISO());
  // When the session is due to start; late arrivals are counted from it. Old sessions may have none.
  const [startTime, setStartTime] = useState(() => editing ? (editing.startedAt ? hhmm(editing.startedAt) : '') : hhmm(Date.now()));
  const startedAt = startTime ? atTime(date, startTime) : undefined;
  const [noteOpen, setNoteOpen] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2200); return () => clearTimeout(t); }, [toast]);
  const [hym, setHym] = useState<Record<string, Record<string, HymnStatus>>>(() =>
    Object.fromEntries(members.map(m => [m.id, Object.fromEntries(hymnIds.map(h => [h, data.progress[m.id]?.[h] ?? 0]))])));
  const [start] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  if (!level) return <main className="main gutter"><div className="card">المستوى ده مش موجود. <Link to="/">ارجع للرئيسية</Link></div></main>;

  // Members added while the session is open (by another servant) start absent with their saved hymn progress.
  const hs = (id: string, h: string): HymnStatus => hym[id]?.[h] ?? data.progress[id]?.[h] ?? 0;
  const sessionHymns = hymnId ? [hymnId] : [];
  const memberHym = (id: string) => Object.fromEntries(sessionHymns.map(h => [h, hs(id, h)]));
  const present = members.filter(m => att[m.id] === 'p');
  const onScan = (code: string) => {
    const m = data.members.find(x => x.code === code);
    if (!m) { setToast({ text: `مفيش مخدوم بالكود ${code}`, bad: true }); return; }
    if (m.levelId !== levelId) { setToast({ text: `${m.name} مش في ${level?.name}`, bad: true }); return; }
    if (att[m.id] === 'p' && arrivals[m.id]) { setToast({ text: `${m.name} متسجل قبل كده` }); return; }
    const now = Date.now();
    const late = startedAt ? minutesLate(now, startedAt) : 0;
    setAtt(a => ({ ...a, [m.id]: 'p' }));
    setArrivals(a => ({ ...a, [m.id]: now }));
    setToast(late > LATE_GRACE_MIN ? { text: `✓ ${m.name} حاضر، متأخر ${late} دقيقة`, bad: true } : { text: `✓ ${m.name} حاضر` });
    navigator.vibrate?.(60);
  };
  const cycleAtt = (id: string) => setAtt(a => ({ ...a, [id]: (a[id] ?? 'a') === 'a' ? 'p' : a[id] === 'p' ? 'e' : 'a' }));
  const step = (id: string, j: number, d: number) => setRate(r => {
    const cur: Rating = r[id] ?? [3, 3, 3];
    const next = [...cur] as Rating; next[j] = Math.min(5, Math.max(1, cur[j] + d));
    return { ...r, [id]: next };
  });
  const cycleHym = (id: string, h: string) => setHym(s => ({ ...s, [id]: { ...memberHym(id), ...s[id], [h]: ((hs(id, h) + 1) % 4) as HymnStatus } }));
  const bulk = () => setHym(s => {
    const n = { ...s };
    present.forEach(m => { n[m.id] = { ...s[m.id], ...Object.fromEntries(sessionHymns.map(h => [h, Math.max(1, s[m.id]?.[h] ?? hs(m.id, h)) as HymnStatus])) }; });
    return n;
  });

  const finish = () => {
    const milestones: Session['milestones'] = {};
    present.forEach(m => {
      // A correction adds to what the session already counted; progress already holds its earlier changes.
      let memorized = editing?.milestones?.[m.id]?.memorized ?? 0, solo = editing?.milestones?.[m.id]?.solo ?? 0;
      sessionHymns.forEach(h => {
        const before = data.progress[m.id]?.[h] ?? 0, after = hs(m.id, h);
        if (before < 2 && after >= 2) memorized++;
        if (before < 3 && after === 3) solo++;
      });
      if (memorized || solo) milestones[m.id] = { memorized, solo };
    });
    const session: Session = {
      ...editing,
      id: editing?.id ?? uid(), date, levelId, termId: termId!, hymnIds: sessionHymns,
      attendance: Object.fromEntries(members.map(m => [m.id, att[m.id] ?? 'a'])),
      ratings: Object.fromEntries(present.map(m => [m.id, rate[m.id] ?? [3, 3, 3]])),
      milestones, durationMs: editing ? editing.durationMs : Date.now() - start,
      startedAt, arrivals: Object.fromEntries(present.filter(m => arrivals[m.id]).map(m => [m.id, arrivals[m.id]])),
      notes: Object.fromEntries(present.map(m => [m.id, (notes[m.id] ?? '').trim()]).filter(([, n]) => n)),
    };
    update(d => {
      const progress = { ...d.progress };
      present.forEach(m => { progress[m.id] = { ...(progress[m.id] ?? {}), ...memberHym(m.id) }; });
      return { ...d, sessions: editing ? d.sessions.map(s => s.id === session.id ? session : s) : [...d.sessions, session], progress };
    });
    nav(`/summary/${session.id}`, { replace: true, state: editing ? undefined : { fresh: true } });
  };

  const picker = hymns.length > 0 && (
    <div className="field"><span>لحن الحصة</span>
      <div className="chips">{hymns.map(h => <button key={h.id} className="chip" aria-pressed={hymnId === h.id} onClick={() => setHymnId(h.id)}>{h.nameAr}</button>)}</div>
    </div>
  );

  return (
    <>
      <header className="top gutter">
        <div className="row between">
          <div><h1>{editing ? `تعديل حصة ${level.name}` : level.name}</h1><div className="muted">{editing ? formatDay(date) + ' • ' : ''}{hymn ? `لحن الحصة: ${hymn.nameAr}` : hymns.length ? 'اختار لحن الحصة' : 'مفيش ألحان في منهج الترم لسه'}</div></div>
          {!editing && <span className="timer" aria-label="وقت الحصة">{fmt(now - start)}</span>}
        </div>
        <div className="seg" role="group" aria-label="وضع الحصة">
          {([['att', 'الحضور'], ['rate', 'التقييم'], ['hym', 'الألحان']] as const).map(([k, l]) =>
            <button key={k} aria-pressed={mode === k} onClick={() => setMode(k)}>{l}</button>)}
        </div>
      </header>

      <main className="main gutter wide">
        {mode === 'att' && (<>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {editing && <label className="field grow" htmlFor="sdate"><span>يوم الحصة</span>
              <input id="sdate" type="date" className="input" value={date} max={todayISO()} onChange={e => e.target.value && setDate(e.target.value)} /></label>}
            <label className="field grow" htmlFor="stime"><span>ميعاد بداية الحصة</span>
              <input id="stime" type="time" className="input" value={startTime} onChange={e => setStartTime(e.target.value)} /></label>
          </div>
          <span className="muted">اللي بيتسجل بالـ QR بعد الميعاد بأكتر من {LATE_GRACE_MIN} دقايق بيتحسب متأخر.</span>
          <div className="row between"><b>حضر {present.length} من {members.length}</b>
            <button className={scanning ? 'btnp' : 'btn'} style={{ minHeight: 40 }} onClick={() => setScanning(x => !x)}>{scanning ? 'اقفل الكاميرا' : 'اسكان الكروت'}</button></div>
          {scanning && <Scanner onCode={onScan} />}
          <span className="muted">{scanning ? 'وجّه الكاميرا على كارت كل مخدوم، وهيتسجل حاضر لوحده.' : 'ضغطة = حاضر، تانية = اعتذر'}</span>
          {members.length === 0 && <div className="card">مفيش مخدومين في المستوى ده. <Link to="/members/new">ضيف مخدوم</Link></div>}
          <div className="grid3">
            {members.map(m => {
              const s = att[m.id];
              const late = s === 'p' && arrivals[m.id] && startedAt ? minutesLate(arrivals[m.id], startedAt) : 0;
              return (
                <button key={m.id} className={`kid ${s === 'p' ? 'p' : s === 'e' ? 'e' : ''}`} onClick={() => cycleAtt(m.id)} aria-pressed={s === 'p'}>
                  <span className="ph">{m.photo ? <img src={m.photo} alt="" /> : m.name[0]}</span>
                  <span className="nm">{m.name}</span>
                  <span className="tg">{s === 'p' ? (arrivals[m.id] ? `${formatTime(arrivals[m.id])}${late > LATE_GRACE_MIN ? ' • متأخر' : ''}` : 'حاضر') : s === 'e' ? 'اعتذر' : ''}</span>
                </button>
              );
            })}
          </div>
        </>)}

        {mode === 'rate' && (present.length === 0 ? <div className="card">سجّل الحضور الأول، التقييم للحاضرين بس.</div> : <>
          {picker}
          <div className="note">التقييم على {hymn ? `«${hymn.nameAr}»` : 'الحصة'}. كله بيبدأ من 3، غيّر بس اللي يستاهل أعلى أو أقل.</div>
          <div className="card" style={{ paddingBlock: 4 }}><div className="list cols">
            {present.map(m => {
              const r = rate[m.id] ?? [3, 3, 3];
              return (
                <div key={m.id} className="li" style={{ flexWrap: 'wrap' }}>
                  <span className="av">{m.photo ? <img src={m.photo} alt="" /> : m.name[0]}</span>
                  <b className="grow">{m.name}</b>
                  <button className={`chip${notes[m.id]?.trim() ? ' chip-on' : ''}`} onClick={() => setNoteOpen(noteOpen === m.id ? null : m.id)} aria-expanded={noteOpen === m.id}>
                    {notes[m.id]?.trim() ? 'ملاحظة ✓' : '+ ملاحظة'}</button>
                  {noteOpen === m.id && (
                    <textarea autoFocus style={{ width: '100%', minHeight: 64 }} aria-label={`ملاحظة لـ ${m.name}`} placeholder="كلمة تشجيع أو حاجة يركز عليها، هتظهرله في تقييماته"
                      value={notes[m.id] ?? ''} maxLength={200} onChange={e => setNotes(n => ({ ...n, [m.id]: e.target.value }))} />
                  )}
                  <div className="row between" style={{ width: '100%' }}>
                    {CRITERIA.map((c, j) => (
                      <div key={c} className="crit">
                        <div className="step">
                          <button onClick={() => step(m.id, j, -1)} aria-label={`${c} أقل`}>−</button>
                          <b>{r[j]}</b>
                          <button onClick={() => step(m.id, j, 1)} aria-label={`${c} أعلى`}>+</button>
                        </div>
                        <span>{c}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div></div>
        </>)}

        {mode === 'hym' && (present.length === 0 ? <div className="card">سجّل الحضور الأول.</div> : hymns.length === 0 ? <div className="card">منهج الترم فاضي للمستوى ده.</div> : <>
          {picker}
          <div className="row between"><span className="note">اضغط على الحالة تنقلها للي بعدها. باقي الألحان بتتظبط من بروفايل كل مخدوم.</span><button className="chip" style={{ whiteSpace: 'nowrap' }} onClick={bulk} disabled={!hymn}>الكل بيتعلمه</button></div>
          <div className="card" style={{ paddingBlock: 4 }}><div className="list cols">
            {present.map(m => (
              <div key={m.id} className="li">
                <span className="av">{m.photo ? <img src={m.photo} alt="" /> : m.name[0]}</span>
                <b className="grow">{m.name}</b>
                {hymn && (s => <button className={`pill st${s}`} onClick={() => cycleHym(m.id, hymn.id)} aria-label={`${hymn.nameAr}: ${STATUS_LABELS[s]}`}>{STATUS_LABELS[s]}</button>)(hs(m.id, hymn.id))}
              </div>
            ))}
          </div></div>
        </>)}
      </main>

      {toast && <div className={`toast${toast.bad ? ' bad' : ''}`} role="status">{toast.text}</div>}
      <div className="bar gutter"><div>
        <Link to={editing ? `/summary/${editing.id}` : '/'} className="btn">إلغاء</Link>
        <button className="btnp grow" onClick={finish} disabled={!members.length}>{editing ? 'احفظ التعديل' : 'خلّص الحصة'}</button>
      </div></div>
    </>
  );
}
