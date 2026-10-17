export type ThemeName = 'light' | 'maroon';
const KEY = 'khedma.theme';

export function loadTheme(): ThemeName {
  try { return localStorage.getItem(KEY) === 'maroon' ? 'maroon' : 'light'; } catch { return 'light'; }
}

export function applyTheme(t: ThemeName) {
  document.documentElement.setAttribute('data-theme', t);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'maroon' ? '#3A0F10' : '#FAF6EF');
  try { localStorage.setItem(KEY, t); } catch { /* ignore */ }
}
