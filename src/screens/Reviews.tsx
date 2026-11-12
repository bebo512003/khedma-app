import { useEffect, useState } from 'react';
import { useAllowedLevel, useCan, useData, useStore } from '../data/store';
import { formatDay, isoDate, formatTime } from '../data/logic';
import { STATUS_LABELS, type HymnStatus, type Submission } from '../data/types';
import { loadRecording } from '../firebase/recordings';
import { VoiceNote } from '../ui/Voice';
import { BackButton } from '../ui/back';
import { partKey, withPartStatus } from '../data/parts';
import { withAward } from '../data/awards';

/** Members' recordings from home waiting for a servant: listen, set their level in the hymn, and leave a note. */
export default function Reviews() {
  const [list, setList] = useState<Submission[] | null>(null);
  const allowed = useAllowedLevel();
  useEffect(() => {
    let stop = () => {};
    import('../firebase/submissions').then(m => { stop = m.watchPending(setList); });
    return () => stop();
  }, []);
  const mine = (list ?? []).filter(s => allowed(s.levelId));

  return (
    <>
      <header className="top gutter"><div className="row">
        <BackButton />
        <div><h1>التسميع</h1><div className="muted">تسجيلات المخدومين من البيت</div></div>
      </div></header>
      <main className="main gutter">
        {list === null && <div className="note">بيحمّل…</div>}
        {list !== null && mine.length === 0 && <div className="card"><div className="note">مفيش تسميع مستني. لما مخدوم يبعت تسجيل من صفحة اللحن هيظهر هنا.</div></div>}
        {mine.map(s => <Review key={s.id} s={s} />)}
      </main>
    </>
  );
}

function Review({ s }: { s: Submission }) {
  const [data, update] = useData();
  const { servant } = useStore();
  const canMembers = useCan('members');
  // A recitation of one part sets that part's level; the hymn's own follows its parts.
  const hymn = data.hymns.find(h => h.id === s.hymnId);
  const part = s.partId ? hymn?.parts?.find(p => p.id === s.partId) : undefined;
  const [status, setStatus] = useState<HymnStatus>(() => (data.progress[s.memberId]?.[part ? partKey(s.hymnId, part.id) : s.hymnId] ?? 1) as HymnStatus);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const m = data.members.find(x => x.id === s.memberId);

  const done = async () => {
    setBusy(true);
    const { reviewSubmission } = await import('../firebase/submissions');
    // Reaching حافظه / بيقوله لوحده from a recitation gives the hymn's points, like a live one.
    update(d => {
      const before = (d.progress[s.memberId]?.[s.hymnId] ?? 0) as HymnStatus;
      const prog = hymn && part ? withPartStatus(hymn, d.progress[s.memberId], part.id, status) : { ...(d.progress[s.memberId] ?? {}), [s.hymnId]: status };
      const next = { ...d, progress: { ...d.progress, [s.memberId]: prog } };
      const pb = (part ? d.progress[s.memberId]?.[partKey(s.hymnId, part.id)] ?? 0 : 0) as HymnStatus;
      return canMembers ? withAward(next, s.memberId, hymn, before, (prog[s.hymnId] ?? 0) as HymnStatus, 'app', part ? { id: part.id, before: pb, after: status } : undefined) : next;
    });
    await reviewSubmission(s.id, { status, note: note.trim() || undefined, by: servant?.uid ?? '', byName: servant?.name ?? 'الخادم' }).catch(() => setBusy(false));
  };

  return (
    <div className="card">
      <div className="row">
        <span className="av">{m?.photo ? <img src={m.photo} alt="" /> : (m?.name ?? s.memberName)[0]}</span>
        <div className="grow"><b>{m?.name ?? s.memberName}</b><div className="muted">{s.hymnName}{s.partName ? ` (${s.partName})` : ''} • {formatDay(isoDate(new Date(s.at)))} {formatTime(s.at)}</div></div>
      </div>
      <VoiceNote id={s.recording.id} ms={s.recording.ms} getBlob={() => loadRecording(s.recording)} />
      <div className="field"><span>وصل لفين في {s.partName ? 'الجزء ده' : 'اللحن'}؟</span>
        <div className="lvl" role="group" aria-label="المستوى">
          {STATUS_LABELS.map((l, i) => <button key={l} className={`st${i}`} aria-pressed={status === i} onClick={() => setStatus(i as HymnStatus)}>{l}</button>)}
        </div></div>
      <textarea aria-label="ملاحظة للمخدوم" maxLength={300} placeholder="ملاحظة ليه (اختياري): مثلاً ركّز على الربع التاني" value={note} onChange={e => setNote(e.target.value)} style={{ minHeight: 60 }} />
      <button className="btnp" onClick={done} disabled={busy}>تمام، ابعتله الرد</button>
    </div>
  );
}
