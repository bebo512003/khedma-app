import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { applyTheme, loadTheme } from '../theme';
import { useStore } from '../data/store';
import logo from '../logo.png';

/** Top menu on computers. Phones keep the in-screen buttons. */
export default function DeskNav() {
  const { cloud, servant, signOut } = useStore();
  const [theme, setTheme] = useState(loadTheme());
  const toggle = () => { const t = theme === 'light' ? 'maroon' : 'light'; applyTheme(t); setTheme(t); };
  const links: [string, string][] = [['/', 'الرئيسية'], ['/members', 'المخدومين'], ['/library', 'مكتبة الألحان'], ['/books', 'الكتب'], ['/curriculum', 'المنهج'], ['/reports', 'التقارير'], ['/cards', 'كروت QR'], ['/dictionary', 'القاموس']];
  if (servant?.role === 'lead') links.push(['/team', 'الفريق']);
  return (
    <nav className="desknav" aria-label="القايمة">
      <div>
        <div className="row"><img src={logo} alt="" width={36} height={36} /><b>مدرسة الشهيد اسطفانوس</b></div>
        <div className="row" style={{ gap: 4 }}>
          {links.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'}>{label}</NavLink>)}
          <button onClick={toggle} aria-label={theme === 'light' ? 'وضع النبيتي' : 'الوضع الفاتح'}>{theme === 'light' ? '☾' : '☀'}</button>
          {cloud && <button onClick={signOut}>خروج</button>}
        </div>
      </div>
    </nav>
  );
}
