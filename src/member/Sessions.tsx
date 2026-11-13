import { formatDay, formatTime } from '../data/logic';
import { loadRecording } from '../firebase/recordings';
import { VoiceNote } from '../ui/Voice';
import { useG, useView } from './Layout';

const ATT = { p: ['حضرت', 'st3'], e: ['اعتذرت', 'st1'], a: ['غبت', 'st0'] } as const;

/** Each recent session of the member's level: what the class covered and the hymn recording to practise with. */
export default function MemberSessions() {
  const v = useView();
  const g = useG();
  const list = v.sessions ?? [];
  return (
    <>
      <header className="top gutter"><div><h1>الحصص</h1><div className="muted">{g('ملخص كل حصة وتسجيل اللحن عشان تراجع', 'ملخص كل حصة وتسجيل اللحن عشان تراجعي')}</div></div></header>
      <main className="main gutter">
        {list.length === 0 && <div className="card"><div className="note">لسه مفيش حصص متسجلة.</div></div>}
        {list.map((s, i) => (<div key={s.id} style={{ display: 'contents' }}>
          {s.before && !list[i - 1]?.before && <div className="divider-t">{g('حصص قبل ما تنضم للمستوى، تقدر تراجع منها', 'حصص قبل ما تنضمي للمستوى، تقدري تراجعي منها')}</div>}
          <div className={s.before ? 'card before' : 'card'}>
            <div className="row between">
              <div><b>{formatDay(s.date)}</b>{s.hymn && <div className="muted">{s.hymn}</div>}</div>
              {s.att && <span className={`pill ${ATT[s.att][1]}`} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 28 }}>{g(ATT[s.att][0], ATT[s.att][0] + 'ي')}</span>}
              {s.before && <span className="pill" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 28 }}>{g('قبل ما تنضم', 'قبل ما تنضمي')}</span>}
            </div>
            {s.arrived && <div className="muted">{g('وصلت', 'وصلتي')} {formatTime(s.arrived)}{(s.late ?? 0) > 10 ? `، ${g('متأخر', 'متأخرة')} ${s.late} دقيقة` : ''}</div>}
            {s.pts && <div className="pts">
              <b>نقطك في الحصة دي: {s.pts.total}</b>
              <span>حضور {s.pts.att}{s.pts.late ? ` (−${s.pts.late} تأخير)` : ''}</span>{s.pts.rating > 0 && <span>تقييم {s.pts.rating}</span>}
              {s.pts.memorized > 0 && <span>{g('حافظه', 'حافظاه')} {s.pts.memorized}</span>}
              {s.pts.solo > 0 && <span>{g('بيقوله لوحده', 'بتقوله لوحدها')} {s.pts.solo}</span>}
            </div>}
            {s.summary && <div style={{ whiteSpace: 'pre-wrap' }}>{s.summary}</div>}
            {(s.recordings ?? []).map(r => <div key={r.id} className="vrow">{r.title && <b>{r.title}</b>}<VoiceNote id={r.id} ms={r.ms} getBlob={() => loadRecording(r)} /></div>)}
          </div>
        </div>))}
      </main>
    </>
  );
}
