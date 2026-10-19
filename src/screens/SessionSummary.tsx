import { useState } from 'react';
import { useCan, useData } from '../data/store';
import { sessionRecordings, uid } from '../data/logic';
import type { Recording, Session } from '../data/types';
import { deleteRecording, loadRecording, saveRecording } from '../firebase/recordings';
import { Recorder, VoiceNote } from '../ui/Voice';

/** Quick titles for the usual takes; any other title can be typed. */
const TITLES = ['الخادم لوحده', 'مع المخدومين', 'المخدومين لوحدهم'];
const MAX_RECS = 6;

type Draft = Recording & { blob?: Blob };

/**
 * What the class covered and the hymn as sung, in as many titled recordings as needed, for the level's members.
 * Added any time after the session; members get a notification once it's saved.
 */
export default function SessionSummary({ s, open = false }: { s: Session; open?: boolean }) {
  const [, update] = useData();
  const edit = useCan('sessions');
  const saved = sessionRecordings(s);
  const has = !!(s.summary || saved.length);
  const [editing, setEditing] = useState(open && edit && !has);
  const [text, setText] = useState(s.summary ?? '');
  const [recs, setRecs] = useState<Draft[]>(saved);
  const [title, setTitle] = useState(TITLES[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const start = () => { setText(s.summary ?? ''); setRecs(sessionRecordings(s)); setTitle(nextTitle(sessionRecordings(s))); setError(''); setEditing(true); };
  const nextTitle = (list: Draft[]) => TITLES.find(t => !list.some(r => r.title === t)) ?? '';
  const add = (blob: Blob, ms: number) => setRecs(list => {
    const next = [...list, { id: uid(), title: title.trim() || `تسجيل ${list.length + 1}`, mime: blob.type || 'audio/webm', ms, parts: 0, blob }];
    setTitle(nextTitle(next));
    return next;
  });
  const setRec = (id: string, x: Partial<Draft>) => setRecs(list => list.map(r => r.id === id ? { ...r, ...x } : r));
  const move = (i: number, by: number) => setRecs(list => { const n = [...list]; [n[i], n[i + by]] = [n[i + by], n[i]]; return n; });

  const save = async () => {
    setBusy(true); setError('');
    try {
      const out: Recording[] = [];
      for (const r of recs) {
        const { blob, ...rec } = r;
        if (blob) {
          // Offline, the upload waits in Firestore's queue; don't hold the screen for it.
          rec.parts = await Promise.race([saveRecording(r.id, blob), new Promise<number>(res => setTimeout(() => res(Math.max(1, Math.ceil(blob.size / 700_000))), 20000))]);
        }
        out.push({ ...rec, title: rec.title?.trim() || undefined });
      }
      saved.filter(r => !out.some(x => x.id === r.id)).forEach(r => deleteRecording(r));
      const summary = text.trim() || undefined;
      update(d => ({ ...d, sessions: d.sessions.map(x => x.id === s.id ? { ...x, summary, recordings: out, recording: undefined, summaryAt: Date.now() } : x) }));
      setEditing(false);
    } catch { setError('مقدرناش نحفظ التسجيلات. اتأكد إن معاك نت وجرّب تاني.'); }
    setBusy(false);
  };

  const player = (r: Draft) => <VoiceNote id={r.id} ms={r.ms} getBlob={r.blob ? async () => r.blob! : () => loadRecording(r)} />;

  if (!editing) return (
    <div className="card">
      <div className="row between"><h2>ملخص الحصة للمخدومين</h2>
        {edit && has && <button className="btn" style={{ minHeight: 36 }} onClick={start}>تعديل</button>}</div>
      {s.summary && <div style={{ whiteSpace: 'pre-wrap' }}>{s.summary}</div>}
      {saved.map(r => <div key={r.id} className="vrow">{r.title && <b>{r.title}</b>}{player(r)}</div>)}
      {!has && <div className="note">لسه مفيش ملخص. اكتب وصلتوا لحد فين وسجّل اللحن، وهيوصل للمخدومين.</div>}
      {edit && !has && <button className="btnp" onClick={start}>ضيف ملخص وتسجيلات</button>}
    </div>
  );

  return (
    <div className="card">
      <h2>ملخص الحصة للمخدومين</h2>
      <label className="field" htmlFor="summary"><span>وصلتوا لحد فين؟</span>
        <textarea id="summary" maxLength={600} style={{ minHeight: 80 }} placeholder="مثلاً: حفظنا أول ٣ أرباع من «أريبصالين»، والمرة الجاية نكمل" value={text} onChange={e => setText(e.target.value)} /></label>

      {recs.length > 0 && <div className="field"><span>التسجيلات ({recs.length})</span>
        {recs.map((r, i) => (
          <div key={r.id} className="vedit">
            <div className="row" style={{ gap: 6 }}>
              <input className="input grow" aria-label="عنوان التسجيل" maxLength={40} value={r.title ?? ''} placeholder="عنوان التسجيل" onChange={e => setRec(r.id, { title: e.target.value })} />
              <button className="icon" disabled={i === 0} onClick={() => move(i, -1)} aria-label="لفوق">↑</button>
              <button className="icon" disabled={i === recs.length - 1} onClick={() => move(i, 1)} aria-label="لتحت">↓</button>
              <button className="icon" onClick={() => setRecs(list => list.filter(x => x.id !== r.id))} aria-label={`امسح ${r.title ?? 'التسجيل'}`}>✕</button>
            </div>
            {player(r)}
          </div>
        ))}
      </div>}

      {recs.length < MAX_RECS && <div className="field"><span>{recs.length ? 'ضيف تسجيل تاني' : 'سجّل اللحن'}</span>
        <div className="chips">{TITLES.map(t => <button key={t} className="chip" aria-pressed={title === t} onClick={() => setTitle(t)}>{t}</button>)}</div>
        <input className="input" aria-label="عنوان التسجيل الجديد" maxLength={40} placeholder="أو اكتب عنوان" value={title} onChange={e => setTitle(e.target.value)} />
        <Recorder onDone={add} />
      </div>}

      {error && <div className="alert-t" role="alert">{error}</div>}
      <div className="row">
        <button className="btn grow" onClick={() => setEditing(false)} disabled={busy}>إلغاء</button>
        <button className="btnp grow" onClick={save} disabled={busy || (!text.trim() && !recs.length && !has)}>{busy ? 'بيرفع…' : 'احفظ وابعته'}</button>
      </div>
    </div>
  );
}
