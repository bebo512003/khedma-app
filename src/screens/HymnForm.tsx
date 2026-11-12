import { hymnSource } from './HymnText';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useData, useIsLead } from '../data/store';
import { bookOf, entryPages, pagesLabel } from '../data/books';
import BookPages from './BookPages';
import { POINTS, currentTerm, hymnPoints, safeUrl, todayISO, uid } from '../data/logic';
import { monthName } from '../data/monthReport';
import type { Hymn } from '../data/types';
import HymnText from './HymnText';
import { unifyCoptic } from '../data/unicodeCoptic';
import { BackButton, goTo } from '../ui/back';
import { partName, splitBySections, splitEven, textRows } from '../data/parts';

const PRAYERS = ['القداس', 'التسبحة', 'رفع البخور', 'الأجبية', 'الدورات', 'المناسبات'];

/** Links must be http(s) so a pasted value can't run script when opened. */

export default function HymnForm() {
  const { hymnId } = useParams();
  const [data, update] = useData();
  const nav = useNavigate();
  const existing = data.hymns.find(h => h.id === hymnId);
  const inBook = existing && bookOf(data, existing.id, currentTerm(data)?.id);
  const [h, setH] = useState<Hymn>(existing ?? { id: uid(), nameAr: '' });
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [evenN, setEvenN] = useState(7);
  const lead = useIsLead();
  const set = (p: Partial<Hymn>) => setH(x => ({ ...x, ...p }));

  const save = () => {
    if (!h.nameAr.trim()) { setError('اكتب اسم اللحن.'); return; }
    for (const u of [h.pdfUrl, h.audioUrl]) if (u?.trim() && !safeUrl(u)) { setError('اللينك لازم يبدأ بـ https://'); return; }
    const parts = (h.parts ?? []).map((p, i) => ({ ...p, name: p.name.trim() || partName(i) }));
    if (parts.some(p => p.from && p.to && p.from > p.to)) { setError('في جزء أول سطر فيه بعد آخر سطر.'); return; }
    const clean: Hymn = { ...h, parts: parts.length ? parts : undefined, copticText: h.copticText && unifyCoptic(h.copticText, true), nameAr: h.nameAr.trim(), pdfUrl: safeUrl(h.pdfUrl), audioUrl: safeUrl(h.audioUrl) };
    update(d => existing
      ? { ...d, hymns: d.hymns.map(x => x.id === clean.id ? clean : x) }
      : { ...d, hymns: [...d.hymns, clean] });
    goTo(nav, existing ? `/hymns/${clean.id}` : '/library');
  };
  const remove = () => {
    update(d => ({
      ...d,
      hymns: d.hymns.filter(x => x.id !== h.id),
      curricula: Object.fromEntries(Object.entries(d.curricula).map(([k, ids]) => [k, ids.filter(id => id !== h.id)])),
      books: d.books.map(b => b.entries.some(e => e.hymnId === h.id) ? { ...b, entries: b.entries.filter(e => e.hymnId !== h.id) } : b),
    }));
    goTo(nav, '/library');
  };

  const text = (key: 'nameAr' | 'nameCoptic' | 'when' | 'occasion', label: string, placeholder = '') => (
    <label className="field" htmlFor={key}><span>{label}</span>
      <input id={key} className="input" value={h[key] ?? ''} placeholder={placeholder} onChange={e => set({ [key]: e.target.value })} /></label>
  );
  const link = (key: 'pdfUrl' | 'audioUrl', label: string) => (
    <label className="field" htmlFor={key}><span>{label}</span>
      <div className="row">
        <input id={key} className="input grow" dir="ltr" inputMode="url" value={h[key] ?? ''} placeholder="https://drive.google.com/…" onChange={e => set({ [key]: e.target.value })} />
        {safeUrl(h[key]) && <a className="btn" href={safeUrl(h[key])} target="_blank" rel="noopener noreferrer">افتح</a>}
      </div></label>
  );

  const area = (key: 'copticText' | 'arabicCoptic' | 'meaning', label: string, coptic = false) => (
    <label className="field" htmlFor={key}><span>{label} <span className="muted">({(h[key] ?? '').split(/\r?\n/).filter(l => l.trim()).length} سطر)</span></span>
      <textarea id={key} className={coptic ? 'coptic-font' : undefined} dir={coptic ? 'ltr' : 'rtl'} value={h[key] ?? ''} onChange={e => set({ [key]: e.target.value })} /></label>
  );
  const counts = (['copticText', 'arabicCoptic', 'meaning'] as const).map(k => (h[k] ?? '').split(/\r?\n/).filter(l => l.trim()).length).filter(Boolean);

  return (
    <>
      <header className="top gutter"><div className="row">
        <BackButton /><h1>{existing ? `تعديل ${h.nameAr}` : 'لحن جديد'}</h1>
      </div></header>
      <main className="main gutter">
        {inBook && <Link to={`/books/${inBook.book.id}`} className="note" style={{ textDecoration: 'none' }}>📖 في كتاب {inBook.book.title}{inBook.entry.from ? ` • ${pagesLabel(inBook.entry)}` : ''}</Link>}
        {text('nameAr', 'اسم اللحن', 'مثلاً: أسبسمس آدام')}
        {text('nameCoptic', 'الاسم القبطي (اختياري)')}
        <div className="field"><span>بيتقال في</span>
          <div className="chips">{PRAYERS.map(p =>
            <button key={p} className="chip" aria-pressed={h.prayer === p} onClick={() => set({ prayer: h.prayer === p ? undefined : p })}>{p}</button>)}</div>
        </div>
        {text('when', 'إمتى في الصلاة', 'مثلاً: بعد صلاة الصلح')}
        {text('occasion', 'المناسبة', 'سنوي، كيهك، الصوم الكبير…')}
        {link('pdfUrl', 'لينك الـ PDF على Google Drive')}
        {link('audioUrl', 'لينك التسجيل الصوتي')}
        <div className="note">الملفات بتفضل على الـ Drive بتاعكم، والتطبيق بيحفظ اللينك بس. خلي الملف متاح لأي حد معاه اللينك.</div>
        <label className="field" htmlFor="source"><span>المصدر</span>
          <input id="source" className="input" placeholder={hymnSource({ ...h, source: '' }) || 'مثلاً: كتاب أو موقع أو كنيسة'} value={h.source ?? ''} onChange={e => set({ source: e.target.value })} /></label>
        <div className="note">بيظهر تحت نص اللحن. لو سبته فاضي واللحن من مكتبة نزلة السمان، بيتكتب المصدر بتاعها لوحده.</div>
        <label className="field" htmlFor="notes"><span>ملاحظات (اختياري)</span>
          <textarea id="notes" style={{ minHeight: 80 }} placeholder="مثلاً: ترتيب الأرباع، أو بيتقال إمتى بالظبط" value={h.notes ?? ''} onChange={e => set({ notes: e.target.value })} /></label>
        <h2>نص اللحن (اختياري)</h2>
        <div className="note">الزق كل جزء في خانته، كل ربع أو جملة في سطر لوحده، وبنفس الترتيب في التلات خانات عشان السطور تتقابل. السطر اللي يبدأ بـ § بيبقى عنوان جزء. الضغط على أي كلمة قبطي في النص بيفتح معناها من القاموس.</div>
        {area('copticText', 'النص القبطي', true)}
        {h.copticText && unifyCoptic(h.copticText, true) !== h.copticText && <div className="note row between"><span>فيه حروف قبطية مش يونيكود (خط قديم أو حروف يوناني). هتتحول لوحدها لما تحفظ.</span><button className="btn" onClick={() => set({ copticText: unifyCoptic(h.copticText!, true) })}>حوّلها دلوقتي</button></div>}
        {area('arabicCoptic', 'القبطي معرّب')}
        {area('meaning', 'المعنى بالعربي')}
        {new Set(counts).size > 1 && <div className="note">عدد السطور مش متساوي في الخانات ({counts.join(' / ')}). اتأكد إن كل سطر قصاده سطره.</div>}
        {counts.length > 0 && <HymnText hymn={h} dictLink="/dictionary" />}
        <PartsEditor h={h} set={set} evenN={evenN} setEvenN={setEvenN} lead={lead} />
        <div className="card">
          <h2>نقط اللحن</h2>
          {lead ? <>
            <div className="note">على قد طول اللحن وصعوبته. الأصلي {POINTS.memorized} لـ«حافظه» و{POINTS.solo} لـ«بيقوله لوحده». التغيير بيمشي على اللي جاي بس، والنقط اللي اتاخدت قبل كده بتفضل زي ما هي.</div>
            <div className="row" style={{ gap: 8 }}>
              {(['memorized', 'solo'] as const).map(k => (
                <label key={k} className="field grow" htmlFor={`pts-${k}`}><span>{k === 'memorized' ? 'حافظه' : 'بيقوله لوحده'}</span>
                  <input id={`pts-${k}`} className="input" inputMode="numeric" placeholder={String(POINTS[k])} value={h.points?.[k] ?? ''}
                    onChange={e => { const n = parseInt(e.target.value.replace(/\D/g, ''), 10); const p = { ...h.points, [k]: n >= 0 ? Math.min(n, 500) : undefined }; set({ points: p.memorized === undefined && p.solo === undefined ? undefined : p }); }} /></label>
              ))}
            </div>
          </> : <div className="note">حافظه = {hymnPoints(h).memorized} نقطة، بيقوله لوحده = {hymnPoints(h).solo} نقطة. الخادم المسؤول بس اللي يغيرهم.</div>}
        </div>
        {inBook && <BookPages book={{ title: inBook.book.title, label: pagesLabel(inBook.entry), pages: entryPages(inBook.book, inBook.entry) }} />}
        {error && <div className="alert-t" role="alert">{error}</div>}
        {existing && (confirmDelete
          ? <div className="card alert"><b>تمسح {h.nameAr} من المكتبة والمنهج؟</b><div className="row"><button className="btn grow" onClick={() => setConfirmDelete(false)}>لا</button><button className="btnp grow" onClick={remove}>امسح</button></div></div>
          : <button className="btn" onClick={() => setConfirmDelete(true)}>امسح اللحن</button>)}
      </main>
      <div className="bar gutter"><div>
        <Link to={existing ? `/hymns/${h.id}` : '/library'} replace className="btn">إلغاء</Link>
        <button className="btnp grow" onClick={save}>احفظ</button>
      </div></div>
    </>
  );
}

