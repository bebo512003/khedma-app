import { NavLink } from 'react-router-dom';
import { useStore } from '../data/store';
import { useMenu } from './menu';
import SyncBadge from '../ui/SyncBadge';
import logo from '../logo.png';
import Icon from '../ui/Icon';
import { usePending } from './usePending';
import { useServantNotes } from './servantNotes';

/** Top menu on computers. Phones keep the in-screen buttons. */
export default function DeskNav() {
  const { servant } = useStore();
  const groups = useMenu();
  const pending = usePending().length;
  const { unread } = useServantNotes();
  return (
    <nav className="desknav" aria-label="القايمة">
      <div>
        <div className="row"><img src={logo} alt="" width={36} height={36} /><b>مدرسة الشهيد اسطفانوس</b></div>
        <div className="row" style={{ gap: 4 }}>
          <SyncBadge />
          <NavLink to="/settings" aria-label="الإعدادات"><Icon name="gear" size={20} /></NavLink>
          {servant && <NavLink to="/notifications" className="badged" aria-label={unread ? `الإشعارات، ${unread} جديد` : 'الإشعارات'}><Icon name="bell" size={20} />{unread > 0 && <span className="count">{unread > 9 ? '9+' : unread}</span>}</NavLink>}
          {servant && <NavLink to="/profile" className="me" aria-label="بروفايلي">{servant.photo ? <img src={servant.photo} alt="" /> : servant.name[0]}</NavLink>}
        </div>
        {/* The links get their own line and wrap, so a long menu never pushes the page sideways. */}
        <div className="links">
          <NavLink to="/" end>الرئيسية</NavLink>
          {groups.map(g => (
            <span key={g.title} className="grp" role="group" aria-label={g.title}>
              {g.items.map(([to, , label]) => <NavLink key={to} to={to} className="badged">{label}{to === '/reviews' && pending > 0 && <span className="count">{pending > 9 ? '9+' : pending}</span>}</NavLink>)}
            </span>
          ))}
        </div>
      </div>
    </nav>
  );
}
