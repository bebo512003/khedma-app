import { formatDay, formatTime } from '../data/logic';
import { loadRecording } from '../firebase/recordings';
import { VoiceNote } from '../ui/Voice';
import { useView } from './Layout';

const ATT = { p: ['حضرت', 'st3'], e: ['اعتذرت', 'st1'], a: ['غبت', 'st0'] } as const;

/** Each recent session of the member's level: what the class covered and the hymn recording to practise with. */
export default function MemberSessions() {
  const v = useView();
  const list = v.sessions ?? [];
  return (
    <>
      <header className="top gutter"><div><h1>الحصص</h1><div className="muted">ملخص كل حصة وتسجيل اللحن عشان تراجع</div></div></header>
      <main className="main gutter">
        {list.length === 0 && <div className="card"><div className="note">لسه مفيش حصص متسجلة.</div></div>}
        {list.map(s => (
          <div key={s.id} className="card">
            <div className="row between">
              <div><b>{formatDay(s.date)}</b>{s.hymn && <div className="muted">{s.hymn}</div>}</div>
              {s.att && <span className={`pill ${ATT[s.att][1]}`} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 28 }}>{ATT[s.att][0]}</span>}
            </div>
            {s.arrived && <div className="muted">وصلت {formatTime(s.arrived)}{(s.late ?? 0) > 10 ? `، متأخر ${s.late} دقيقة` : ''}</div>}
            {s.summary && <div style={{ whiteSpace: 'pre-wrap' }}>{s.summary}</div>}
            {s.recording && <VoiceNote id={s.recording.id} ms={s.recording.ms} getBlob={() => loadRecording(s.recording!)} />}
          </div>
        ))}
      </main>
    </>
  );
}
