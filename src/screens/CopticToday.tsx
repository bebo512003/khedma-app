import { copticDay, formatCoptic } from '../data/coptic';
import { count, formatDay, isoDate } from '../data/logic';

const inDays = (n: number) => n === 1 ? 'بكرة' : `بعد ${count(n, 'يوم', 'يومين', 'أيام')}`;

/** Today's Coptic date, feast, fast and tune, plus what's coming next. Shared by servant and member home. */
export default function CopticToday({ plain = false }: { plain?: boolean }) {
  const t = copticDay();
  const next = t.next;
  return (
    <div className={plain ? 'card coptic' : 'hero coptic'}>
      <div><div className="cdate">{formatCoptic(t.coptic)}</div><div className="sub">{formatDay(isoDate(t.date))}</div></div>
      <div className="cmid">
        {t.feasts.map(f => <div key={f.name} className={`feast ${f.kind}`}>{f.name}</div>)}
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <span className="ctag">{t.tune}</span>
          {t.fast && <span className="ctag">{t.fast}</span>}
        </div>
      </div>
      {next && <div className="sub cnext">الجاي: <b>{next.occasion.name}</b> {inDays(next.days)} ({formatDay(isoDate(next.occasion.start))})</div>}
    </div>
  );
}
