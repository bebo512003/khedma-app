import { useState } from 'react';
import { applyTheme, loadTheme } from '../theme';
import Icon from './Icon';

/** Light ↔ maroon, remembered on this phone. */
export default function ThemeButton() {
  const [theme, setTheme] = useState(loadTheme());
  const toggle = () => { const t = theme === 'light' ? 'maroon' : 'light'; applyTheme(t); setTheme(t); };
  return (
    <button className="icon" onClick={toggle} aria-label={theme === 'light' ? 'وضع النبيتي' : 'الوضع الفاتح'}>
      <Icon name={theme === 'light' ? 'moon' : 'sun'} size={20} />
    </button>
  );
}
