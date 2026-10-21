import { useMemo, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAllowedLevel, useData } from '../data/store';
import { coder } from '../data/codes';
import { matchName } from '../data/matchName';
import type { Gender, Member } from '../data/types';
import { count, levelForGrade, MONTHS, uid } from '../data/logic';
import { download, xlsxBlob } from '../data/xlsx';
import {
  FIELD_LABELS, guessColumns, norm, parseDate, parseGender, parseMonth, parseGrade, parsePhone, parseRank, readSheet, templateRows, type Field,
} from '../data/importSheet';

const FIELDS = Object.keys(FIELD_LABELS) as Field[];
const people = (n: number) => count(n, 'مخدوم', 'مخدومين', 'مخدومين');

/** Adds many members at once from an Excel/CSV sheet: pick file, check columns and rows, import. */
export default function ImportMembers() {
  const [data, update] = useData();
  const allowed = useAllowedLevel();
  // Only into the levels this servant serves.
  const levels = [...data.levels].filter(l => allowed(l.id)).sort((a, b) => a.order - b.order);
  const [sheet, setSheet] = useState<string[][] | null>(null);
  const [fileName, setFileName] = useState('');
  const [cols, setCols] = useState<Partial<Record<Field, number>>>({});
  const [hasHeader, setHasHeader] = useState(true);
  const [genders, setGenders] = useState<Record<number, Gender>>({});
  const [include, setInclude] = useState<Record<number, boolean>>({});
  const [fallbackLevel, setFallbackLevel] = useState(levels[0]?.id ?? '');
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ added: number; updated: number } | null>(null);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    setError(''); setDone(null); setGenders({}); setInclude({});
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

  // Members already in the app: a row with their name updates them instead of adding them again.
  const mine = useMemo(() => data.members.filter(m => !m.example && allowed(m.levelId)), [data.members, allowed]);
  const rows = useMemo(() => {
    if (!sheet) return [];
    const cell = (r: string[], f: Field) => cols[f] === undefined ? '' : (r[cols[f]!] ?? '').trim();
    const seen = new Set<string>();
    return sheet.slice(hasHeader ? 1 : 0).map((r, i) => {
      const name = cell(r, 'name').replace(/\s+/g, ' ');
      const grade = parseGrade(cell(r, 'grade'));
      const match = name ? matchName(name, mine) : undefined;
      const gender = genders[i] ?? parseGender(cell(r, 'gender')) ?? match?.gender ?? null;
      const named = levels.find(l => norm(l.name) === norm(cell(r, 'level')))?.id;
      const levelId = named ?? (grade && levels.some(l => l.id === levelForGrade(grade)) ? levelForGrade(grade) : match?.levelId ?? fallbackLevel);
      const key = match?.id ?? norm(name);
      const dup = seen.has(key) ? 'متكرر في الملف' : '';
      seen.add(key);
      const issues = [
        !grade && cell(r, 'grade') ? `السنة "${cell(r, 'grade')}" مش واضحة` : !grade && !named ? 'من غير سنة دراسية' : '',
        ...(['phone', 'parentPhone'] as const).map(f => { const p = parsePhone(cell(r, f)); return p && !/^01[0125]\d{8}$/.test(p) ? `${FIELD_LABELS[f]} "${cell(r, f)}" مش 11 رقم` : ''; }),
        cell(r, 'birthdate') && !parseDate(cell(r, 'birthdate')) ? `تاريخ الميلاد "${cell(r, 'birthdate')}" مش واضح` : '',
      ].filter(Boolean);
      return {
        i, name, gender, grade, levelId, dup, issues, match, named,
        birthdate: parseDate(cell(r, 'birthdate')) ?? undefined,
        birthMonth: parseMonth(cell(r, 'birthMonth')),
        parentPhone: parsePhone(cell(r, 'parentPhone')),
        phone: parsePhone(cell(r, 'phone')),
        rank: gender === 'm' ? parseRank(cell(r, 'rank')) : undefined,
        on: !!name && (include[i] ?? !dup),
      };
    }).filter(r => r.name);
  }, [sheet, cols, hasHeader, genders, include, fallbackLevel, mine, levels]);

  const chosen = rows.filter(r => r.on);
  const missingGender = chosen.filter(r => !r.gender).length;
  const olds = chosen.filter(r => r.match).length, news = chosen.length - olds;

  const run = () => {
    if (missingGender) { setError(`حدد النوع لـ ${count(missingGender, 'مخدوم', 'مخدومين', 'مخدومين')} الأول.`); return; }
    update(d => {
      const code = coder(d);
      // Known members: what the sheet has replaces what they had, the rest stays. A fuller name in the sheet wins.
      const updates = new Map(chosen.filter(r => r.match).map(r => [r.match!.id, r]));
      const words = (s: string) => norm(s).split(' ');
      const members = d.members.map(m => {
        const r = updates.get(m.id); if (!r) return m;
        const u: Member = { ...m, gender: r.gender!, levelId: r.levelId };
        if (words(m.name).every(w => words(r.name).includes(w)) && words(r.name).length > words(m.name).length) u.name = r.name;
        if (r.grade) u.grade = r.grade;
        if (r.birthdate) { u.birthdate = r.birthdate; delete u.birthMonth; } else if (r.birthMonth && !m.birthdate) u.birthMonth = r.birthMonth;
        if (r.parentPhone) u.parentPhone = r.parentPhone;
        if (r.phone) u.phone = r.phone;
        if (r.rank) u.rank = r.rank;
        if (u.gender === 'f') delete u.rank;
        return u;
      });
      const added: Member[] = chosen.filter(r => !r.match).map(r => {
        const m: Member = { id: uid(), code: code(r.levelId), name: r.name, gender: r.gender!, levelId: r.levelId, grade: r.grade ?? '' };
        if (r.birthdate) m.birthdate = r.birthdate;
        else if (r.birthMonth) m.birthMonth = r.birthMonth;
        if (r.parentPhone) m.parentPhone = r.parentPhone;
        if (r.phone) m.phone = r.phone;
        if (r.rank) m.rank = r.rank;
        return m;
      });
      return { ...d, members: [...members, ...added], nextCode: d.nextCode + added.length };
    });
    setDone({ added: chosen.filter(r => !r.match).length, updated: chosen.filter(r => r.match).length }); setSheet(null); setError('');
  };

  const downloadTemplate = () => download(xlsxBlob([{ name: 'المخدومين', widths: [22, 8, 16, 14, 16, 18, 14], rows: templateRows() }]), 'نموذج المخدومين.xlsx');

  return (
    <>
      <header className="top gutter"><div className="row">
        <Link to="/members" className="icon" aria-label="رجوع">→</Link><h1>إضافة مخدومين من Excel</h1>
      </div></header>
      <main className="main gutter wide">
        {done && (
          <div className="card span">
            <h2>✓ {[done.added && `اتضاف ${people(done.added)}`, done.updated && `اتحدّثت بيانات ${people(done.updated)}`].filter(Boolean).join(' و')}</h2>
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
            <h2>{[news && `${people(news)} هيتضافوا`, olds && `${people(olds)} موجودين هتتحدّث بياناتهم`].filter(Boolean).join(' و') || 'مفيش حد متختار'}</h2>
            <div className="muted">دوس على النوع تغيّره، وعلى المربع تشيل أو ترجّع حد.</div>
            {rows.some(r => !r.grade && !r.named && !r.match) && (<div className="field"><span>اللي من غير سنة دراسية واضحة يتحطوا في</span>
              <div className="chips">{levels.map(l => <button key={l.id} className="chip" aria-pressed={fallbackLevel === l.id} onClick={() => setFallbackLevel(l.id)}>{l.name}</button>)}</div></div>)}
            <div className="list">
              {rows.map(r => (
                <div key={r.i} className="li" style={{ opacity: r.on ? 1 : 0.5, alignItems: 'flex-start' }}>
                  <input type="checkbox" aria-label={`ضيف ${r.name}`} checked={r.on} onChange={e => setInclude({ ...include, [r.i]: e.target.checked })} style={{ marginTop: 6 }} />
                  <div className="grow">
                    <b>{r.name}</b>
                    <div className="muted">{data.levels.find(l => l.id === r.levelId)?.name}{r.grade ? ` • ${r.grade}` : ''}{r.rank ? ` • ${r.rank}` : ''}{r.birthdate ? ` • ${r.birthdate.split('-').reverse().join('/')}` : r.birthMonth ? ` • مولود في ${MONTHS[r.birthMonth - 1]}` : ''}</div>
                    {(r.match || r.dup || r.issues.length > 0) && <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
                      {r.match && <span className="tag tag-ex">موجود{norm(r.match.name) !== norm(r.name) ? ` باسم «${r.match.name}»` : ''}، هتتحدّث بياناته</span>}
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
          {missingGender ? `حدد النوع لـ ${missingGender}` : news ? `ضيف ${people(news)}${olds ? ` وحدّث ${olds}` : ''}` : `حدّث ${people(olds)}`}</button>
      </div></div>}
    </>
  );
}