/** Splitting a long hymn over several sessions, each part with its own status and recitations. */
function PartsEditor({ h, set, evenN, setEvenN, lead }: { h: Hymn; set: (p: Partial<Hymn>) => void; evenN: number; setEvenN: (n: number) => void; lead: boolean }) {
  const [data] = useData();
  const term = currentTerm(data);
  // Months to pick from: the current term's, else the next six.
  const months = (() => {
    const out: string[] = [];
    const from = (term?.start ?? todayISO()).slice(0, 7), to = term?.end?.slice(0, 7) ?? '';
    for (let m = from; out.length < (to ? 24 : 6) && (!to || m <= to);) { out.push(m); const [y, mo] = m.split('-').map(Number); m = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`; }
    return out;
  })();
  const spread = () => set({ parts: (h.parts ?? []).map((p, i, all) => ({ ...p, month: months[Math.floor(i * months.length / all.length)] })) });
  const setPts = (i: number, k: 'memorized' | 'solo', v: string) => {
    const n = parseInt(v.replace(/\D/g, ''), 10);
    const p = { ...parts[i].points, [k]: n >= 0 ? Math.min(n, 500) : undefined };
    put(i, { points: p.memorized === undefined && p.solo === undefined ? undefined : p });
  };
  const parts = h.parts ?? [];
  const rows = textRows(h);
  const bySections = splitBySections(h);
  const put = (i: number, p: Partial<NonNullable<Hymn['parts']>[number]>) => set({ parts: parts.map((x, j) => j === i ? { ...x, ...p } : x) });
  const num = (v: string) => { const n = parseInt(v, 10); return n > 0 ? Math.min(n, rows || 999) : undefined; };
  return (
    <div className="card">
      <h2>تقسيم اللحن على حصص</h2>
      <div className="note">لو اللحن طويل (زي السبع طرائق) قسّمه أجزاء: كل حصة بتاخد جزء، وكل جزء ليه حالة وتسميع لوحده، واللحن كله بيتحسب حافظه لما كل أجزاءه تبقى حافظها. ولو حددت لكل جزء شهره، الحصة والتسميع بيفتحوا على جزء الشهر ده لوحدهم، ونقط الجزء بتتحسب بس لو وصلها جوه شهره عشان الشهور ماتدخلش في بعض. كل جزء ممكن تحطله نقط (لما يحفظه أو يقوله لوحده)، ونقط اللحن تحت بتتاخد زيادة لما يخلص اللحن كله، فلو عايز النقط على الأجزاء بس خلّي نقط اللحن 0.{rows > 0 ? ` النص فيه ${rows} سطر، وتقدر تحدد كل جزء من سطر كام لسطر كام عشان الدارس يشوف جزءه بس.` : ''}</div>
      {parts.map((p, i) => (
        <div key={p.id} className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <input className="input grow" aria-label={`اسم الجزء ${i + 1}`} value={p.name} placeholder={partName(i)} onChange={e => put(i, { name: e.target.value })} style={{ minWidth: 140 }} />
          {rows > 0 && <>
            <input className="input" style={{ width: 72 }} inputMode="numeric" aria-label="من سطر" placeholder="من" value={p.from ?? ''} onChange={e => put(i, { from: num(e.target.value) })} />
            <input className="input" style={{ width: 72 }} inputMode="numeric" aria-label="لسطر" placeholder="لـ" value={p.to ?? ''} onChange={e => put(i, { to: num(e.target.value) })} />
          </>}
          <button className="icon" aria-label={`امسح ${p.name || partName(i)}`} onClick={() => set({ parts: parts.filter((_, j) => j !== i) })}>✕</button>
          <select className="input" style={{ width: 'auto' }} aria-label={`شهر ${p.name || partName(i)}`} value={p.month ?? ''} onChange={e => put(i, { month: e.target.value || undefined })}>
            <option value="">من غير شهر</option>
            {[...new Set([...months, ...(p.month ? [p.month] : [])])].map(m => <option key={m} value={m}>{monthName(m)}</option>)}
          </select>
          {lead ? <div className="row" style={{ gap: 6, width: '100%', paddingBottom: 6, borderBottom: '1px solid var(--line)' }}>
            <span className="muted" style={{ fontSize: 12 }}>نقط الجزء:</span>
            <input className="input" style={{ width: 70 }} inputMode="numeric" aria-label={`نقط حافظه في ${p.name || partName(i)}`} placeholder="حافظه" value={p.points?.memorized ?? ''} onChange={e => setPts(i, 'memorized', e.target.value)} />
            <input className="input" style={{ width: 70 }} inputMode="numeric" aria-label={`نقط بيقوله لوحده في ${p.name || partName(i)}`} placeholder="لوحده" value={p.points?.solo ?? ''} onChange={e => setPts(i, 'solo', e.target.value)} />
          </div> : (p.points?.memorized || p.points?.solo) ? <div className="muted" style={{ width: '100%', fontSize: 12 }}>نقط الجزء: حافظه {p.points?.memorized ?? 0}، لوحده {p.points?.solo ?? 0}</div> : null}
        </div>
      ))}
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => set({ parts: [...parts, { id: Math.random().toString(36).slice(2, 8), name: partName(parts.length) }] })}>+ جزء</button>
        {bySections.length > 1 && <button className="btn" onClick={() => set({ parts: bySections })}>قسّمه على عناوين النص ({bySections.length})</button>}
        <span className="row" style={{ gap: 4 }}>
          <button className="btn" onClick={() => set({ parts: splitEven(h, evenN) })}>قسّمه بالتساوي على</button>
          <input className="input" style={{ width: 60 }} inputMode="numeric" aria-label="عدد الأجزاء" value={evenN} onChange={e => setEvenN(Math.max(2, Math.min(20, parseInt(e.target.value, 10) || 2)))} />
          <span>حصص</span>
        </span>
        {parts.length > 0 && months.length > 1 && <button className="btn" onClick={spread}>وزّعهم على شهور الترم</button>}
        {parts.length > 0 && <button className="btn" onClick={() => set({ parts: [] })}>شيل التقسيم</button>}
      </div>
    </div>
  );
}
