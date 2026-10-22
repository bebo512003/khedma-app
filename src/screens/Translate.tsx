import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import '@fontsource/noto-sans-coptic/coptic-400.css';
import { scriptOf } from '../data/dictionary';
import CopticKeys from '../ui/CopticKeys';
import { loadTranslator, loadVerses, translate, type Match, type Translator, type WordResult } from '../data/translator';
import { arabize } from '../data/arabize';
import { loadArabicLexicon, originOf, toCoptic, type ArabicLexicon, type CWord } from '../data/toCoptic';

const EXAMPLE = 'Ⲡⲓⲭⲣⲓⲥⲧⲟⲥ ⲁϥⲙⲓⲥⲓ ϧⲉⲛ Ⲃⲏⲑⲗⲉⲉⲙ';
const EXAMPLE_AR = 'قام المسيح من الأموات';

/**
 * Coptic ⇄ Arabic, picked by the script typed. Hymn lines come back as printed; anything else is put together
 * word by word, with each word's pieces shown.
 */
export default function Translate({ base = '' }: { base?: string }) {
  const [t, setT] = useState<Translator | null>(null);
  const [failed, setFailed] = useState(false);
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [keyboard, setKeyboard] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const nav = useNavigate();

  // The Bible verses come after the translator opens; the answer is worked out again once they are in.
  const [versesIn, setVersesIn] = useState(false);
  useEffect(() => { loadTranslator().then(x => { setT(x); loadVerses(x).then(() => setVersesIn(true)).catch(() => undefined); }).catch(() => setFailed(true)); }, []);
  useEffect(() => { const id = setTimeout(() => setParams(q ? { q } : {}, { replace: true }), 400); return () => clearTimeout(id); }, [q, setParams]);
  const script = scriptOf(q);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const typed = useDeferredValue(q);
  const result = useMemo(() => t && scriptOf(typed) === 'coptic' ? translate(t, typed) : null, [t, typed, versesIn]);
  // Osama Thabet's Arabic → Coptic lists load only once someone types Arabic; until then the hymns alone answer.
  const [lexicon, setLexicon] = useState<ArabicLexicon | null>(null);
  useEffect(() => { if (script === 'arabic' && !lexicon) loadArabicLexicon().then(setLexicon).catch(() => undefined); }, [script, lexicon]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const back = useMemo(() => t && !result && scriptOf(typed) === 'arabic' ? toCoptic(t, typed, lexicon ?? undefined) : null, [t, typed, result, lexicon, versesIn]);
  const whole = result?.whole?.score === 1 || (result && result.phrases.length > 0 && result.phrases.every(p => p.match?.score === 1));
  // Whole, or put together from whole hymn lines (قام المسيح من الأموات + وصعد إلى السماوات).
  const linesBack = !!back && back.phrases.length > 0 && back.phrases.every(p => p.match?.score === 1 || (p.words.length > 0 && p.words.every(w => w.line)));
  const wholeBack = back?.whole?.score === 1 || linesBack;
  // The same line said another way in the hymns (a Greek and a Coptic wording): shown with the answer, not instead of it.
  const otherWordings: { label?: string; coptic: string }[] = !back ? []
    : back.whole?.score === 1 ? (back.whole.alts ?? []).map(coptic => ({ coptic }))
    : back.phrases.flatMap(p => p.match?.score === 1
      ? (p.match.alts ?? []).map(coptic => ({ label: back.phrases.length > 1 ? p.text : undefined, coptic }))
      : p.words.flatMap(w => (w.line?.alts ?? []).map(coptic => ({ label: w.text, coptic }))));
  const backNote = back?.whole?.score === 1 ? back.whole.note
    : back?.phrases.some(p => p.match?.score !== 1) ? 'اتجمعت من كذا سطر في الألحان'
    : back?.phrases.map(p => p.match?.note).find(Boolean);

  return (
    <>
      <header className="top gutter">
        <div className="row"><Link to={base || '/'} className="icon" aria-label="رجوع">→</Link><div><h1>ترجمة جملة</h1>
          <div className="muted">{script === 'arabic' ? 'عربي ← قبطي بحيري' : script === 'coptic' ? 'قبطي بحيري ← عربي' : 'قبطي بحيري ⇄ عربي'}</div></div></div>
        <div className="seg" role="tablist">
          <button role="tab" aria-pressed={false} onClick={() => nav(`${base}/dictionary`)}>كلمة</button>
          <button role="tab" aria-pressed>جملة</button>
        </div>
        <textarea ref={input} id="tr-q" className="input coptic-font" dir={script === 'arabic' ? 'rtl' : 'ltr'} rows={3} spellCheck={false} autoComplete="off"
          inputMode={keyboard ? 'none' : 'text'} placeholder="اكتب جملة بالقبطي أو بالعربي" value={q} onChange={e => setQ(e.target.value)}
          style={{ fontSize: 20, minHeight: 90 }} />
        <div className="row" style={{ gap: 6 }}>
          <button className="btn" aria-pressed={keyboard} onClick={() => { setKeyboard(k => !k); input.current?.focus(); }}>{keyboard ? 'اقفل الكيبورد' : 'كيبورد ⲁⲃⲅ'}</button>
          {q && <button className="btn" onClick={() => setQ('')}>امسح</button>}
        </div>
        {keyboard && (
          <CopticKeys field={input} value={q} onChange={setQ} />
        )}
      </header>
      <main className="main gutter wide">
        {failed && <div className="card alert"><div className="alert-t">المترجم مش راضي يفتح</div><div className="note">أول مرة محتاج نت، وبعد كده بيشتغل معاك من غير نت.</div></div>}
        {!t && !failed && <div className="note">لحظة، بنجهّز المترجم…</div>}
        {t && !q.trim() && (
          <div className="card">
            <b>اكتب وهو يترجم</b>
            <div className="muted">قبطي يطلعلك عربي، وعربي يطلعلك قبطي، حتى لو كتبت بالعامية (عايز، بيصلي، ماشافش) أو كتبت الاسم بطريقة تانية (ماركو = مرقس، جورج = جرجس). لو الجملة من الألحان هتلاقي نصها المعروف، ولو لأ هيترجمها كلمة كلمة ويوريك كل كلمة اتعملت إزاي، فراجعها بعينك.</div>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn" onClick={() => setQ(EXAMPLE)}>مثال قبطي</button>
              <button className="btn" onClick={() => setQ(EXAMPLE_AR)}>مثال عربي</button>
            </div>
          </div>
        )}
        {t && q.trim() && !result && !back && <div className="card"><div className="note">اكتب الجملة بالحروف القبطي (دوس على كيبورد ⲁⲃⲅ) أو بالعربي.</div></div>}
        {back && back.phrases.length > 0 && (
          <>
            <div className="card">
              <div className="row between"><h2>بالقبطي</h2><span className={`tag ${wholeBack ? 'tag-ok' : 'tag-ex'}`}>{wholeBack ? fromWhere(back.whole ?? back.phrases[0]?.match) : 'ترجمة تقريبية'}</span></div>
              <div className="coptic-font" dir="ltr" style={{ fontSize: 22, lineHeight: 1.8, textAlign: 'left' }}>{back.coptic || '…'}</div>
              {wholeBack && backNote && <div className="muted" style={{ fontSize: 13 }}>{backNote}</div>}
              {back.coptic && <div className="say">النطق: <b>{arabize(back.coptic)}</b></div>}
              {otherWordings.length > 0 && (
                <div className="other-wordings">
                  <div className="muted" style={{ fontSize: 13 }}>وبتتقال في الألحان كمان كده:</div>
                  {otherWordings.map((o, i) => (
                    <div key={i} className="near">
                      {o.label && <div className="muted" style={{ fontSize: 12 }}>{o.label}</div>}
                      <div className="coptic-font" dir="ltr" style={{ fontSize: 19, textAlign: 'left' }}>{o.coptic}</div>
                      <div className="say">النطق: <b>{arabize(o.coptic)}</b>{t && greek(t, o.coptic) && ' • يوناني'}</div>
                    </div>
                  ))}
                </div>
              )}
              {!wholeBack && <div className="note">اتركّبت كلمة كلمة، فراجعها بالتحليل اللي تحت. الكلمات اللي بين أقواس ما لقيتلهاش مقابل.</div>}
            </div>
            {back.whole && !wholeBack && <Near m={back.whole} />}
            {back.phrases.map((p, i) => (
              <div key={i} className="card">
                {back.phrases.length > 1 && <>
                  <b>{p.text}</b>
                  <div className="coptic-font cword" dir="ltr" style={{ textAlign: 'left' }}>{p.coptic}</div>
                  <div className="say">النطق: <b>{arabize(p.coptic)}</b></div>
                </>}
                {p.match && p.match.score < 1 && <Near m={p.match} />}
                <div className="words">{p.words.filter(w => w.text).map((w, j) => <CopticWord key={j} w={w} base={base} t={t!} />)}</div>
              </div>
            ))}
            <details className="srcs span"><summary>المصادر</summary>نصوص وتحليل كلمات مكتبة ألحان كنيسة مارجرجس بنزلة السمان وقاموسها، وقاموس أسامة ثابت وقاموس معوض داود عبد النور، وبرنامج أسامة ثابت للترجمة المساعدة آليًا من العربي للقبطي (2019)، والكتاب المقدس: النص البحيري من Coptic SCRIPTORIUM (CC BY 4.0) مربوط آية بآية بترجمة فاندايك (ملك عام).</details>
          </>
        )}
        {result && result.phrases.length > 0 && (
          <>
            <div className="card">
              <div className="row between"><h2>المعنى</h2><span className={`tag ${whole ? 'tag-ok' : 'tag-ex'}`}>{whole ? fromWhere(result.whole ?? result.phrases[0]?.match) : 'ترجمة تقريبية'}</span></div>
              <div style={{ fontSize: 20, lineHeight: 1.8 }}>{result.arabic || '…'}</div>
              {!whole && <div className="note">اتركّبت من معاني الكلمات، فراجعها بالتحليل اللي تحت.</div>}
            </div>
            {result.whole && !whole && <Near m={result.whole} />}
            {result.phrases.map((p, i) => (
              <div key={i} className="card">
                <div className="coptic-font cword" dir="ltr" style={{ textAlign: 'left' }}>{p.text}</div>
                <div className="say">النطق: <b>{arabize(p.text)}</b></div>
                <b>{p.arabic}</b>
                {p.match && p.match.score < 1 && <Near m={p.match} />}
                <div className="words">{p.words.map((w, j) => <Word key={j} w={w} base={base} t={t!} />)}</div>
              </div>
            ))}
            <details className="srcs span"><summary>المصادر</summary>تحليل كلمات ونصوص مكتبة ألحان كنيسة مارجرجس بنزلة السمان وقاموسها، قاموس أسامة ثابت، قاموس معوض داود عبد النور، قواعد اللغة القبطية للراهب أندرياس المقاري، جداول التصريف والأفعال من «Grammaire copte» للأب ألكسيس مالون (بيروت، 1907، ملك عام)، والكتاب المقدس: النص البحيري من Coptic SCRIPTORIUM (CC BY 4.0) مربوط آية بآية بترجمة فاندايك (ملك عام).</details>
          </>
        )}
      </main>
    </>
  );
}

/** A line most of whose words are Greek (Ⲁ̀ⲅⲓⲟⲥ ⲁ̀ⲅⲓⲟⲥ, Ⲡⲭ̅ⲥ̅ ⲁⲛⲉⲥⲧⲏ ⲉⲕⲛⲉⲕⲣⲱⲛ). */
const greek = (t: Translator, c: string) => { const w = c.split(' ').filter(x => x.length > 2); return w.length > 0 && w.filter(x => originOf(t, x) === 'يوناني').length * 2 > w.length; };

/** Where a line found whole comes from: the hymns, or a Bible verse with its reference. */
const fromWhere = (m?: Match) => m?.ref ? `من الكتاب المقدس (${m.ref})` : 'من الألحان';

function Near({ m }: { m: Match }) {
  return (
    <div className="near">
      <div className="muted">{m.ref ? `أقرب آية: ${m.ref}` : 'أقرب سطر في الألحان'} ({Math.round(m.score * 100)}٪ شبهه)</div>
      <div className="coptic-font" dir="ltr" style={{ textAlign: 'left' }}>{m.coptic}</div>
      <div>{m.arabic}</div>
    </div>
  );
}

const HOW: Record<CWord['how'], string> = { hymns: 'من الألحان', grammar: 'متركّبة', dictionary: 'من القاموس', unknown: '' };

function CopticWord({ w, base, t }: { w: CWord; base: string; t: Translator }) {
  const stem = w.pieces[w.pieces.length - 1]?.form ?? w.coptic;
  const origin = originOf(t, stem.split(' ').pop() ?? '');
  return (
    <div className={`wcard ${w.how === 'dictionary' ? 'grammar' : w.how}`}>
      <div className="row between">
        <b>{w.text}</b>
        {w.coptic
          ? <Link to={`${base}/dictionary?q=${encodeURIComponent(w.pieces[w.pieces.length - 1]?.form.split(' ')[0] || w.coptic)}`} className="coptic-font cword" dir="ltr">{w.coptic}</Link>
          : <b>؟</b>}
      </div>
      {w.coptic && <div className="say" dir="rtl">{arabize(w.coptic)}{origin && <span className="muted"> • أصلها {origin}</span>}</div>}
      {w.pieces.length > 1 && (
        <div className="pieces" dir="ltr">
          {w.pieces.map((p, i) => <span key={i} className="piece"><span className="coptic-font">{p.form}</span><small dir="rtl">{p.gloss}</small></span>)}
        </div>
      )}
      {w.alts && w.alts.length > 0 && (
        <div className="muted" style={{ fontSize: 12 }}>وبرضه بتتقال: {w.alts.map((c, i) => <span key={c}>{i > 0 && '، '}<Link to={`${base}/dictionary?q=${encodeURIComponent(c)}`} className="coptic-font" dir="ltr">{c}</Link> ({arabize(c)}{originOf(t, c) && `، ${originOf(t, c)}`})</span>)}</div>
      )}
      {w.how === 'unknown'
        ? <div className="muted" style={{ fontSize: 12 }}>مش لاقيها، جرّب كلمة بنفس المعنى أو دوّر في القاموس.</div>
        : <div className="muted" style={{ fontSize: 12 }}>{w.as && (w.near ? `قصدك «${w.as}»؟ ` : `فهمتها «${w.as}» • `)}{HOW[w.how]}</div>}
    </div>
  );
}

const ROLE: Record<string, string> = { prefix: 'أداة', stem: 'الكلمة', suffix: 'ضمير', word: 'كلمة' };

function Word({ w, base, t }: { w: WordResult; base: string; t: Translator }) {
  const stem = w.pieces.find(p => p.role === 'stem' || p.role === 'word') ?? w.pieces[w.pieces.length - 1];
  const origin = stem ? originOf(t, stem.form) : '';
  return (
    <div className={`wcard ${w.how}`}>
      <div className="row between">
        <Link to={`${base}/dictionary?q=${encodeURIComponent(stem.form)}`} className="coptic-font cword" dir="ltr">{w.text}</Link>
        <b>{w.arabic || (w.how === 'unknown' ? '؟' : '—')}</b>
      </div>
      <div className="say">{arabize(w.text)}{origin && <span className="muted"> • أصلها {origin}</span>}</div>
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
