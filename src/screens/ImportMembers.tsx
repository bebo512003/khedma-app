import { useMemo, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../data/store';
import type { Gender, Member } from '../data/types';
import { count, levelForGrade, uid } from '../data/logic';
import { download } from '../data/xlsx';
import {
  FIELD_LABELS, guessColumns, norm, parseDate, parseGender, parseGrade, parsePhone, parseRank, readSheet, templateCsv, type Field,
} from '../data/importSheet';

const FIELDS = Object.keys(FIELD_LABELS) as Field[];

/** Adds many members at once from an Excel/CSV sheet: pick file, check columns and rows, import. */
export default function ImportMembers() {
  const [data, update] = useData();
  const levels = [...data.levels].sort((a, b) => a.order - b.order);
  const [sheet, setSheet] = useState<string[][] | null>(null);
  const [fileName, setFileName] = useState('');
  const [cols, setCols] = useState<Partial<Record<Field, number>>>({});
  const [hasHeader, setHasHeader] = useState(true);
  const [genders, setGenders] = useState<Record<number, Gender>>({});
  const [include, setInclude] = useState<Record<number, boolean>>({});
  const [fallbackLevel, setFallbackLevel] = useState(levels[0]?.id ?? '');
  const [error, setError] = useState('');
  const [done, setDone] = useState(0);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    setError(''); setDone(0); setGenders({}); setInclude({});
    try {
      const rows = (await readSheet(f)).filter(r => r.some(c => c.trim()));
      if (rows.length === 0) { setError('الملف فاضي.'); return; }
      const guess = guessColumns(rows[0]);
      const header = guess.name !== undefined;
      setHasHeader(header);
      setCols(header ? guess : Object.fromEntries(FIELDS.map((f, i) => [f, i])));
      setSheet(rows); setFileName(f.name);
    } catch { setError('مقدرتش أقرا الملف ده. احفظه من Excel بصيغة xlsx أو CSV وجرّب تاني.'); }
  };

  const existing = useMemo(() => new Set(data.members.map(m => norm(m.name))), [data.members]);
  const rows = useMemo(() => {
    if (!sheet) return [];
    const cell = (r: string[], f: Field) => cols[f] === undefined ? '' : (r[cols[f]!] ?? '').trim();
    const seen = new Set<string>();
    return sheet.slice(hasHeader ? 1 : 0).map((r, i) => {
      const name = cell(r, 'name').replace(/\s+/g, ' ');
      const grade = parseGrade(cell(r, 'grade'));
      const gender = genders[i] ?? parseGender(cell(r, 'gender'));
      const levelId = grade && data.levels.some(l => l.id === levelForGrade(grade)) ? levelForGrade(grade) : fallbackLevel;
      const key = norm(name);
      const dup = existing.has(key) ? 'موجود قبل كده' : seen.has(key) ? 'متكرر في الملف' : '';
      seen.add(key);
      const issues = [
        !grade && cell(r, 'grade') ? `السنة "${cell(r, 'grade')}" مش واضحة` : !grade ? 'من غير سنة دراسية' : '',
        cell(r, 'birthdate') && !parseDate(cell(r, 'birthdate')) ? `تاريخ الميلاد "${cell(r, 'birthdate')}" مش واضح` : '',
      ].filter(Boolean);
      return {
        i, name, gender, grade, levelId, dup, issues,
        birthdate: parseDate(cell(r, 'birthdate')) ?? undefined,
        parentPhone: parsePhone(cell(r, 'parentPhone')),
        phone: parsePhone(cell(r, 'phone')),
        rank: gender === 'm' ? parseRank(cell(r, 'rank')) : undefined,
        on: !!name && (include[i] ?? !dup),
      };
    }).filter(r => r.name);
  }, [sheet, cols, hasHeader, genders, include, fallbackLevel, existing, data.levels]);

  const chosen = rows.filter(r => r.on);
  const missingGender = chosen.filter(r => !r.gender).length;

  const run = () => {
    if (missingGender) { setError(`حدد النوع لـ ${count(missingGender, 'مخدوم', 'مخدومين', 'مخدومين')} الأول.`); return; }
    update(d => {
      let next = d.nextCode;
      const added: Member[] = chosen.map(r => {
        const m: Member = { id: uid(), code: String(next++).padStart(4, '0'), name: r.name, gender: r.gender!, levelId: r.levelId, grade: r.grade ?? '' };
        if (r.birthdate) m.birthdate = r.birthdate;
        if (r.parentPhone) m.parentPhone = r.parentPhone;
        if (r.phone) m.phone = r.phone;
        if (r.rank) m.rank = r.rank;
        return m;
      });
      return { ...d, members: [...d.members, ...added], nextCode: next };
    });
    setDone(chosen.length); setSheet(null); setError('');
  };

  const downloadTemplate = () => download(new Blob([templateCsv()], { type: 'text/csv;charset=utf-8' }), 'نموذج المخدومين.csv');

  return (
    <>
      <header className="top gutter"><div className="row">
        <Link to="/members" className="icon" aria-label="رجوع">→</Link><h1>إضافة مخدومين من Excel</h1>
      </div></header>
      <main className="main gutter wide">
        {done > 0 && (
          <div className="card span">
            <h2>✓ اتضاف {count(done, 'مخدوم', 'مخدومين', 'مخدومين')}</h2>
            <div className="muted">كل واحد خد كود جديد. الخطوة الجاية إنك تطبع كروت الـ QR بتاعتهم، والرقم السري تعمله من صفحة كل مخدوم لما تحتاجه.</div>
            <div className="row"><Link to="/members" className="btn grow">المخدومين</Link><Link to="/cards" className="btnp grow">اطبع الكروت</Link></div>
          </div>
        )}

        {!sheet && (
          <div className="card span">
            <h2>١. جهّز الشيت</h2>
            <div className="muted">أول صف فيه أسماء الأعمدة، وكل صف بعده مخدوم. الاسم بس هو الإجباري، والباقي اختياري: النوع (ولد/بنت)، السنة الدراسية (زي "تالتة ابتدائي" أو "3 إعدادي")، تاريخ الميلاد، موبايل ولي الأمر، موبايل المخدوم، الرتبة. لو عندك شيت جاهز بأسماء أعمدة تانية مفيش مشكلة، هتختار كل عمود بيمثل إيه.</div>
            <button className="btn" onClick={downloadTemplate}>نزّل نموذج جاهز</button>
            <h2>٢. ارفع الملف</h2>
            <label className="btnp" style={{ cursor: 'pointer' }}>اختار ملف Excel أو CSV
              <input type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" onChange={onFile} hidden /></label>
            {error && <div className="alert-t" role="alert">{error}</div>}
          </div>
        )}

        {sheet && (<>
          <div className="card">
            <h2>{count(chosen.length, 'مخدوم', 'مخدومين', 'مخدومين')} هيتضافوا</h2>
            <div className="muted">دوس على النوع تغيّره، وعلى المربع تشيل أو ترجّع حد.</div>
            {rows.some(r => !r.grade) && (<div className="field"><span>اللي من غير سنة دراسية واضحة يتحطوا في</span>
              <div className="chips">{levels.map(l => <button key={l.id} className="chip" aria-pressed={fallbackLevel === l.id} onClick={() => setFallbackLevel(l.id)}>{l.name}</button>)}</div></div>)}
            <div className="list">
              {rows.map(r => (
                <div key={r.i} className="li" style={{ opacity: r.on ? 1 : 0.5, alignItems: 'flex-start' }}>
                  <input type="checkbox" aria-label={`ضيف ${r.name}`} checked={r.on} onChange={e => setInclude({ ...include, [r.i]: e.target.checked })} style={{ marginTop: 6 }} />
                  <div className="grow">
                    <b>{r.name}</b>
                    <div className="muted">{data.levels.find(l => l.id === r.levelId)?.name}{r.grade ? ` • ${r.grade}` : ''}{r.rank ? ` • ${r.rank}` : ''}{r.birthdate ? ` • ${r.birthdate.split('-').reverse().join('/')}` : ''}</div>
                    {(r.dup || r.issues.length > 0) && <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
                      {r.dup && <span className="tag tag-alert">{r.dup}</span>}
                      {r.issues.map(x => <span key={x} className="tag tag-ex">{x}</span>)}
                    </div>}
                  </div>
                  <button className={`chip${r.gender ? '' : ' chip-on'}`} aria-pressed={!!r.gender} style={{ minWidth: 64 }}
                    onClick={() => setGenders({ ...genders, [r.i]: r.gender === 'm' ? 'f' : 'm' })}>{r.gender === 'm' ? 'ولد' : r.gender === 'f' ? 'بنت' : 'النوع؟'}</button>
                </div>
              ))}
            </div>
          </div>
          <details className="card" open={cols.name === undefined}>
            <summary><b>الأعمدة</b> <span className="muted">(اتعرفت لوحدها، افتحها لو حاجة جاية غلط)</span></summary>
            <div className="muted">{fileName} • اتأكد إن كل خانة جاية من العمود الصح.</div>
            <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={hasHeader} onChange={e => setHasHeader(e.target.checked)} />أول صف فيه أسماء الأعمدة</label>
            {FIELDS.map(f => (
              <label key={f} className="field" htmlFor={`col-${f}`}><span>{FIELD_LABELS[f]}</span>
                <select id={`col-${f}`} className="input" value={cols[f] ?? ''} onChange={e => setCols({ ...cols, [f]: e.target.value === '' ? undefined : Number(e.target.value) })}>
                  <option value="">مش موجود</option>
                  {(sheet[0] ?? []).map((h, i) => <option key={i} value={i}>{hasHeader ? h || `عمود ${i + 1}` : `عمود ${i + 1}: ${h}`}</option>)}
                </select></label>
            ))}
          </details>
        </>)}
      </main>
      {sheet && <div className="bar gutter"><div>
        {error && <div className="alert-t" role="alert">{error}</div>}
        <button className="btn" onClick={() => { setSheet(null); setError(''); }}>ملف تاني</button>
        <button className="btnp grow" aria-disabled={chosen.length === 0 || missingGender > 0} onClick={() => chosen.length && run()}>
          {missingGender ? `حدد النوع لـ ${missingGender}` : `ضيف ${count(chosen.length, 'مخدوم', 'مخدومين', 'مخدومين')}`}</button>
      </div></div>}
    </>
  );
}
