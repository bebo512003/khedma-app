import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import '@fontsource/noto-sans-coptic/coptic-400.css';
import { COPTIC_KEYS, scriptOf } from '../data/dictionary';
import { loadTranslator, translate, type Translator, type WordResult } from '../data/translator';

const EXAMPLE = 'Ⲡⲓⲭⲣⲓⲥⲧⲟⲥ ⲁϥⲙⲓⲥⲓ ϧⲉⲛ Ⲃⲏⲑⲗⲉⲉⲙ';

/** Coptic sentence → Arabic. Hymn lines come back as printed; anything else is put together word by word, with each word's pieces shown. */
export default function Translate({ base = '' }: { base?: string }) {
  const [t, setT] = useState<Translator | null>(null);
  const [failed, setFailed] = useState(false);
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [keyboard, setKeyboard] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const nav = useNavigate();

  useEffect(() => { loadTranslator().then(setT).catch(() => setFailed(true)); }, []);
  useEffect(() => { const id = setTimeout(() => setParams(q ? { q } : {}, { replace: true }), 400); return () => clearTimeout(id); }, [q, setParams]);
  const result = useMemo(() => t && scriptOf(q) === 'coptic' ? translate(t, q) : null, [t, q]);
  const type = (ch: string) => setQ(x => x + ch);
  const whole = result?.whole?.score === 1 || (result && result.phrases.length > 0 && result.phrases.every(p => p.match?.score === 1));

  return (
    <>
      <header className="top gutter">
        <div className="row"><Link to={base || '/'} className="icon" aria-label="رجوع">→</Link><div><h1>ترجمة جملة قبطي</h1>
          <div className="muted">قبطي بحيري ← عربي</div></div></div>
        <div className="seg" role="tablist">
          <button role="tab" aria-pressed={false} onClick={() => nav(`${base}/dictionary`)}>كلمة</button>
          <button role="tab" aria-pressed>جملة</button>
        </div>
        <textarea ref={input} id="tr-q" className="input coptic-font" dir="ltr" rows={3} spellCheck={false} autoComplete="off"
          inputMode={keyboard ? 'none' : 'text'} placeholder="الصق أو اكتب جملة قبطي" value={q} onChange={e => setQ(e.target.value)}
          style={{ fontSize: 20, minHeight: 90 }} />
        <div className="row" style={{ gap: 6 }}>
          <button className="btn" aria-pressed={keyboard} onClick={() => { setKeyboard(k => !k); input.current?.focus(); }}>{keyboard ? 'اقفل الكيبورد' : 'كيبورد ⲁⲃⲅ'}</button>
          {q && <button className="btn" onClick={() => setQ('')}>امسح</button>}
        </div>
        {keyboard && (
          <div className="ckeys coptic-font" dir="ltr" role="group" aria-label="كيبورد قبطي">
            {COPTIC_KEYS.map(k => <button key={k} onClick={() => type(k)}>{k}</button>)}
            <button className="wide" onClick={() => type(' ')} aria-label="مسافة">مسافة</button>
            <button className="wide" onClick={() => setQ(x => [...x].slice(0, -1).join(''))} aria-label="امسح حرف">⌫</button>
          </div>
        )}
      </header>
      <main className="main gutter wide">
        {failed && <div className="card alert"><div className="alert-t">المترجم ما اتحملش</div><div className="note">أول مرة بيحتاج نت عشان يتحمل، وبعدها بيشتغل من غير نت.</div></div>}
        {!t && !failed && <div className="note">بيحمّل المترجم…</div>}
        {t && !q.trim() && (
          <div className="card">
            <b>إزاي يشتغل</b>
            <div className="muted">الصق سطر من لحن أو اكتب جملة بالقبطي. لو السطر موجود في مكتبة الألحان هتطلع ترجمته المعتمدة، ولو مش موجود المترجم بيفك كل كلمة لأجزائها (أداة، ضمير، زمن، جذر) ويركّب المعنى.</div>
            <button className="btn" onClick={() => setQ(EXAMPLE)}>جرّب مثال</button>
          </div>
        )}
        {t && q.trim() && !result && <div className="card"><div className="note">اكتب الجملة بالحروف القبطي (دوس على كيبورد ⲁⲃⲅ).</div></div>}
        {result && result.phrases.length > 0 && (
          <>
            <div className="card">
              <div className="row between"><h2>المعنى</h2><span className={`tag ${whole ? 'tag-ok' : 'tag-ex'}`}>{whole ? 'من الألحان' : 'ترجمة تقريبية'}</span></div>
              <div style={{ fontSize: 20, lineHeight: 1.8 }}>{result.arabic || '…'}</div>
              {!whole && <div className="note">اتركّبت من معاني الكلمات، فراجعها بالتحليل اللي تحت.</div>}
            </div>
            {result.whole && !whole && <Near m={result.whole} />}
            {result.phrases.map((p, i) => (
              <div key={i} className="card">
                <div className="coptic-font cword" dir="ltr" style={{ textAlign: 'left' }}>{p.text}</div>
                <b>{p.arabic}</b>
                {p.match && p.match.score < 1 && <Near m={p.match} />}
                <div className="words">{p.words.map((w, j) => <Word key={j} w={w} base={base} />)}</div>
              </div>
            ))}
            <div className="note span">المصادر: تحليل كلمات ونصوص مكتبة ألحان كنيسة مارجرجس نزلة السمان، قاموس أسامة ثابت، وقواعد اللغة القبطية للراهب أندرياس المقاري.</div>
          </>
        )}
      </main>
    </>
  );
}

function Near({ m }: { m: { coptic: string; arabic: string; score: number } }) {
  return (
    <div className="near">
      <div className="muted">أقرب سطر في الألحان ({Math.round(m.score * 100)}٪ شبهه)</div>
      <div className="coptic-font" dir="ltr" style={{ textAlign: 'left' }}>{m.coptic}</div>
      <div>{m.arabic}</div>
    </div>
  );
}

const ROLE: Record<string, string> = { prefix: 'أداة', stem: 'الكلمة', suffix: 'ضمير', word: 'كلمة' };

function Word({ w, base }: { w: WordResult; base: string }) {
  const stem = w.pieces.find(p => p.role === 'stem' || p.role === 'word') ?? w.pieces[w.pieces.length - 1];
  return (
    <div className={`wcard ${w.how}`}>
      <div className="row between">
        <Link to={`${base}/dictionary?q=${encodeURIComponent(stem.form)}`} className="coptic-font cword" dir="ltr">{w.text}</Link>
        <b>{w.arabic || (w.how === 'unknown' ? '؟' : '—')}</b>
      </div>
      {w.pieces.length > 1 && (
        <div className="pieces" dir="ltr">
          {w.pieces.map((p, i) => (
            <span key={i} className={`piece ${p.role}`}>
              <span className="coptic-font">{p.form}</span>
              <small dir="rtl">{p.gloss.replace(/^\((.*)\)$/, '$1') || ROLE[p.role]}</small>
            </span>
          ))}
        </div>
      )}
      {w.how === 'unknown' && <div className="muted" style={{ fontSize: 12 }}>مش لاقيها، اتأكد من الكتابة أو دوّر عليها في القاموس.</div>}
    </div>
  );
}
