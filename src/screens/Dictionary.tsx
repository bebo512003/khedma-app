import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import '@fontsource/noto-sans-coptic/coptic-400.css';
import { COPTIC_KEYS, loadDictionary, search, scriptOf, type Hit } from '../data/dictionary';
import { count } from '../data/logic';

type Dict = Awaited<ReturnType<typeof loadDictionary>>;

/** Coptic ⇄ Arabic dictionary. Type Coptic (on-screen keyboard), Arabic, or Coptic in Latin letters. */
export default function Dictionary({ back = '/' }: { back?: string }) {
  const [dict, setDict] = useState<Dict | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState('');
  const [keyboard, setKeyboard] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { loadDictionary().then(setDict).catch(() => setFailed(true)); }, []);
  const result = useMemo(() => dict && q.trim() ? search(dict.entries, q.trim()) : null, [dict, q]);
  const type = (ch: string) => setQ(x => x + ch);

  return (
    <>
      <header className="top gutter">
        <div className="row"><Link to={back} className="icon" aria-label="رجوع">→</Link><div><h1>القاموس القبطي</h1>
          <div className="muted">{dict ? `${dict.entries.length.toLocaleString('en')} كلمة • قبطي بحيري` : 'بيحمّل…'}</div></div></div>
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
      <main className="main gutter wide">
        {failed && <div className="card alert"><div className="alert-t">القاموس ما اتحملش</div><div className="note">أول مرة بيحتاج نت عشان يتحمل، وبعدها بيشتغل من غير نت.</div></div>}
        {!q.trim() && dict && (
          <div className="card">
            <b>إزاي تدوّر</b>
            <div className="muted">اكتب الكلمة بالقبطي (دوس على ⲁⲃⲅ للكيبورد القبطي)، أو بالعربي عشان تعرف الكلمة بالقبطي، أو بالحروف الإنجليزي زي pistis أو agathos.</div>
            <div className="muted">لو الكلمة القبطي فيها أداة تعريف أو حرف جر ملزوق زي ⲡⲓⲛⲟⲩϯ، القاموس بيجرب يشيله ويدوّر على الباقي.</div>
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
        {dict && <div className="note span">المصدر: قاموس قبطي عربي من إعداد أسامة ثابت، منشور على archive.org كملك عام.</div>}
      </main>
    </>
  );
}

function Row({ hit: { entry: e, note } }: { hit: Hit }) {
  const tags = [e.kind, e.form, e.origin].filter(Boolean);
  return (
    <div className="li" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 4 }}>
      <div className="row between" style={{ width: '100%' }}>
        <span className="coptic-font cword" dir="ltr">{e.word}</span>
        <span className="muted" dir="ltr">{e.latin}</span>
      </div>
      <b>{e.meanings.join('، ')}</b>
      {tags.length > 0 && <div className="muted" style={{ fontSize: 12 }}>{tags.join(' • ')}</div>}
      {note && <span className="tag tag-ex">بعد ما شلنا {note}</span>}
    </div>
  );
}
