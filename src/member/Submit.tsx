import { useState } from 'react';
import { cloudEnabled } from '../firebase/config';
import { formatDay, isoDate } from '../data/logic';
import { STATUS_LABELS } from '../data/types';
import { loadRecording } from '../firebase/recordings';
import { Recorder, VoiceNote } from '../ui/Voice';
import { useNotes, useView } from './Layout';

const MAX_MS = 5 * 60_000;
/** Recordings are kept in up to 8 pieces of 700 KB (the free plan has no file storage). */
const MAX_FILE = 5 * 1024 * 1024;

/** «سمّع للخادم»: the member records the hymn at home and a servant listens and replies with a level and a note. */
export default function Submit({ hymnId, hymnName, parts, part, onPart }: { hymnId: string; hymnName: string; parts?: { id: string; name: string }[]; part?: string; onPart?: (id?: string) => void }) {
  const v = useView();
  const { subs: mine } = useNotes();
  const [take, setTake] = useState<{ blob: Blob; ms: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!cloudEnabled) return null;

  // A split hymn is recited part by part (or all of it at the end).
  const p = parts?.find(x => x.id === part);
  const here = mine.filter(s => s.hymnId === hymnId && (s.partId ?? '') === (p?.id ?? ''));
  const waiting = here.find(s => s.pending);
  const send = async () => {
    if (!take) return;
    setBusy(true); setError('');
    try {
      const { sendSubmission } = await import('../firebase/submissions');
      await sendSubmission({ memberId: v.memberId, memberName: v.name, levelId: v.levelId ?? '', hymnId, hymnName, ...(p ? { partId: p.id, partName: p.name } : {}) }, take.blob, take.ms);
      setTake(null);
    } catch { setError('مقدرناش نبعت التسجيل. اتأكد إن معاك نت وجرّب تاني.'); }
    setBusy(false);
  };

  return (
    <div className="card">
      <h2>سمّع للخادم</h2>
      {parts && parts.length > 0 && onPart && <div className="field"><span>هتسمّع إيه؟</span>
        <div className="chips">{parts.map(x => <button key={x.id} className="chip" aria-pressed={p?.id === x.id} onClick={() => { onPart(x.id); setTake(null); }}>{x.name}</button>)}
          <button className="chip" aria-pressed={!p} onClick={() => { onPart(undefined); setTake(null); }}>اللحن كله</button></div></div>}
      {waiting
        ? <div className="note">بعت تسميع {p ? `«${p.name}» ` : ''}يوم {formatDay(isoDate(new Date(waiting.at)))}، والخادم هيسمعه ويرد عليك هنا.</div>
        : take
          ? <>
            <VoiceNote id="take" ms={take.ms} getBlob={async () => take.blob} />
            <div className="row">
              <button className="btn grow" onClick={() => setTake(null)} disabled={busy}>سجّل تاني</button>
              <button className="btnp grow" onClick={send} disabled={busy}>{busy ? 'بيبعت…' : 'ابعته للخادم'}</button>
            </div>
          </>
          : <>
            <div className="note">قول اللحن وسجّله (لحد 5 دقايق)، أو ارفع تسجيل كنت عامله قبل كده (لحد 5 ميجا). الخادم هيسمعه ويقولك وصلت لفين.</div>
            <Recorder onDone={(blob, ms) => setTake({ blob, ms })} maxMs={MAX_MS} bitrate={24000} label="سجّل دلوقتي" fileLabel="ارفع تسجيل عندك" maxBytes={MAX_FILE} />
          </>}
      {error && <div className="alert-t" role="alert">{error}</div>}
      {here.filter(s => !s.pending).slice(0, 5).map(s => (
        <div key={s.id} className="vrow" style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}>
          <div className="row between"><b>{formatDay(isoDate(new Date(s.at)))}</b>
            {s.review && <span className={`pill st${s.review.status}`} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 28 }}>{STATUS_LABELS[s.review.status]}</span>}</div>
          {s.review?.note && <div className="reply"><div className="muted">رد {s.review.byName}</div>{s.review.note}</div>}
          {!s.audioGone && <VoiceNote id={s.recording.id} ms={s.recording.ms} getBlob={() => loadRecording(s.recording)} />}
        </div>
      ))}
    </div>
  );
}
