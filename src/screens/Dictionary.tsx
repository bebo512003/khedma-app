import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import '@fontsource/noto-sans-coptic/coptic-400.css';
import { COPTIC_KEYS, loadDictionary, search, scriptOf, type Hit } from '../data/dictionary';
import { count } from '../data/logic';

type Dict = Awaited<ReturnType<typeof loadDictionary>>;

/** Coptic ⇄ Arabic dictionary. Type Coptic (on-screen keyboard), Arabic, or Coptic in Latin letters. */
export default function Dictionary({ back = '/', base = '' }: { back?: string; base?: string }) {
  const nav = useNavigate();
  const [dict, setDict] = useState<Dict | null>(null);
  const [failed, setFailed] = useState(false);
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [keyboard, setKeyboard] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { loadDictionary().then(setDict).catch(() => setFailed(true)); }, []);
  const result = useMemo(() => dict && q.trim() ? search(dict.entries, q.trim()) : null, [dict, q]);
  const type = (ch: string) => setQ(x => x + ch);

  return (
    <>
      <header className="top gutter">
        <div className="row"><Link to={back} className="icon" aria-label="رجوع">→</Link><div><h1>القاموس القبطي</h1>
          <div className="muted">{dict ? `${dict.entries.length.toLocaleString('en')} كلمة من 3 قواميس • كل اللهجات` : 'لحظة، بنجهّز القاموس…'}</div></div></div>
        <div className="seg" role="tablist">
          <button role="tab" aria-pressed>كلمة</button>
          <button role="tab" aria-pressed={false} onClick={() => nav(`${base}/translate`)}>جملة</button>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <input ref={input} id="dict-q" className="input grow coptic-font" dir="auto" autoComplete="off" spellCheck={false}
            inputMode={keyboard ? 'none' : 'text'} placeholder="اكتب كلمة قبطي أو عربي" value={q} onChange={e => setQ(e.target.value)} />
          <button className="btn" aria-pressed={keyboard} style={{ minHeight: 48 }} onClick={() => { setKeyboard(k => !k); input.current?.focus(); }}>
            {keyboard ? 'عربي' : 'ⲁⲃⲅ'}</button>
        </div>
        {keyboard && (
          <div className="ckeys coptic-font" dir="ltr" role="group" aria-label="كيبورد قبطي">
            {COPTIC_KEYS.map(k => <button key={k} onClick={() => type(k)}>{k}</button>)}
            <button className="wide" onClick={() => type(' ')} aria-label="مسافة">مسافة</button>
            <button className="wide" onClick={() => setQ(x => [...x].slice(0, -1).join(''))} aria-label="امسح حرف">⌫</button>
          </div>
        )}
      </header>
      <main className="main gutter wide coptic-font">
        {failed && <div className="card alert"><div className="alert-t">القاموس مش راضي يفتح</div><div className="note">أول مرة محتاج نت، وبعد كده بيشتغل معاك من غير نت.</div></div>}
        {!q.trim() && dict && (
          <div className="card">
            <b>دوّر بأي طريقة تريحك</b>
            <div className="muted">بالقبطي (زرار ⲁⲃⲅ بيفتح كيبورد قبطي)، أو بالعربي عشان تعرف الكلمة بالقبطي، أو بالحروف الإنجليزي. ولو الكلمة ملزوق فيها أداة زي ⲡⲓⲛⲟⲩϯ، القاموس بيفكها لوحده.</div>
            <div className="try">{['ⲡⲓⲛⲟⲩϯ', 'محبة', 'ⲱⲟⲩ', 'agathos'].map(x => <button key={x} className="chip coptic-font" onClick={() => setQ(x)}>{x}</button>)}</div>
          </div>
        )}
        {result && (
          <>
            <div className="muted">{result.total === 0 ? 'مفيش نتايج.' : `${result.total === 1 ? 'نتيجة واحدة' : count(result.total, 'نتيجة', 'نتيجتين', 'نتايج')}${result.total > result.hits.length ? `، أول ${result.hits.length}` : ''}`}
              {result.total === 0 && scriptOf(q) === 'arabic' && ' جرّب كلمة أقصر أو من غير "ال".'}</div>
            <div className="list cols card" style={{ paddingBlock: 4 }}>
              {result.hits.map((h, i) => <Row key={i} hit={h} />)}
            </div>
          </>
        )}
        {dict && (
          <details className="srcs span">
            <summary>المصادر: أسامة ثابت، وكنيسة مارجرجس بنزلة السمان، وCoptic Dictionary Online</summary>
            قاموس قبطي عربي من إعداد أسامة ثابت (archive.org، ملك عام). وقاموس اللغة القبطية لكنيسة الشهيد العظيم مارجرجس بنزلة السمان (stgeorgesaman.com) بمراجعه: قاموس أبونا أندرياس المقاري، مشروع كيليا، قاموس كروم، ومراجع عربية وإنجليزية مجمعة. المعاني اللي عليها نجمة (*) ترجمة آلية زي ما الموقع كاتب. وأشكال الكلمات في كل اللهجات ومعانيها الإنجليزي من Coptic Dictionary Online (coptic-dictionary.org، القاموس القبطي الشامل لأكاديمية برلين ومشروع KELLIA) برخصة CC BY-SA 4.0، والمعنى العربي ليها مأخوذ من الكلمة البحيري في القاموسين اللي فوق.
          </details>
        )}
      </main>
    </>
  );
}

function Row({ hit: { entry: e, note } }: { hit: Hit }) {
  const tags = [e.kind, e.form, e.origin, ...(e.dialects ?? [])].filter(Boolean);
  return (
    <div className="li" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 4 }}>
      <div className="row between" style={{ width: '100%' }}>
        <span className="coptic-font cword" dir="ltr">{e.word}</span>
        <span className="muted" dir="ltr">{e.latin}</span>
      </div>
      {e.meanings.length > 0 && <b>{e.meanings.join('، ')}</b>}
      {e.forms && e.forms.length > 1 && (
        <div className="muted" style={{ fontSize: 12 }}>في اللهجات: {e.forms.slice(0, 8).map(([f, d], i) => <span key={i}><span className="coptic-font" dir="ltr">{f}</span>{d.length ? ` (${d.join('، ')})` : ''}{i < Math.min(8, e.forms!.length) - 1 ? '، ' : ''}</span>)}</div>
      )}
      {tags.length > 0 && <div className="muted" style={{ fontSize: 12 }}>{tags.join(' • ')}</div>}
      {e.source && <div className="muted" style={{ fontSize: 12 }}>المصدر: {e.source}</div>}
      {note && <span className="tag tag-ex">{note.startsWith('«') ? note : `بعد ما شلنا ${note}`}</span>}
    </div>
  );
}
