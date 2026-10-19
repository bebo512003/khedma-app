import { Link } from 'react-router-dom';
import { useData, useIsLead } from '../data/store';
import { STATUS_LABELS, CRITERIA } from '../data/types';
import { formatTime, sessionRecordings, todayISO } from '../data/logic';
import { download, xlsxBlob } from '../data/xlsx';

const ATT = { p: 'حضر', e: 'اعتذر', a: 'غاب' } as const;

/** Everything the school has entered, as an Excel file people can open, plus a full copy for safekeeping. */
export default function Backup() {
  const [data] = useData();
  const lead = useIsLead();
  if (!lead) return <main className="main gutter"><div className="card">النسخة الاحتياطية للخادم المسؤول والأدمن. <Link to="/">ارجع</Link></div></main>;

  const level = (id?: string) => data.levels.find(l => l.id === id)?.name ?? '';
  const term = (id?: string) => data.terms.find(t => t.id === id)?.name ?? '';
  const hymn = (id?: string) => data.hymns.find(h => h.id === id)?.nameAr ?? '';
  const member = (id: string) => data.members.find(m => m.id === id);
  const sessions = [...data.sessions].sort((a, b) => a.date.localeCompare(b.date));

  const excel = () => download(xlsxBlob([
    { name: 'المخدومين', widths: [8, 24, 7, 12, 16, 14, 12, 14, 14, 30], rows: [
      ['الكود', 'الاسم', 'النوع', 'المستوى', 'السنة الدراسية', 'تاريخ الميلاد', 'الرتبة', 'موبايله', 'موبايل ولي الأمر', 'العنوان'],
      ...data.members.map(m => [m.code, m.name, m.gender === 'f' ? 'أنثى' : 'ذكر', level(m.levelId), m.grade, m.birthdate, m.rank, m.phone, m.parentPhone, m.address]),
    ] },
    { name: 'الحصص', widths: [12, 12, 16, 22, 8, 8, 8, 10, 40, 10], rows: [
      ['التاريخ', 'المستوى', 'الترم', 'لحن الحصة', 'حضر', 'اعتذر', 'غاب', 'البداية', 'الملخص', 'تسجيلات'],
      ...sessions.map(s => {
        const v = Object.values(s.attendance);
        return [s.date, level(s.levelId), term(s.termId), hymn(s.hymnIds[0]), v.filter(x => x === 'p').length, v.filter(x => x === 'e').length, v.filter(x => x === 'a').length,
          s.startedAt ? formatTime(s.startedAt) : '', s.summary, sessionRecordings(s).length || ''];
      }),
    ] },
    { name: 'الحضور والتقييم', widths: [12, 12, 8, 22, 8, 10, ...CRITERIA.map(() => 7), 30], rows: [
      ['التاريخ', 'المستوى', 'الكود', 'الاسم', 'الحالة', 'وصل', ...CRITERIA, 'ملاحظة'],
      ...sessions.flatMap(s => Object.entries(s.attendance).map(([id, a]) => {
        const m = member(id);
        return [s.date, level(s.levelId), m?.code, m?.name ?? 'اتمسح', ATT[a], s.arrivals?.[id] ? formatTime(s.arrivals[id]) : '', ...(s.ratings[id] ?? [null, null, null]), s.notes?.[id]];
      })),
    ] },
    { name: 'مستوى الألحان', widths: [8, 22, 28, 14], rows: [
      ['الكود', 'الاسم', 'اللحن', 'المستوى'],
      ...Object.entries(data.progress).flatMap(([id, p]) => Object.entries(p).filter(([, s]) => s > 0).map(([h, s]) => [member(id)?.code, member(id)?.name, hymn(h), STATUS_LABELS[s]])),
    ] },
    { name: 'المكتبة', widths: [28, 22, 16, 30, 30], rows: [
      ['اللحن', 'بالقبطي', 'الصلاة', 'بيتقال إمتى', 'التسجيل'],
      ...data.hymns.map(h => [h.nameAr, h.nameCoptic, h.prayer, h.when, h.audioUrl]),
    ] },
    { name: 'المنهج', widths: [18, 12, 6, 28], rows: [
      ['الترم', 'المستوى', 'الترتيب', 'اللحن'],
      ...Object.entries(data.curricula).flatMap(([k, ids]) => { const [t, l] = k.split(':'); return ids.map((id, i) => [term(t), level(l), i + 1, hymn(id)]); }),
    ] },
  ]), `نسخة احتياطية ${todayISO()}.xlsx`);

  // Everything, as the app keeps it (recordings and book pages stay online; they're too big for this file).
  const full = () => download(new Blob([JSON.stringify(data)], { type: 'application/json' }), `نسخة كاملة ${todayISO()}.json`);

  return (
    <>
      <header className="top gutter"><div className="row">
        <Link to="/" className="icon" aria-label="رجوع">→</Link><h1>نسخة احتياطية</h1>
      </div></header>
      <main className="main gutter">
        <div className="card">
          <h2>ملف Excel</h2>
          <div className="note">المخدومين وبياناتهم، كل الحصص، الحضور والتقييم ومواعيد الوصول، مستوى كل مخدوم في كل لحن، المكتبة والمنهج. كل ده في ملف واحد تقدر تفتحه وتطبعه.</div>
          <div className="muted">{data.members.length} مخدوم • {data.sessions.length} حصة • {data.hymns.length} لحن</div>
          <button className="btnp" onClick={excel}>نزّل ملف Excel</button>
        </div>
        <div className="card">
          <h2>نسخة كاملة</h2>
          <div className="note">ملف فيه كل حاجة زي ما التطبيق شايلها، عشان لو احتجنا نرجّع البيانات. احفظه في مكان أمين (فيه أرقام موبايلات وعناوين). التسجيلات الصوتية وصفحات الكتب مش فيه لأنها كبيرة، وهي متخزنة أونلاين.</div>
          <button className="btn" onClick={full}>نزّل النسخة الكاملة</button>
        </div>
        <div className="note">نصيحة: نزّل نسخة كل شهر، أو قبل أي تغيير كبير زي بداية ترم جديد.</div>
      </main>
    </>
  );
}
