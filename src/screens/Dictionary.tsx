import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import '@fontsource/noto-sans-coptic/coptic-400.css';
import { loadDictionary, search, scriptOf, type Hit } from '../data/dictionary';
import CopticKeys from '../ui/CopticKeys';
import { count } from '../data/logic';
import { arabize } from '../data/arabize';

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
  // Typing stays quick: the search catches up with the latest letters.
  const typed = useDeferredValue(q);
  const result = useMemo(() => dict && typed.trim() ? search(dict.entries, typed.trim()) : null, [dict, typed]);

  return (
    <>
      <header className="top gutter">
        <div className="row"><Link to={back} className="icon" aria-label="رجوع">→</Link><div><h1>القاموس القبطي</h1>
          <div className="muted">{dict ? `${dict.entries.length.toLocaleString('en')} كلمة من 4 قواميس • كل اللهجات` : 'لحظة، بنجهّز القاموس…'}</div></div></div>
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
          <CopticKeys field={input} value={q} onChange={setQ} />
        )}
      </header>
      <main className="main gutter wide coptic-font">
        {failed && <div className="card alert"><div className="alert-t">القاموس مش راضي يفتح</div><div className="note">أول مرة محتاج نت، وبعد كده بيشتغل معاك من غير نت.</div></div>}
        {!q.trim() && dict && (
          <div className="card">
            <b>دوّر بأي طريقة تريحك</b>
            <div className="muted">بالقبطي (زرار ⲁⲃⲅ بيفتح كيبورد قبطي)، أو بالعربي عشان تعرف الكلمة بالقبطي، أو بالقبطي المعرّب زي «إفنوتي»، أو بالحروف الإنجليزي. ولو كتبت الكلمة بحرف غلط هيطلعلك أقرب كلمات ليها. ولو الكلمة ملزوق فيها أداة زي ⲡⲓⲛⲟⲩϯ، القاموس بيفكها لوحده.</div>
            <div className="try">{['ⲡⲓⲛⲟⲩϯ', 'محبة', 'إفنوتي', 'agathos'].map(x => <button key={x} className="chip coptic-font" onClick={() => setQ(x)}>{x}</button>)}</div>
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
            <summary>المصادر: أسامة ثابت، وكنيسة مارجرجس بنزلة السمان، وCoptic Dictionary Online، ومعوض داود عبد النور</summary>
            قاموس قبطي عربي من إعداد أسامة ثابت (archive.org، ملك عام). وقاموس اللغة القبطية لكنيسة الشهيد العظيم مارجرجس بنزلة السمان (stgeorgesaman.com) بمراجعه: قاموس أبونا أندرياس المقاري، مشروع كيليا، قاموس كروم، ومراجع عربية وإنجليزية مجمعة. المعاني اللي عليها نجمة (*) ترجمة آلية زي ما الموقع كاتب. وأشكال الكلمات في كل اللهجات من Coptic Dictionary Online (coptic-dictionary.org، القاموس القبطي الشامل لأكاديمية برلين ومشروع KELLIA) برخصة CC BY-SA 4.0، والمعنى العربي ليها من الكلمة البحيري في القاموسين اللي فوق، أو مترجم من معناها الإنجليزي (عليه نجمة). وقاموس اللغة القبطية للهجتين البحيرية والصعيدية لمعوض داود عبد النور (المركز الثقافي القبطي، 2013) بإذن، مقروء آليًا من صفحاته المصوّرة. وتحويل الخطوط القبطية القديمة (أڤا شنودة وخطوط Coptic Standard) ليونيكود بجدول الحروف من مشروع E-Sid/Coptic على GitHub (GPL-3.0). والحروف القبطية بالچينكم وشرطة الاختصار بخط Noto Sans Coptic من جوجل (SIL Open Font License 1.1). وآية اليوم من الكتاب المقدس: النص البحيري من Coptic SCRIPTORIUM (CC BY 4.0) وترجمة فاندايك العربية (1865، ملك عام).
          </details>
        )}
      </main>
    </>
  );
}

function Row({ hit: { entry: e, note } }: { hit: Hit }) {
  const tags = [e.kind, e.form, ...(e.dialects ?? [])].filter(Boolean);
  return (
    <div className="li" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 4 }}>
      <div className="row between" style={{ width: '100%', flexWrap: 'wrap', rowGap: 2 }}>
        <span className="row" style={{ gap: 8, minWidth: 0, flexWrap: 'wrap' }}><span className="coptic-font cword" dir="ltr">{e.word}</span>{e.origin && <span className={`tag origin ${e.origin === 'قبطي' ? 'tag-ok' : 'tag-ex'}`}>{e.origin}</span>}</span>
        <span className="muted" dir="ltr" style={{ overflowWrap: 'anywhere', minWidth: 0 }}>{e.latin}</span>
      </div>
      <div className="say">النطق: <b>{arabize(e.word)}</b></div>
      {e.meanings.length > 0 && <b>{e.meanings.join('، ')}</b>}
      {e.forms && e.forms.length > 1 && (
        <div className="muted" style={{ fontSize: 12 }}>في اللهجات: {e.forms.slice(0, 8).map(([f, d], i) => <span key={i}><span className="coptic-font" dir="ltr">{f}</span>{d.length ? ` (${d.join('، ')})` : ''}{i < Math.min(8, e.forms!.length) - 1 ? '، ' : ''}</span>)}</div>
      )}
      {e.examples?.slice(0, 2).map((x, i) => (
        <div key={i} style={{ fontSize: 13 }}><span className="coptic-font" dir="ltr">{x.coptic}</span> <span className="muted">{x.arabic}{x.ref ? ` [${x.ref}]` : ''}</span></div>
      ))}
      {tags.length > 0 && <div className="muted" style={{ fontSize: 12 }}>{tags.join(' • ')}</div>}
      {e.source && <div className="muted" style={{ fontSize: 12 }}>المصدر: {e.source}</div>}
      {e.machineRead && <span className="muted" style={{ fontSize: 12 }}>قراءة آلية من صفحة مصوّرة، ممكن يكون فيها حرف غلط</span>}
      {note && <span className="tag tag-ex">{note.startsWith('«') || !note.includes('=') ? note : `بعد ما شلنا ${note}`}</span>}
    </div>
  );
}
