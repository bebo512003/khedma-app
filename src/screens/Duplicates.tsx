import { useData } from '../data/store';
import { duplicateGroups, mergeDuplicates } from '../data/dedupe';

/** Shown when the library has the same hymn more than once; one tap keeps a single copy everywhere. */
export default function Duplicates() {
  const [data, update] = useData();
  const groups = duplicateGroups(data);
  if (!groups.length) return null;
  return (
    <div className="card alert span">
      <div className="alert-t">فيه {groups.length === 1 ? 'لحن متسجل' : `${groups.length} ألحان متسجلة`} أكتر من مرة</div>
      <div className="note">{groups.map(g => `${g[0].nameAr} (${g.length} نسخ)`).join('، ')}</div>
      <div className="note">الدمج بيسيب نسخة واحدة من كل لحن، والمنهج والكتب ومستوى المخدومين والحصص اللي فاتت بيتنقلوا عليها.</div>
      <button className="btnp" onClick={() => update(d => mergeDuplicates(d))}>ادمجهم في نسخة واحدة</button>
    </div>
  );
}
