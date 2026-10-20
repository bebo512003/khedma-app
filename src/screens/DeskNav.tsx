import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { applyTheme, loadTheme } from '../theme';
import { useStore, useCan, useIsLead } from '../data/store';
import logo from '../logo.png';
import Icon from '../ui/Icon';
import { usePending } from './usePending';
import { useServantNotes } from './servantNotes';

/** Top menu on computers. Phones keep the in-screen buttons. */
export default function DeskNav() {
  const { cloud, servant, signOut } = useStore();
  const canReports = useCan('reports'), canMembers = useCan('members'), lead = useIsLead();
  const [theme, setTheme] = useState(loadTheme());
  const pending = usePending().length;
  const { unread } = useServantNotes();
  const toggle = () => { const t = theme === 'light' ? 'maroon' : 'light'; applyTheme(t); setTheme(t); };
  const links: [string, string][] = [['/', 'الرئيسية'], ['/members', 'المخدومين'], ['/library', 'المكتبة'], ['/books', 'الكتب'], ['/curriculum', 'المنهج'], ['/sessions', 'سجل الحصص'], ['/reviews', 'التسميع'], ['/reports', 'التقارير'], ['/cards', 'كروت QR'], ['/dictionary', 'القاموس'], ['/translate', 'ترجمة جملة']];
  const shown = links.filter(([to]) => (to !== '/reports' || canReports) && (to !== '/cards' || canMembers));
  if (lead) shown.push(['/backup', 'نسخة احتياطية']);
  if (servant) shown.push(['/team', 'الفريق'], ['/notify', 'التنبيهات']);
  return (
    <nav className="desknav" aria-label="القايمة">
      <div>
        <div className="row"><img src={logo} alt="" width={36} height={36} /><b>مدرسة الشهيد اسطفانوس</b></div>
        <div className="row" style={{ gap: 4 }}>
          <button onClick={toggle} aria-label={theme === 'light' ? 'وضع النبيتي' : 'الوضع الفاتح'}><Icon name={theme === 'light' ? 'moon' : 'sun'} size={18} /></button>
          {servant && <NavLink to="/notifications" className="badged" aria-label={unread ? `الإشعارات، ${unread} جديد` : 'الإشعارات'}><Icon name="bell" size={20} />{unread > 0 && <span className="count">{unread > 9 ? '9+' : unread}</span>}</NavLink>}
          {servant && <NavLink to="/profile" className="me" aria-label="بروفايلي">{servant.photo ? <img src={servant.photo} alt="" /> : servant.name[0]}</NavLink>}
          {cloud && <button onClick={signOut}>خروج</button>}
        </div>
        {/* The links get their own line and wrap, so a long menu never pushes the page sideways. */}
        <div className="links">
          {shown.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'} className="badged">{label}{to === '/reviews' && pending > 0 && <span className="count">{pending > 9 ? '9+' : pending}</span>}</NavLink>)}
        </div>
      </div>
    </nav>
  );
}
