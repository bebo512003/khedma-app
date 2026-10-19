import { useState } from 'react';
import { useCan, useData } from '../data/store';
import { uid } from '../data/logic';
import type { Recording, Session } from '../data/types';
import { deleteRecording, loadRecording, saveRecording } from '../firebase/recordings';
import { Recorder, VoiceNote } from '../ui/Voice';

/**
 * What the class covered and the hymn as sung at the end, for the level's members to see and practise with.
 * Added any time after the session; members get a notification once it's saved.
 */
export default function SessionSummary({ s, open = false }: { s: Session; open?: boolean }) {
  const [, update] = useData();
  const edit = useCan('sessions');
  const [editing, setEditing] = useState(open && edit && !s.summary && !s.recording);
  const [text, setText] = useState(s.summary ?? '');
  const [voice, setVoice] = useState<{ blob: Blob; ms: number } | null>(null);
  const [drop, setDrop] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const has = !!(s.summary || s.recording);

  const start = () => { setText(s.summary ?? ''); setVoice(null); setDrop(false); setError(''); setEditing(true); };
  const save = async () => {
    setBusy(true); setError('');
    try {
      let recording: Recording | undefined = drop ? undefined : s.recording;
      if (voice) {
        const id = uid();
        // Offline, the upload waits in Firestore's queue; don't hold the screen for it.
        const parts = await Promise.race([saveRecording(id, voice.blob), new Promise<number>(r => setTimeout(() => r(Math.max(1, Math.ceil(voice.blob.size / 700_000))), 20000))]);
        recording = { id, mime: voice.blob.type || 'audio/webm', ms: voice.ms, parts };
      }
      if (s.recording && recording?.id !== s.recording.id) deleteRecording(s.recording);
      const summary = text.trim() || undefined;
      update(d => ({ ...d, sessions: d.sessions.map(x => x.id === s.id ? { ...x, summary, recording, summaryAt: Date.now() } : x) }));
      setEditing(false);
    } catch { setError('مقدرناش نحفظ التسجيل. اتأكد إن معاك نت وجرّب تاني.'); }
    setBusy(false);
  };

  if (!editing) return (
    <div className="card">
      <div className="row between"><h2>ملخص الحصة للمخدومين</h2>
        {edit && has && <button className="btn" style={{ minHeight: 36 }} onClick={start}>تعديل</button>}</div>
      {s.summary && <div style={{ whiteSpace: 'pre-wrap' }}>{s.summary}</div>}
      {s.recording && <VoiceNote id={s.recording.id} ms={s.recording.ms} getBlob={() => loadRecording(s.recording!)} />}
      {!has && <div className="note">لسه مفيش ملخص. اكتب وصلتوا لحد فين وسجّل اللحن في آخر الحصة، وهيوصل للمخدومين.</div>}
      {edit && !has && <button className="btnp" onClick={start}>ضيف ملخص وتسجيل</button>}
    </div>
  );

  return (
    <div className="card">
      <h2>ملخص الحصة للمخدومين</h2>
      <label className="field" htmlFor="summary"><span>وصلتوا لحد فين؟</span>
        <textarea id="summary" maxLength={600} style={{ minHeight: 80 }} placeholder="مثلاً: حفظنا أول ٣ أرباع من «أريبصالين»، والمرة الجاية نكمل" value={text} onChange={e => setText(e.target.value)} /></label>
      <div className="field"><span>التسجيل النهائي للحن</span>
        {voice
          ? <><VoiceNote id="new" ms={voice.ms} getBlob={async () => voice.blob} /><button className="btn" onClick={() => setVoice(null)}>سجّل تاني</button></>
          : s.recording && !drop
            ? <><VoiceNote id={s.recording.id} ms={s.recording.ms} getBlob={() => loadRecording(s.recording!)} />
              <div className="row" style={{ gap: 8 }}><button className="btn grow" onClick={() => setDrop(true)}>امسح التسجيل</button></div>
              <Recorder onDone={(blob, ms) => setVoice({ blob, ms })} /></>
            : <Recorder onDone={(blob, ms) => setVoice({ blob, ms })} />}
      </div>
      {error && <div className="alert-t" role="alert">{error}</div>}
      <div className="row">
        <button className="btn grow" onClick={() => setEditing(false)} disabled={busy}>إلغاء</button>
        <button className="btnp grow" onClick={save} disabled={busy || (!text.trim() && !voice && (drop || !s.recording))}>{busy ? 'بيرفع…' : 'احفظ وابعته'}</button>
      </div>
    </div>
  );
}
