import { useState } from 'react';
import { Link } from 'react-router-dom';
import '@fontsource/noto-sans-coptic/coptic-400.css';
import { display, loadDictionary, scriptOf, search, type Hit } from '../data/dictionary';
import type { Hymn } from '../data/types';

const lines = (s?: string) => (s ?? '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
import { unifyCoptic } from '../data/unicodeCoptic';
export { looksLikeLegacyFont } from '../data/unicodeCoptic';

type Col = 'cop' | 'arCop' | 'ar';
const COLS: [Col, string][] = [['cop', 'قبطي'], ['arCop', 'قبطي معرّب'], ['ar', 'المعنى']];

/**
 * How each kind of line looks, per device: a size step and a look (هادي = soft, عادي, بارز = bold in the accent colour).
 * Kept to two choices per line so it stays quick to set during a session.
 */
type Look = 'soft' | 'plain' | 'strong';
type TextStyle = Record<Col, { size: number; look: Look }>;
const LOOKS: [Look, string][] = [['soft', 'هادي'], ['plain', 'عادي'], ['strong', 'بارز']];
const BASE: Record<Col, number> = { cop: 20, arCop: 16, ar: 16 };
const DEFAULT_STYLE: TextStyle = { cop: { size: 0, look: 'plain' }, arCop: { size: 0, look: 'soft' }, ar: { size: 0, look: 'plain' } };
const STYLE_KEY = 'khedma.hymnTextStyle';
const STEPS = [-3, 4];
function loadStyle(): TextStyle {
  try { const s = JSON.parse(localStorage.getItem(STYLE_KEY) ?? 'null'); return s ? { ...DEFAULT_STYLE, ...s } : DEFAULT_STYLE; } catch { return DEFAULT_STYLE; }
}
const css = (c: Col, st: TextStyle) => {
  const { size, look } = st[c];
  return {
    fontSize: BASE[c] * (1 + size * 0.15),
    color: look === 'soft' ? 'var(--muted)' : look === 'strong' ? 'var(--act)' : 'var(--fg)',
    fontWeight: look === 'strong' ? 700 : look === 'soft' ? 400 : undefined,
  };
};

/** Hymn text verse by verse; tapping a Coptic word looks it up in the dictionary. */
export default function HymnText({ hymn, dictLink }: { hymn: Hymn; dictLink: string }) {
  // Old-font or Greek-lettered Coptic shows as Unicode, so every word can be looked up.
  const rows = { cop: lines(hymn.copticText && unifyCoptic(hymn.copticText, true)), arCop: lines(hymn.arabicCoptic), ar: lines(hymn.meaning) };
  const present = COLS.filter(([c]) => rows[c].length > 0);
  const [shown, setShown] = useState<Col[]>(present.map(([c]) => c));
  const [style, setStyleState] = useState<TextStyle>(loadStyle);
  const [styling, setStyling] = useState(false);
  const setStyle = (c: Col, x: Partial<TextStyle[Col]>) => setStyleState(st => {
    const next = { ...st, [c]: { ...st[c], ...x } };
    try { localStorage.setItem(STYLE_KEY, JSON.stringify(next)); } catch { /* private mode */ }
    return next;
  });
  const [word, setWord] = useState<{ text: string; hits: Hit[] | null; failed?: boolean } | null>(null);
  if (present.length === 0) return hymn.notes ? <div className="card"><h2>ملاحظات</h2><div className="pre">{hymn.notes}</div></div> : null;
  const n = Math.max(...present.map(([c]) => rows[c].length));
  /** A line starting with § in any column is a section title (same line number in every column). */
  const section = (i: number) => present.map(([c]) => rows[c][i]).find(l => l?.startsWith('§'))?.slice(1).trim();

  const lookUp = async (w: string) => {
    setWord({ text: w, hits: null });
    try {
      const d = await loadDictionary();
      setWord({ text: w, hits: search(d.entries, w, 4).hits });
    } catch { setWord({ text: w, hits: null, failed: true }); }
  };
  const toggle = (c: Col) => setShown(s => s.includes(c) ? (s.length > 1 ? s.filter(x => x !== c) : s) : [...s, c]);

  return (
    <div className="card hymn-text">
      <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h2>نص اللحن</h2>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {present.length > 1 && <div className="chips" style={{ margin: 0 }}>{present.map(([c, label]) =>
            <button key={c} className="chip" aria-pressed={shown.includes(c)} onClick={() => toggle(c)}>{label}</button>)}</div>}
          <button className="chip" aria-pressed={styling} aria-label="شكل الخط" onClick={() => setStyling(x => !x)} style={{ fontWeight: 700 }}>Aa</button>
        </div>
      </div>
      {styling && (
        <div className="text-style">
          {present.filter(([c]) => shown.includes(c)).map(([c, label]) => (
            <div key={c} className="row between" style={{ gap: 8, flexWrap: 'wrap' }}>
              <b style={{ minWidth: 84 }}>{label}</b>
              <div className="row" style={{ gap: 4 }}>
                <button className="chip" aria-label={`صغّر ${label}`} disabled={style[c].size <= STEPS[0]} onClick={() => setStyle(c, { size: style[c].size - 1 })}>−</button>
                <button className="chip" aria-label={`كبّر ${label}`} disabled={style[c].size >= STEPS[1]} onClick={() => setStyle(c, { size: style[c].size + 1 })}>+</button>
              </div>
              <div className="chips" style={{ margin: 0 }}>{LOOKS.map(([l, name]) =>
                <button key={l} className="chip" aria-pressed={style[c].look === l} onClick={() => setStyle(c, { look: l })}>{name}</button>)}</div>
            </div>
          ))}
          <button className="btn" style={{ minHeight: 36 }} onClick={() => { setStyleState(DEFAULT_STYLE); try { localStorage.removeItem(STYLE_KEY); } catch { /* private mode */ } }}>رجّع الشكل الأصلي</button>
        </div>
      )}
      {hymn.notes && <div className="note pre">{hymn.notes}</div>}
      {rows.cop.length > 0 && <div className="muted" style={{ fontSize: 12 }}>دوس على أي كلمة قبطي تعرف معناها.</div>}
      <ol className="verses">
        {Array.from({ length: n }, (_, i) => section(i) !== undefined ? <li key={i} className="sec">{section(i)}</li> : (
          <li key={i}>
            {shown.includes('cop') && rows.cop[i] && <div className="cop coptic-font" dir="ltr" style={css('cop', style)}>
              {display(rows.cop[i]).split(/(\s+)/).map((w, j) => /\s/.test(w) || scriptOf(w) !== 'coptic'
                ? <span key={j}>{w}</span>
                : <button key={j} className="cw" onClick={() => lookUp(w)}>{w}</button>)}
            </div>}
            {shown.includes('arCop') && rows.arCop[i] && <div className="arcop" style={css('arCop', style)}>{rows.arCop[i]}</div>}
            {shown.includes('ar') && rows.ar[i] && <div className="ar" style={css('ar', style)}>{rows.ar[i]}</div>}
          </li>
        ))}
      </ol>

      {word && <div className="backdrop" onClick={() => setWord(null)} />}
      {word && (
        <div className="sheet coptic-font" role="dialog" aria-label={`معنى ${word.text}`}>
          <div className="row between"><b className="coptic-font" dir="ltr" style={{ fontSize: 22 }}>{word.text}</b>
            <button className="icon" onClick={() => setWord(null)} aria-label="اقفل">✕</button></div>
          {word.failed && <div className="note">القاموس محتاج نت أول مرة بس.</div>}
          {!word.failed && !word.hits && <div className="muted">بيدوّر…</div>}
          {word.hits?.length === 0 && <div className="note">الكلمة دي مش في القاموس زي ما هي. ممكن تكون متصرفة أو ملزوق فيها ضمير.</div>}
          {word.hits?.map((h, i) => (
            <div key={i} className="li" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
              <div><span className="coptic-font" dir="ltr" style={{ fontSize: 18 }}>{h.entry.word}</span> <b>{h.entry.meanings.slice(0, 4).join('، ')}</b></div>
              <div className="muted" style={{ fontSize: 12 }}>{[h.entry.kind, h.entry.form].filter(Boolean).join(' • ')}{h.note ? ` • بعد ما شلنا ${h.note}` : ''}</div>
            </div>
          ))}
          <Link className="btn" to={`${dictLink}?q=${encodeURIComponent(word.text)}`}>افتح في القاموس</Link>
        </div>
      )}
    </div>
  );
}
