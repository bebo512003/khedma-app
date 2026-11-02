import { useEffect } from 'react';
import { useLocation, useNavigate, useNavigationType, type NavigateFunction } from 'react-router-dom';
import Icon from './Icon';

/**
 * The pages this tab has visited, as the browser's history holds them. Back arrows use it to step back
 * through history when the page they lead to is the one just before; otherwise they replace the current page,
 * so arrows never pile up entries that the phone's own back button would later loop through.
 */
const stack: string[] = [];

export function HistoryTracker() {
  const { pathname } = useLocation();
  const type = useNavigationType();
  useEffect(() => {
    if (type === 'PUSH') stack.push(pathname);
    else if (type === 'REPLACE') { stack.pop(); stack.push(pathname); }
    else {
      // POP: the browser went back (or forward). Back: drop entries until this page is on top.
      const i = stack.lastIndexOf(pathname);
      if (i >= 0) stack.length = i + 1; else { stack.length = 0; stack.push(pathname); }
    }
  }, [pathname, type]);
  return null;
}

/** Where a page's back arrow leads: one level up, never sideways. */
export function parentOf(path: string): string {
  const p = path.replace(/\/+$/, '') || '/';
  const rules: [RegExp, string | ((m: RegExpMatchArray) => string)][] = [
    [/^\/members\/([^/]+)\/edit$/, m => `/members/${m[1]}`],
    [/^\/members\/[^/]+$/, '/members'],
    [/^\/hymns\/([^/]+)\/edit$/, m => m[1] === 'new' ? '/library' : `/hymns/${m[1]}`],
    [/^\/hymns\/[^/]+$/, '/library'],
    [/^\/sessions\/([^/]+)\/edit$/, m => `/summary/${m[1]}`],
    [/^\/summary\/[^/]+$/, '/sessions'],
    [/^\/books\/[^/]+$/, '/books'],
    [/^\/(curriculum|books)$/, '/library'],
    [/^\/month(\/.*)?$/, '/ranking'],
    [/^\/(levels|team|notify|backup|profile)$/, '/settings'],
    [/^\/me\/books\/[^/]+$/, '/me/books'],
    [/^\/me\/profile\/edit$/, '/me/profile'],
    [/^\/me\/.+$/, '/me/home'],
    [/^\/open\/hymn\/[^/]+$/, '/open/library'],
    [/^\/open\/books\/[^/]+$/, '/open/books'],
    [/^\/open\/.+$/, '/'],
  ];
  for (const [re, to] of rules) { const m = p.match(re); if (m) return typeof to === 'string' ? to : to(m); }
  return '/';
}

/** Go to `to`: back through history if it's the page just before, otherwise in place of this page. */
export function goTo(nav: NavigateFunction, to: string) {
  if (stack.length > 1 && stack[stack.length - 2] === to) nav(-1);
  else nav(to, { replace: true });
}

export function useBack(to?: string) {
  const nav = useNavigate();
  const { pathname } = useLocation();
  return () => goTo(nav, to ?? parentOf(pathname));
}

/** The back arrow at the top of a page. */
export function BackButton({ to }: { to?: string }) {
  const back = useBack(to);
  return <button className="icon" onClick={back} aria-label="رجوع"><Icon name="back" size={20} /></button>;
}
