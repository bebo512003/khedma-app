import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../data/store';
import { PACKS, applyPack, loadPack, packState, type Pack } from '../data/packs';

/** Offers the ready booklets (hymns with text, audio and page images) not added yet, or a newer edition of one. */
export default function PackCard({ termId, levelId }: { termId: string; levelId?: string }) {
  return <>{PACKS.filter(p => !levelId || p.levelId === levelId).map(p => <One key={p.id} id={p.id} termId={termId} />)}</>;
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
    nav('/books');
  };
  return (
    <div className="card">
      <h2>{state === 'old' ? `نسخة جديدة: ${pack.book.title}` : pack.book.title}</h2>
      {state === 'old' && <div className="note">فيه نسخة أحدث من الكتاب ده ({pack.book.pageCount} صفحة). التحديث بيبدّل الصفحات وأرقامها في الفهرس، وبيحدّث نصوص الألحان ولينكات تسجيلاتها. الألحان اللي ضفتها للكتاب بإيدك بتفضل.</div>}
      <div className="muted">{pack.book.pageCount
        ? `ملزمة المدرسة جاهزة: ${pack.hymns.length} لحن بالنص القبطي والمعرّب والمعنى ولينك التسجيل، وصفحات الكتاب بالهزات.`
        : `منهج جاهز: ${pack.hymns.length} لحن بالنص القبطي والمعرّب والمعنى ولينك التسجيل ومكانه في الصلاة.`}</div>
      <details><summary className="muted">الفهرس</summary><ol className="muted" style={{ margin: '6px 0 0', paddingInlineStart: 20 }}>{pack.hymns.map(h => <li key={h.nameAr}>{h.nameAr}</li>)}</ol></details>
      {state === 'old'
        ? <button className="btnp" onClick={add}>حدّث الكتاب للنسخة الجديدة</button>
        : termId
        ? <button className="btnp" onClick={add}>{pack.book.pageCount ? 'ضيف الكتاب' : 'ضيف الألحان'} {level ? `لمنهج ${level.name}` : ''}</button>
        : <div className="note">اعمل ترم الأول من صفحة المنهج.</div>}
      <div className="note">{pack.source}</div>
    </div>
  );
}
