import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAllowedLevel, useData } from '../data/store';
import { CRITERIA, STATUS_LABELS } from '../data/types';
import { currentTerm, hymnsCount, isoDate, sessionsCount } from '../data/logic';
import { buildReport, round1, type MemberRow } from '../data/report';
import { download, xlsxBlob } from '../data/xlsx';

type Period = 'month' | 'last' | 'term';
type Sort = 'name' | 'rate' | 'avg' | 'points';
const monthName = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { month: 'long', year: 'numeric' });

/** Attendance, ratings and hymn progress per level for a month or the term, with Excel export. */
export default function Reports() {
  const [data] = useData();
  const allowed = useAllowedLevel();
  const levels = [...data.levels].sort((a, b) => a.order - b.order).filter(l => allowed(l.id));
  const [levelId, setLevelId] = useState(() => levels.find(l => data.members.some(m => m.levelId === l.id))?.id ?? levels[0]?.id ?? '');
  const [period, setPeriod] = useState<Period>('month');
  const [sort, setSort] = useState<Sort>('name');
  const term = currentTerm(data);
  const level = data.levels.find(l => l.id === levelId);

  const range = useMemo(() => {
    const now = new Date();
    if (period === 'term' && term) return { from: term.start, to: term.end, label: term.name, month: undefined };
    const d = period === 'last' ? new Date(now.getFullYear(), now.getMonth() - 1, 1) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return { from: isoDate(d), to: isoDate(end), label: monthName.format(d), month: isoDate(d).slice(0, 7) };
  }, [period, term]);

  const report = useMemo(() => buildReport(data, levelId, range.from, range.to, term?.id, range.month), [data, levelId, range, term]);
  const rows = [...report.members].sort((a, b) =>
    sort === 'name' ? 0 : sort === 'rate' ? (b.rate ?? -1) - (a.rate ?? -1) : sort === 'avg' ? (b.avg ?? -1) - (a.avg ?? -1) : (b.points ?? 0) - (a.points ?? 0));
  const curriculumSize = report.hymns.length;

  const exportExcel = () => {
    const members = [
      ['الكود', 'الاسم', 'حضر', 'اعتذر', 'غاب', 'نسبة الحضور %', ...CRITERIA.map(c => `متوسط ${c}`), 'متوسط التقييم',
        ...STATUS_LABELS.map(s => `ألحان: ${s}`), 'اتحفظ في الفترة', 'اتقال لوحده في الفترة', ...(range.month ? ['النقط'] : [])],
      ...rows.map(r => [r.member.code, r.member.name, r.present, r.excused, r.absent, r.rate, ...(r.criteria ?? [null, null, null]).map(round1), round1(r.avg),
        ...r.hymns, r.memorized, r.solo, ...(range.month ? [r.points] : [])]),
    ];
    const hymns = [['اللحن', ...STATUS_LABELS], ...report.hymns.map(h => [h.hymn.nameAr, ...h.counts])];
    download(xlsxBlob([
      { name: 'المخدومين', rows: members, widths: [8, 24, 7, 7, 7, 12, 10, 10, 10, 12, 14, 12, 12, 16, 14, 18, 8] },
      { name: 'الألحان', rows: hymns, widths: [28, 12, 12, 12, 14] },
    ]), `تقرير ${level?.name ?? ''} - ${range.label}.xlsx`);
  };

  return (
    <>
      <header className="top gutter">
        <div className="row"><Link to="/" className="icon" aria-label="رجوع">→</Link><div><h1>التقارير</h1><div className="muted">{level?.name} • {range.label}</div></div></div>
        <div className="chips">{levels.map(l => <button key={l.id} className="chip" aria-pressed={levelId === l.id} onClick={() => setLevelId(l.id)}>{l.name}</button>)}</div>
        <div className="seg">
          <button aria-pressed={period === 'month'} onClick={() => setPeriod('month')}>الشهر ده</button>
          <button aria-pressed={period === 'last'} onClick={() => setPeriod('last')}>الشهر اللي فات</button>
          {term && <button aria-pressed={period === 'term'} onClick={() => setPeriod('term')}>الترم</button>}
        </div>
      </header>
      <main className="main gutter wide dash">
        <div className="card span"><div className="stats stats4">
          <div className="stat"><b>{report.sessions}</b><span className="muted">{report.sessions === 1 ? 'حصة' : 'حصص'}</span></div>
          <div className="stat"><b>{report.rate === null ? '–' : `${report.rate}%`}</b><span className="muted">نسبة الحضور</span></div>
          <div className="stat"><b>{report.avg === null ? '–' : round1(report.avg)}</b><span className="muted">متوسط التقييم من 5</span></div>
          <div className="stat"><b>{report.memorized + report.solo}</b><span className="muted">مرة لحن اتحفظ أو اتقال لوحده</span></div>
        </div>
          {report.sessions === 0 && <div className="note">مفيش حصص متسجلة لـ{level?.name} في {range.label}.</div>}
        </div>

        <div className="card span">
          <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
            <h2>المخدومين</h2>
            <div className="chips" style={{ margin: 0 }}>
              {([['name', 'بالاسم'], ['rate', 'بالحضور'], ['avg', 'بالتقييم'], ...(range.month ? [['points', 'بالنقط']] : [])] as [Sort, string][]).map(([k, label]) =>
                <button key={k} className="chip" aria-pressed={sort === k} onClick={() => setSort(k)}>{label}</button>)}
            </div>
          </div>
          <div className="list cols">
            {rows.length === 0 && <div className="li muted">مفيش مخدومين في المستوى ده.</div>}
            {rows.map(r => <Row key={r.member.id} r={r} curriculumSize={curriculumSize} />)}
          </div>
        </div>

        {report.hymns.length > 0 && (
          <div className="card span">
            <h2>ألحان {term?.name}</h2>
            <div className="legend">{STATUS_LABELS.map((s, i) => <span key={s}><i className={`st${i}`} />{s}</span>)}</div>
            <div className="list cols">
              {report.hymns.map(({ hymn, counts }) => {
                const total = counts.reduce((a, b) => a + b, 0) || 1;
                return (
                  <div key={hymn.id} className="li" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                    <div className="row between"><b>{hymn.nameAr}</b><span className="muted">{counts[2] + counts[3]} من {total} حافظينه</span></div>
                    <div className="dist" role="img" aria-label={STATUS_LABELS.map((s, i) => `${s} ${counts[i]}`).join('، ')}>
                      {counts.map((c, i) => c > 0 && <span key={i} className={`st${i}`} style={{ flexGrow: c }}>{c}</span>)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div className="note span">{sessionsCount(report.sessions)} في الفترة دي. التقييم متوسط الحصص اللي اتقيّم فيها المخدوم بس، والألحان حسب حالتها النهارده في منهج {term?.name ?? 'الترم'}.</div>
      </main>
      <div className="bar gutter"><div>
        <button className="btnp grow" onClick={exportExcel} aria-disabled={rows.length === 0}>نزّل التقرير Excel</button>
      </div></div>
    </>
  );
}

function Row({ r, curriculumSize }: { r: MemberRow; curriculumSize: number }) {
  const taken = r.present + r.excused + r.absent;
  return (
    <Link to={`/members/${r.member.id}`} className="li" style={{ alignItems: 'flex-start' }}>
      <span className="av">{r.member.photo ? <img src={r.member.photo} alt="" /> : r.member.name[0]}</span>
      <div className="grow" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <b>{r.member.name}</b>
        <div className="muted">{taken ? `حضر ${r.present} من ${taken}${r.excused ? ` • اعتذر ${r.excused}` : ''}` : 'مفيش حضور متسجل'}
          {r.criteria && ` • ${CRITERIA.map((c, i) => `${c} ${round1(r.criteria![i])}`).join(' • ')}`}</div>
        {curriculumSize > 0 && <div className="muted">حافظ {r.hymns[2] + r.hymns[3]} من {hymnsCount(curriculumSize)}{r.hymns[3] ? `، منهم ${r.hymns[3]} بيقولهم لوحده` : ''}</div>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        {r.rate !== null && <span className={`tag ${r.rate < 50 ? 'tag-alert' : 'tag-ex'}`}>{r.rate}%</span>}
        {r.avg !== null && <span className="tag tag-ex">{round1(r.avg)} / 5</span>}
        {r.points !== null && r.points > 0 && <span className="muted" style={{ fontSize: 12 }}>{r.points} نقطة</span>}
      </div>
    </Link>
  );
}
