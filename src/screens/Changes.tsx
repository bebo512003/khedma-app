import { useEffect, useState } from 'react';
import { useData, useIsLead } from '../data/store';
import { formatDay, formatTime } from '../data/logic';
import type { AppData } from '../data/types';
import type { Change, ChangeItem } from '../firebase/changes';
import { BackButton } from '../ui/back';

const WHAT: Record<ChangeItem['what'], string> = {
  levels: 'مستوى', members: 'مخدوم', hymns: 'لحن', books: 'كتاب', terms: 'ترم', sessions: '', progress: 'مستوى ألحان', meta: '',
};
const KIND: Record<ChangeItem['kind'], string> = { add: 'ضاف', edit: 'عدّل', delete: 'مسح' };
const LISTS = ['levels', 'members', 'hymns', 'books', 'terms', 'sessions'] as const;

/** The lead's view of who changed what and when, with a way to put back anything deleted. */
export default function Changes() {
  const [data, update] = useData();
  const lead = useIsLead();
  const [log, setLog] = useState<(Change & { id: string })[] | null>(null);
  const [error, setError] = useState('');
  const [who, setWho] = useState('');
  const [onlyDeletes, setOnlyDeletes] = useState(false);
  const [done, setDone] = useState<string[]>([]);

  useEffect(() => {
    if (!lead) return;
    let stop = () => {};
    Promise.all([import('../firebase/app'), import('firebase/firestore'), import('../firebase/paths')]).then(([{ servantFb }, fs, paths]) => {
      const q = fs.query(paths.col(servantFb().db, 'changes'), fs.orderBy('at', 'desc'), fs.limit(300));
      stop = fs.onSnapshot(q, s => setLog(s.docs.map(d => ({ id: d.id, ...(d.data() as Change) }))), e => setError(e.message));
    });
    return () => stop();
  }, [lead]);

  if (!lead) return <main className="main gutter"><div className="card">سجل التعديلات للخادم المسؤول والأدمن.</div></main>;

  const people = [...new Map((log ?? []).map(c => [c.by, c.byName])).entries()];
  const shown = (log ?? []).filter(c => !who || c.by === who)
    .map(c => ({ ...c, items: onlyDeletes ? c.items.filter(i => i.kind === 'delete') : c.items }))
    .filter(c => c.items.length);
  const present = (i: ChangeItem) => i.what === 'progress' ? !!data.progress[i.id] : LISTS.includes(i.what as typeof LISTS[number]) && (data[i.what as typeof LISTS[number]] as { id: string }[]).some(x => x.id === i.id);
  const putBack = (i: ChangeItem) => {
    if (i.what === 'progress') {
      update(d => d.progress[i.id] ? d : { ...d, progress: { ...d.progress, [i.id]: i.before as AppData['progress'][string] } });
      setDone(x => [...x, i.id]); return;
    }
    const k = i.what as typeof LISTS[number];
    update(d => (d[k] as { id: string }[]).some(x => x.id === i.id) ? d : { ...d, [k]: [...(d[k] as unknown[]), i.before] } as AppData);
    setDone(x => [...x, i.id]);
  };
  let lastDay = '';

  return (
    <>
      <header className="top gutter"><div className="row"><BackButton to="/settings" /><div><h1>سجل التعديلات</h1>
        <div className="muted">مين ضاف أو عدّل أو مسح إيه، وامتى</div></div></div></header>
      <main className="main gutter">
        <div className="chips">
          <button className="chip" aria-pressed={!who} onClick={() => setWho('')}>الكل</button>
          {people.map(([uid, name]) => <button key={uid} className="chip" aria-pressed={who === uid} onClick={() => setWho(uid)}>{name}</button>)}
          <button className="chip" aria-pressed={onlyDeletes} onClick={() => setOnlyDeletes(x => !x)}>المسح بس</button>
        </div>
        {error && <div className="note" dir="ltr">{error}</div>}
        {!log && !error && <div className="muted">بيحمّل…</div>}
        {log && shown.length === 0 && <div className="card"><div className="note">مفيش تعديلات متسجلة لسه. السجل بيبدأ من النهارده.</div></div>}
        {shown.length > 0 && <div className="card" style={{ paddingBlock: 4 }}><div className="list">
          {shown.map(c => {
            const day = new Date(c.at).toISOString().slice(0, 10);
            const head = day !== lastDay ? formatDay(day) : '';
            lastDay = day;
            return (
              <div key={c.id}>
                {head && <div className="divider-t">{head}</div>}
                <div className="li" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 4 }}>
                  <div className="muted"><b>{c.byName}</b> • {formatTime(c.at)}</div>
                  {c.items.map((i, n) => (
                    <div key={n} className="row between" style={{ width: '100%', gap: 8 }}>
                      <span className={i.kind === 'delete' ? 'alert-t' : undefined}>{KIND[i.kind]} {WHAT[i.what]} {i.label}</span>
                      {i.kind === 'delete' && i.before != null && (present(i) || done.includes(i.id)
                        ? <span className="muted">رجع</span>
                        : <button className="btn" style={{ minHeight: 34 }} onClick={() => putBack(i)}>رجّعه</button>)}
                    </div>
                  ))}
                  {c.more ? <div className="muted">و{c.more} تعديل كمان</div> : null}
                </div>
              </div>
            );
          })}
        </div></div>}
        <div className="note">لما ترجّع مخدوم اتمسح، بيرجع ببياناته من غير صورته، ورجّع كمان «مستوى ألحان» بتاعه من نفس التعديل. حضوره وتقييماته القديمة في الحصص لسه موجودة.</div>
      </main>
    </>
  );
}
