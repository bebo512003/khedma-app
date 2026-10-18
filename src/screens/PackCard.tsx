import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../data/store';
import { PACKS, applyPack, loadPack, packAdded, type Pack } from '../data/packs';

/** Offers the ready booklets (hymns with text, audio and page images) not added yet. */
export default function PackCard({ termId, levelId }: { termId: string; levelId?: string }) {
  return <>{PACKS.filter(p => !levelId || p.levelId === levelId).map(p => <One key={p.id} id={p.id} termId={termId} />)}</>;
}

function One({ id, termId }: { id: string; termId: string }) {
  const [data, update] = useData();
  const nav = useNavigate();
  const [pack, setPack] = useState<Pack | null>(null);
  useEffect(() => { loadPack(id).then(setPack).catch(() => setPack(null)); }, [id]);
  if (!pack || packAdded(data, pack)) return null;
  const level = data.levels.find(l => l.id === pack.levelId);
  const add = () => {
    update(d => applyPack(d, pack, termId, pack.levelId));
    nav('/books');
  };
  return (
    <div className="card">
      <h2>{pack.book.title}</h2>
      <div className="muted">ملزمة المدرسة جاهزة: {pack.hymns.length} لحن بالنص القبطي والمعرّب والمعنى ولينك التسجيل، وصفحات الكتاب بالهزات.</div>
      <details><summary className="muted">الفهرس</summary><ol className="muted" style={{ margin: '6px 0 0', paddingInlineStart: 20 }}>{pack.hymns.map(h => <li key={h.nameAr}>{h.nameAr}</li>)}</ol></details>
      {termId
        ? <button className="btnp" onClick={add}>ضيف الكتاب {level ? `لمنهج ${level.name}` : ''}</button>
        : <div className="note">اعمل ترم الأول من صفحة المنهج.</div>}
      <div className="note">{pack.source}</div>
    </div>
  );
}
