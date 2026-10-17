import { Link, useParams } from 'react-router-dom';
import { useData } from '../data/store';
import { currentTerm, curriculumKey, POINTS } from '../data/logic';
import { STATUS_LABELS } from '../data/types';
import { useMember } from './session';

export default function MemberHymn() {
  const { hymnId } = useParams();
  const [data] = useData();
  const { member } = useMember();
  const h = data.hymns.find(x => x.id === hymnId);
  if (!member || !h) return <main className="main gutter"><div className="card">اللحن ده مش موجود. <Link to="/me/home">ارجع</Link></div></main>;
  const status = data.progress[member.id]?.[h.id] ?? 0;
  const term = currentTerm(data);
  const levels = data.levels.filter(l => (data.curricula[curriculumKey(term?.id, l.id)] ?? []).includes(h.id));
  const next = status < 2 ? POINTS.memorized : status === 2 ? POINTS.solo : 0;
  const place: [string, string | undefined][] = [['الصلاة', h.prayer], ['بيتقال إمتى', h.when], ['المناسبة', h.occasion]];

  return (
    <>
      <header className="top gutter"><div className="row">
        <Link to="/me/home" className="icon" aria-label="رجوع">→</Link>
        <div><h1>{h.nameAr}</h1>{h.nameCoptic && <div className="muted">{h.nameCoptic}</div>}</div>
      </div></header>
      <main className="main gutter">
        <div className="row">
          {h.audioUrl ? <a className="btnp grow" href={h.audioUrl} target="_blank" rel="noopener noreferrer">شغّل الصوت</a> : <span className="btn grow" aria-disabled>مفيش تسجيل لسه</span>}
          {h.pdfUrl ? <a className="btn grow" href={h.pdfUrl} target="_blank" rel="noopener noreferrer">افتح الـ PDF</a> : <span className="btn grow" aria-disabled>مفيش PDF لسه</span>}
        </div>

        <div className="card">
          <div className="row between"><h2>أنت وصلت لفين</h2>{next > 0 && <span className="muted">+{next} نقط لو وصلت للي بعده</span>}</div>
          <div className="chips">{STATUS_LABELS.slice(1).map((l, i) =>
            <span key={l} className={`pill ${status >= i + 1 ? `st${i + 1}` : 'st0'}`} style={{ display: 'inline-flex', alignItems: 'center' }}>{l}{status === i + 1 ? ' ✓' : ''}</span>)}</div>
          <div className="note">اسمعه كل يوم وقوله مع التسجيل، والخادم هيسمعه منك في الحصة.</div>
        </div>

        <div className="card">
          <h2>مكانه في الطقس</h2>
          {place.filter(([, v]) => v).map(([k, v]) => <div key={k} className="row between"><span className="muted">{k}</span><b>{v}</b></div>)}
          {!place.some(([, v]) => v) && <div className="note">الخدام لسه ما كتبوش مكانه.</div>}
          {levels.length > 0 && <div className="row between"><span className="muted">في منهج</span><b>{levels.map(l => l.name).join('، ')}</b></div>}
        </div>
      </main>
    </>
  );
}
