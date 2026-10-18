import PageImg from './PageImg';

/** A hymn's pages in the school booklet (with the hazzat), shown under its text. */
export default function BookPages({ book }: { book?: { title: string; label: string; pages: string[] } }) {
  if (!book) return null;
  return (
    <details className="card">
      <summary><b>صفحاته في الكتاب</b> <span className="muted">{book.title} • {book.label}</span></summary>
      {book.pages.length > 0
        ? <div className="pages">{book.pages.map((src, i) => <PageImg key={src} src={src} alt={`صفحة ${i + 1}`} />)}</div>
        : <div className="note">الصفحات دي في نسخة الكتاب الورق أو الـ PDF.</div>}
    </details>
  );
}
