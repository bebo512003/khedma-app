import { copticDay, formatCoptic } from '../data/coptic';
import { useEffect, useState } from 'react';
import { count, formatDay, isoDate } from '../data/logic';
import { firebaseConfig, useEmulator } from '../firebase/config';

type Synax = { date: string; titles: string[]; url: string };
const SYNAX_KEY = 'khedma.synaxarium';
const SYNAX_PAGE = 'https://st-takla.org/zJ/index.php/ar-synaxarium';

/** Today's synaxarium titles, which the scheduled job copies once a day; read without signing in, kept for the day. */
function useSynaxarium(today: string) {
  const [s, setS] = useState<Synax | null>(() => { try { const c = JSON.parse(localStorage.getItem(SYNAX_KEY) ?? 'null'); return c?.date === today ? c : null; } catch { return null; } });
  useEffect(() => {
    if (s?.date === today || useEmulator || !firebaseConfig) return;
    fetch(`https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/public/synaxarium`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        const f = d?.fields;
        if (!f || f.date?.stringValue !== today) return;
        const next = { date: today, url: f.url?.stringValue ?? SYNAX_PAGE, titles: (f.titles?.arrayValue?.values ?? []).map((v: { stringValue?: string }) => v.stringValue ?? '').filter(Boolean) };
        setS(next);
        try { localStorage.setItem(SYNAX_KEY, JSON.stringify(next)); } catch { /* private mode */ }
      })
      .catch(() => undefined);
  }, [today, s]);
  return s;
}

const inDays = (n: number) => n === 1 ? 'بكرة' : `بعد ${count(n, 'يوم', 'يومين', 'أيام')}`;

/** Today's Coptic date, feast, fast and tune, plus what's coming next. Shared by servant and member home. */
export default function CopticToday({ plain = false }: { plain?: boolean }) {
  const t = copticDay();
  const next = t.next;
  const synax = useSynaxarium(isoDate(t.date));
  return (
    <div className={plain ? 'card coptic' : 'hero coptic'}>
      <div><div className="cdate">{formatCoptic(t.coptic)}</div><div className="sub">{formatDay(isoDate(t.date))}</div></div>
      <div className="cmid">
        {t.feasts.map(f => <div key={f.name} className={`feast ${f.kind}`}>{f.name}</div>)}
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <span className="ctag">{t.tune}</span>
          {t.fast && <span className="ctag">{t.fast}</span>}
        </div>
        <div className="sub csynax">
          <b>السنكسار</b>
          {/* One remembrance per line, then the link to read them in full. */}
          {(synax?.titles.length ? synax.titles : ['تذكارات النهارده']).map(t => <div key={t}>• {t}</div>)}
          <a href={synax?.url ?? SYNAX_PAGE} target="_blank" rel="noopener">اقرا السيرة ↗</a>
        </div>
      </div>
      {next && <div className="sub cnext">الجاي: <b>{next.occasion.name}</b> {inDays(next.days)} ({formatDay(isoDate(next.occasion.start))})</div>}
    </div>
  );
}
