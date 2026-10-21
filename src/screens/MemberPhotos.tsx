import { useMemo, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAllowedLevel, useData } from '../data/store';
import { count } from '../data/logic';

const photos = (n: number) => n === 1 ? 'صورة واحدة' : count(n, 'صورة', 'صورتين', 'صور');
import { matchName } from '../data/matchName';
import { cropSquare } from '../ui/Cropper';
import { cancelled } from '../data/photo';

const OUT = 256;

/** A square from the middle, a bit high on a tall photo where the face usually is, as a small JPEG. */
async function autoSquare(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2, sy = (img.naturalHeight - side) * 0.3;
    const c = document.createElement('canvas'); c.width = OUT; c.height = OUT;
    c.getContext('2d')!.drawImage(img, sx, sy, side, side, 0, 0, OUT, OUT);
    return c.toDataURL('image/jpeg', 0.75);
  } finally { URL.revokeObjectURL(url); }
}

interface Row { file: File; photo: string; memberId: string; on: boolean }

/** Many photos at once: each file named after its member goes to that member's profile. */
export default function MemberPhotos() {
  const [data, update] = useData();
  const allowed = useAllowedLevel();
  const members = useMemo(() => data.members.filter(m => !m.example && allowed(m.levelId)).sort((a, b) => a.name.localeCompare(b.name, 'ar')), [data.members, allowed]);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(0);

  const onFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])].filter(f => f.type.startsWith('image/') || /\.(jpe?g|png|webp|heic)$/i.test(f.name));
    e.target.value = '';
    if (!files.length) return;
    setBusy(true); setError(''); setDone(0);
    const out: Row[] = [];
    let bad = 0;
    for (const file of files) {
      try {
        const photo = await autoSquare(file);
        const m = matchName(file.name, members);
        out.push({ file, photo, memberId: m?.id ?? '', on: !!m });
      } catch { bad++; }
    }
    setBusy(false);
    setRows(out);
    if (bad) setError(`${photos(bad)} مش هتنفع (نوعها مش مدعوم)، جرّب تحوّلها JPG.`);
  };

  const set = (i: number, p: Partial<Row>) => setRows(r => r && r.map((x, j) => j === i ? { ...x, ...p } : x));
  const recrop = async (i: number) => {
    try { set(i, { photo: await cropSquare(rows![i].file) }); } catch (e) { if (!cancelled(e)) setError('الصورة دي مش هتنفع.'); }
  };

  const chosen = (rows ?? []).filter(r => r.on && r.memberId);
  const twice = new Set(chosen.map(r => r.memberId).filter((id, i, a) => a.indexOf(id) !== i));
  const save = () => {
    if (twice.size) { setError('فيه مخدوم متختارله أكتر من صورة، سيب واحدة بس.'); return; }
    const byMember = new Map(chosen.map(r => [r.memberId, r.photo]));
    update(d => ({ ...d, members: d.members.map(m => byMember.has(m.id) ? { ...m, photo: byMember.get(m.id) } : m) }));
    setDone(byMember.size); setRows(null); setError('');
  };
  const name = (id: string) => members.find(m => m.id === id);

  return (
    <>
      <header className="top gutter"><div className="row">
        <Link to="/members" className="icon" aria-label="رجوع">→</Link><h1>صور المخدومين</h1>
      </div></header>
      <main className="main gutter wide">
        {done > 0 && <div className="card span"><h2>✓ اتحطت {photos(done)}</h2><Link to="/members" className="btn">المخدومين</Link></div>}
        {!rows && (
          <div className="card span">
            <div className="muted">اختار صور المخدومين كلها مرة واحدة. لو اسم الصورة هو اسم المخدوم (زي «مينا عيسى.jpg») هتتوصل بيه لوحدها، والباقي تختارله صاحبه بإيدك.</div>
            <label className="btnp" style={{ cursor: 'pointer' }} aria-disabled={busy}>{busy ? 'بجهّز الصور…' : 'اختار الصور'}
              <input type="file" accept="image/*" multiple onChange={onFiles} hidden disabled={busy} /></label>
            {error && <div className="alert-t" role="alert">{error}</div>}
          </div>
        )}
        {rows && (
          <div className="card span">
            <h2>{photos(chosen.length)} هتتحط من {rows.length}</h2>
            <div className="muted">دوس على الصورة تقصّها من جديد. اللي مالهاش صاحب اختارله من القايمة، أو شيل علامتها.</div>
            <div className="list">
              {rows.map((r, i) => {
                const m = name(r.memberId);
                return (
                  <div key={i} className="li" style={{ opacity: r.on ? 1 : 0.5 }}>
                    <input type="checkbox" aria-label={`حط ${r.file.name}`} checked={r.on} onChange={e => set(i, { on: e.target.checked })} />
                    <button className="av" style={{ width: 56, height: 56, borderRadius: 14, padding: 0, border: 0 }} onClick={() => recrop(i)} aria-label="قص الصورة"><img src={r.photo} alt="" /></button>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <select className="input" aria-label="صاحب الصورة" value={r.memberId} onChange={e => set(i, { memberId: e.target.value, on: !!e.target.value })}>
                        <option value="">مين ده؟</option>
                        {members.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </select>
                      <div className="muted" style={{ fontSize: 12, overflowWrap: 'anywhere' }}>{r.file.name}</div>
                      <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
                        {m?.photo && r.on && <span className="tag tag-ex">هتبدّل صورته القديمة</span>}
                        {twice.has(r.memberId) && <span className="tag tag-alert">متختار لأكتر من صورة</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
      {rows && <div className="bar gutter"><div>
        {error && <div className="alert-t" role="alert">{error}</div>}
        <button className="btn" onClick={() => { setRows(null); setError(''); }}>صور تانية</button>
        <button className="btnp grow" aria-disabled={!chosen.length} onClick={() => chosen.length && save()}>حط {photos(chosen.length)}</button>
      </div></div>}
    </>
  );
}
