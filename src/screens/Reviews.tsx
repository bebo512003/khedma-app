import { fx } from '../data/logic';
import { useEffect, useState } from 'react';
import { useAllowedLevel, useCan, useData, useStore } from '../data/store';
import { formatDay, isoDate, formatTime, todayISO } from '../data/logic';
import { statusLabels, type AppData, type HymnStatus, type Submission } from '../data/types';
import { loadRecording } from '../firebase/recordings';
import { VoiceNote } from '../ui/Voice';
import { BackButton } from '../ui/back';
import { partKey, withPartStatus } from '../data/parts';
import { withAward } from '../data/awards';

/** The month a recitation belongs to: its part's, else its hymn's (none when the curriculum gives no month). */
export function subMonth(data: AppData, s: Pick<Submission, 'hymnId' | 'partId'>) {
  const h = data.hymns.find(x => x.id === s.hymnId);
  return (s.partId ? h?.parts?.find(p => p.id === s.partId)?.month : undefined) ?? h?.month;
}
/** Answered recitations stay for every servant through their hymn's (or part's) month; with no month, 30 days after the reply. */
export const keptAnswered = (data: AppData, s: Submission, now = Date.now()) => {
  if (s.pending || s.audioGone) return false;
  const month = subMonth(data, s);
  return month ? month >= todayISO().slice(0, 7) : (s.reviewAt ?? s.at) > now - 30 * 86_400_000;
};

/** Members' recordings from home: waiting for a servant (listen, set their level, leave a note), and the answered ones of this month. */
export default function Reviews() {
  const [data] = useData();
  const [list, setList] = useState<Submission[] | null>(null);
  const [tab, setTab] = useState<'wait' | 'done'>('wait');
  const allowed = useAllowedLevel();
  useEffect(() => {
    let stop = () => {};
    // Two months back covers a recitation sent early for a part of this month.
    import('../firebase/submissions').then(m => { stop = m.watchSince(Date.now() - 62 * 86_400_000, setList); });
    return () => stop();
  }, []);
  const ok = (list ?? []).filter(s => allowed(s.levelId));
  const waiting = ok.filter(s => s.pending).sort((a, b) => a.at - b.at);
  const answered = ok.filter(s => keptAnswered(data, s));
  const mine = tab === 'wait' ? waiting : answered;

  return (
    <>
      <header className="top gutter"><div className="row">
        <BackButton />
        <div><h1>التسميع</h1><div className="muted">تسجيلات المخدومين من البيت</div></div>
      </div>
      <div className="ptabs" role="tablist">
        <button role="tab" aria-selected={tab === 'wait'} onClick={() => setTab('wait')}>مستني رد ({waiting.length})</button>
        <button role="tab" aria-selected={tab === 'done'} onClick={() => setTab('done')}>اتسمع ({answered.length})</button>
      </div></header>
      <main className="main gutter">
        {list === null && <div className="note">بيحمّل…</div>}
        {list !== null && mine.length === 0 && <div className="card"><div className="note">{tab === 'wait' ? 'مفيش تسميع مستني. لما مخدوم يبعت تسجيل من صفحة اللحن هيظهر هنا.' : 'مفيش تسميع اتسمع في الشهر ده لسه.'}</div></div>}
        {tab === 'done' && mine.length > 0 && <div className="note">التسميع اللي اتسمع بيفضل هنا لكل الخدام لحد آخر شهر اللحن أو الجزء بتاعه، ولو مالوش شهر بيفضل 30 يوم.</div>}
        {mine.map(s => s.pending ? <Review key={s.id} s={s} /> : <Answered key={s.id} s={s} />)}
      </main>
    </>
  );
}

/** An answered recitation: listen again, see who answered and what; the answer can be changed. */
function Answered({ s }: { s: Submission }) {
  const [data] = useData();
  const [edit, setEdit] = useState(false);
  const m = data.members.find(x => x.id === s.memberId);
  if (edit) return <Review s={s} onDone={() => setEdit(false)} />;
  return (
    <div className="card">
      <div className="row">
        <span className="av">{m?.photo ? <img src={m.photo} alt="" /> : (m?.name ?? s.memberName)[0]}</span>
        <div className="grow"><b>{m?.name ?? s.memberName}</b><div className="muted">{s.hymnName}{s.partName ? ` (${s.partName})` : ''} • {formatDay(isoDate(new Date(s.at)))} {formatTime(s.at)}</div></div>
      </div>
      <VoiceNote id={s.recording.id} ms={s.recording.ms} getBlob={() => loadRecording(s.recording)} />
      {s.review && <div className="note" style={{ color: 'var(--fg)' }}>{s.review.byName} {fx(m, 'سمعه', 'سمعها')}: <b>{statusLabels(m)[s.review.status]}</b>{s.review.note ? ` • «${s.review.note}»` : ''}</div>}
      <button className="btn" onClick={() => setEdit(true)}>عدّل الرد</button>
    </div>
  );
}

function Review({ s, onDone }: { s: Submission; onDone?: () => void }) {
  const [data, update] = useData();
  const { servant } = useStore();
  const canMembers = useCan('members');
  // A recitation of one part sets that part's level; the hymn's own follows its parts.
  const hymn = data.hymns.find(h => h.id === s.hymnId);
  const part = s.partId ? hymn?.parts?.find(p => p.id === s.partId) : undefined;
  const [status, setStatus] = useState<HymnStatus>(() => (data.progress[s.memberId]?.[part ? partKey(s.hymnId, part.id) : s.hymnId] ?? 1) as HymnStatus);
  const [note, setNote] = useState(s.review?.note ?? '');
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
    await reviewSubmission(s.id, { status, note: note.trim() || undefined, by: servant?.uid ?? '', byName: servant?.name ?? 'الخادم' }).then(() => onDone?.(), () => setBusy(false));
  };

  return (
    <div className="card">
      <div className="row">
        <span className="av">{m?.photo ? <img src={m.photo} alt="" /> : (m?.name ?? s.memberName)[0]}</span>
        <div className="grow"><b>{m?.name ?? s.memberName}</b><div className="muted">{s.hymnName}{s.partName ? ` (${s.partName})` : ''} • {formatDay(isoDate(new Date(s.at)))} {formatTime(s.at)}</div></div>
      </div>
      <VoiceNote id={s.recording.id} ms={s.recording.ms} getBlob={() => loadRecording(s.recording)} />
      <div className="field"><span>{fx(m, 'وصل', 'وصلت')} لفين في {s.partName ? 'الجزء ده' : 'اللحن'}؟</span>
        <div className="lvl" role="group" aria-label="المستوى">
          {statusLabels(m).map((l, i) => <button key={i} className={`st${i}`} aria-pressed={status === i} onClick={() => setStatus(i as HymnStatus)}>{l}</button>)}
        </div></div>
      <textarea aria-label="ملاحظة للمخدوم" maxLength={300} placeholder={fx(m, 'ملاحظة ليه (اختياري): مثلاً ركّز على الربع التاني', 'ملاحظة ليها (اختياري): مثلاً ركّزي على الربع التاني')} value={note} onChange={e => setNote(e.target.value)} style={{ minHeight: 60 }} />
      <button className="btnp" onClick={done} disabled={busy}>{fx(m, 'تمام، ابعتله الرد', 'تمام، ابعتلها الرد')}</button>
    </div>
  );
}
