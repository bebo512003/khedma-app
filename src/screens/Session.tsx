import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAllowedLevel, useData } from '../data/store';
import { CRITERIA, STATUS_LABELS, type Attendance, type HymnStatus, type Rating, type Session } from '../data/types';
import { currentTerm, todayISO, uid } from '../data/logic';
import Scanner from './Scanner';

type Mode = 'att' | 'rate' | 'hym';
const fmt = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export default function SessionScreen() {
  const { levelId = '' } = useParams();
  const [data, update] = useData();
  const nav = useNavigate();
  const allowed = useAllowedLevel();
  const level = allowed(levelId) ? data.levels.find(l => l.id === levelId) : undefined;
  const term = currentTerm(data);
  const hymnIds = data.curricula[`${term?.id}:${levelId}`] ?? [];
  const hymns = hymnIds.map(id => data.hymns.find(h => h.id === id)!).filter(Boolean);
  const members = useMemo(() => data.members.filter(m => m.levelId === levelId).sort((a, b) => a.name.localeCompare(b.name, 'ar')), [data.members, levelId]);

  // One hymn per session: the servant picks it, and its status and the ratings belong to it. Other hymns are set from each member's profile.
  const lastHymn = [...data.sessions].filter(s => s.levelId === levelId).sort((a, b) => b.date.localeCompare(a.date))[0]?.hymnIds?.[0];
  const [hymnId, setHymnId] = useState<string | undefined>(() => hymnIds.includes(lastHymn ?? '') ? lastHymn : hymnIds[0]);
  const hymn = hymns.find(h => h.id === hymnId);
  const [mode, setMode] = useState<Mode>('att');
  const [att, setAtt] = useState<Record<string, Attendance>>(() => Object.fromEntries(members.map(m => [m.id, 'a'])));
  const [rate, setRate] = useState<Record<string, Rating>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
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
    if (att[m.id] === 'p') { setToast({ text: `${m.name} متسجل قبل كده` }); return; }
    setAtt(a => ({ ...a, [m.id]: 'p' }));
    setToast({ text: `✓ ${m.name} حاضر` });
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
      let memorized = 0, solo = 0;
      sessionHymns.forEach(h => {
        const before = data.progress[m.id]?.[h] ?? 0, after = hs(m.id, h);
        if (before < 2 && after >= 2) memorized++;
        if (before < 3 && after === 3) solo++;
      });
      if (memorized || solo) milestones[m.id] = { memorized, solo };
    });
    const session: Session = {
      id: uid(), date: todayISO(), levelId, termId: term.id, hymnIds: sessionHymns,
      attendance: Object.fromEntries(members.map(m => [m.id, att[m.id] ?? 'a'])),
      ratings: Object.fromEntries(present.map(m => [m.id, rate[m.id] ?? [3, 3, 3]])),
      milestones, durationMs: Date.now() - start,
      notes: Object.fromEntries(present.map(m => [m.id, (notes[m.id] ?? '').trim()]).filter(([, n]) => n)),
    };
    update(d => {
      const progress = { ...d.progress };
      present.forEach(m => { progress[m.id] = { ...(progress[m.id] ?? {}), ...memberHym(m.id) }; });
      return { ...d, sessions: [...d.sessions, session], progress };
    });
    nav(`/summary/${session.id}`, { replace: true });
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
          <div><h1>{level.name}</h1><div className="muted">{hymn ? `لحن الحصة: ${hymn.nameAr}` : hymns.length ? 'اختار لحن الحصة' : 'مفيش ألحان في منهج الترم لسه'}</div></div>
          <span className="timer" aria-label="وقت الحصة">{fmt(now - start)}</span>
        </div>
        <div className="seg" role="group" aria-label="وضع الحصة">
          {([['att', 'الحضور'], ['rate', 'التقييم'], ['hym', 'الألحان']] as const).map(([k, l]) =>
            <button key={k} aria-pressed={mode === k} onClick={() => setMode(k)}>{l}</button>)}
        </div>
      </header>

      <main className="main gutter wide">
        {mode === 'att' && (<>
          <div className="row between"><b>حضر {present.length} من {members.length}</b>
            <button className={scanning ? 'btnp' : 'btn'} style={{ minHeight: 40 }} onClick={() => setScanning(x => !x)}>{scanning ? 'اقفل الكاميرا' : 'اسكان الكروت'}</button></div>
          {scanning && <Scanner onCode={onScan} />}
          <span className="muted">{scanning ? 'وجّه الكاميرا على كارت كل مخدوم، وهيتسجل حاضر لوحده.' : 'ضغطة = حاضر، تانية = اعتذر'}</span>
          {members.length === 0 && <div className="card">مفيش مخدومين في المستوى ده. <Link to="/members/new">ضيف مخدوم</Link></div>}
          <div className="grid3">
            {members.map(m => {
              const s = att[m.id];
              return (
                <button key={m.id} className={`kid ${s === 'p' ? 'p' : s === 'e' ? 'e' : ''}`} onClick={() => cycleAtt(m.id)} aria-pressed={s === 'p'}>
                  <span className="ph">{m.photo ? <img src={m.photo} alt="" /> : m.name[0]}</span>
                  <span className="nm">{m.name}</span>
                  <span className="tg">{s === 'p' ? 'حاضر' : s === 'e' ? 'اعتذر' : ''}</span>
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
        <Link to="/" className="btn">إلغاء</Link>
        <button className="btnp grow" onClick={finish} disabled={!members.length}>خلّص الحصة</button>
      </div></div>
    </>
  );
}
