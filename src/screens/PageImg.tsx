import { useEffect, useState } from 'react';
import { loadPage } from '../firebase/bookPages';

/** A booklet page: a URL hosted with the app, or 'fs:<key>' for a page of an uploaded PDF. */
export default function PageImg({ src, alt }: { src: string; alt: string }) {
  const stored = src.startsWith('fs:');
  const [url, setUrl] = useState<string | undefined>(stored ? undefined : src);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!stored) { setUrl(src); return; }
    let live = true;
    setUrl(undefined);
    loadPage(src.slice(3)).then(u => { if (live) { setUrl(u); setFailed(!u); } }).catch(() => live && setFailed(true));
    return () => { live = false; };
  }, [src, stored]);
  if (url) return <img src={url} alt={alt} loading="lazy" />;
  return <div className="page-wait muted">{failed ? 'الصفحة دي مش متاحة دلوقتي. افتحها وانت متوصل بالنت.' : 'بتحمّل الصفحة…'}</div>;
}
