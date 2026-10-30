import verses from '../data/praiseVerses.json';

/** A praise verse that changes every day, the same one for everyone on that day. Shared by servant and member home. */
export default function VerseToday() {
  const d = new Date();
  const day = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
  const [coptic, arabic, ref] = (verses as [string, string, string][])[day % verses.length];
  return (
    <div className="card verse">
      <div className="muted">آية اليوم</div>
      <b className="verse-ar">{arabic}</b>
      <div className="cop coptic-font" lang="cop">{coptic}</div>
      <details className="muted"><summary>({ref})</summary>النص البحيري من Coptic SCRIPTORIUM (CC BY 4.0)، والعربي ترجمة فاندايك (1865، ملك عام).</details>
    </div>
  );
}
