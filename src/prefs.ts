/** This device's own choices: the page the servant app opens on and the text size. Kept in this browser only. */
const START = 'khedma.start', SIZE = 'khedma.textSize';

export const START_PAGES: [string, string][] = [['/', 'الرئيسية'], ['/members', 'المخدومين'], ['/sessions', 'سجل الحصص'], ['/library', 'المكتبة'], ['/ranking', 'الترتيب']];
export const TEXT_SIZES: [number, string][] = [[1, 'عادي'], [1.1, 'كبير'], [1.2, 'أكبر']];

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } };

export const loadStart = () => read(START) ?? '/';
export const saveStart = (to: string) => write(START, to);

export const loadSize = () => Number(read(SIZE)) || 1;
export function applySize(z: number) {
  document.documentElement.style.setProperty('zoom', z === 1 ? '' : String(z));
  write(SIZE, String(z));
}

/** On opening the app at its front door, a servant who chose another start page goes there. */
export function openStartPage() {
  const start = loadStart();
  if (start !== '/' && (location.hash === '' || location.hash === '#' || location.hash === '#/')) location.replace(`#${start}`);
}
