import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HYMNS_ONLY, PACKS, applyPack, loadPack, packState, strayPackBooks, type Pack } from '../data/packs';
import { useCan, useData } from '../data/store';

/** Offers the ready booklets (hymns with text, audio and page images) not added yet, or a newer edition of one. */
/** books: the books screen, where only real booklets are offered. */
export default function PackCard({ termId, levelId, books }: { termId: string; levelId?: string; books?: boolean }) {
  const [data, update] = useData();
  const edit = useCan('curriculum');
  const stray = strayPackBooks(data).map(b => b.id).join();
  useEffect(() => {
    if (edit && stray) update(d => ({ ...d, books: d.books.filter(b => !strayPackBooks(d).includes(b)) }));
  }, [edit, stray, update]);
  return <>{PACKS.filter(p => (!levelId || p.levelId === levelId) && !(books && HYMNS_ONLY.has(p.id))).map(p => <One key={p.id} id={p.id} termId={termId} />)}</>;
}

function One({ id, termId }: { id: string; termId: string }) {
  const [data, update] = useData();
  const nav = useNavigate();
  const [pack, setPack] = useState<Pack | null>(null);
  useEffect(() => { loadPack(id).then(setPack).catch(() => setPack(null)); }, [id]);
  const state = pack ? packState(data, pack) : 'current';
  if (!pack || state === 'current') return null;
  const level = data.levels.find(l => l.id === pack.levelId);
  const add = () => {
    update(d => applyPack(d, pack, termId, pack.levelId));
    if (pack.book.pageCount) nav('/books');
  };
  return (
    <div className="card">
      <h2>{state === 'old' ? `تحديث: ${pack.book.title}` : pack.book.title}</h2>
      {state === 'old' && !pack.book.pageCount && <div className="note">فيه نصوص متصلّحة للألحان دي. التحديث بيبدّل النص القبطي والنطق المعرّب والمعنى ولينك التسجيل بالنسخة الجديدة، والمنهج زي ما هو.</div>}
      {state === 'old' && !!pack.book.pageCount && <div className="note">فيه نسخة أحدث من الكتاب ده ({pack.book.pageCount} صفحة). التحديث بيبدّل الصفحات وأرقامها في الفهرس، وبيحدّث نصوص الألحان ولينكات تسجيلاتها. الألحان اللي ضفتها للكتاب بإيدك بتفضل.</div>}
      <div className="muted">{pack.book.pageCount
        ? `ملزمة المدرسة جاهزة: ${pack.hymns.length} لحن بالنص القبطي والمعرّب والمعنى ولينك التسجيل، وصفحات الكتاب بالهزات.`
        : `منهج جاهز: ${pack.hymns.length} لحن بالنص القبطي والمعرّب والمعنى ولينك التسجيل ومكانه في الصلاة.`}</div>
      <details><summary className="muted">الفهرس</summary><ol className="muted" style={{ margin: '6px 0 0', paddingInlineStart: 20 }}>{pack.hymns.map(h => <li key={h.nameAr}>{h.nameAr}</li>)}</ol></details>
      {state === 'old'
        ? <button className="btnp" onClick={add}>{pack.book.pageCount ? 'حدّث الكتاب للنسخة الجديدة' : 'حدّث الألحان'}</button>
        : termId
        ? <button className="btnp" onClick={add}>{pack.book.pageCount ? 'ضيف الكتاب' : 'ضيف الألحان'} {level ? `لمنهج ${level.name}` : ''}</button>
        : <div className="note">اعمل ترم الأول من صفحة المنهج.</div>}
      <div className="note">{pack.source}</div>
    </div>
  );
}
