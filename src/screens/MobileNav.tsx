import { useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAllowedLevel, useData, useIsLead, useStore, useCan } from '../data/store';
import { applyTheme, loadTheme } from '../theme';
import Icon from '../ui/Icon';

/** Main sections get a bottom tab bar on phones; forms and the session keep their own action bar instead. */
const TAB_ROUTES = ['/', '/sessions', '/reviews', '/members', '/library', '/curriculum', '/books', '/reports', '/dictionary', '/translate', '/followup', '/team', '/notify', '/levels', '/backup'];

export default function MobileNav() {
  const { pathname } = useLocation();
  const [data] = useData();
  const canSessions = useCan('sessions'), canReports = useCan('reports'), canMembers = useCan('members');
  const { cloud, servant, signOut } = useStore();
  const allowed = useAllowedLevel();
  const lead = useIsLead();
  const nav = useNavigate();
  const [sheet, setSheet] = useState<'more' | 'start' | null>(null);
  const [theme, setTheme] = useState(loadTheme());
  if (!TAB_ROUTES.includes(pathname)) return null;

  const levels = [...data.levels].sort((a, b) => a.order - b.order).filter(l => allowed(l.id));
  const start = () => levels.length === 1 ? nav(`/session/${levels[0].id}`) : setSheet('start');
  const toggleTheme = () => { const t = theme === 'light' ? 'maroon' : 'light'; applyTheme(t); setTheme(t); };
  const more: [string, string, string][] = [
    ['/sessions', 'clock', 'سجل الحصص'], ['/reviews', 'mic', 'التسميع'], ['/curriculum', 'list', 'المنهج'], ['/books', 'books', 'الكتب'], ['/reports', 'chart', 'التقارير'],
    ['/followup', 'heart', 'الافتقاد'], ['/dictionary', 'dict', 'القاموس'], ['/translate', 'dict', 'ترجمة جملة'], ['/cards', 'qr', 'كروت QR'],
    ...(cloud ? [['/team', 'team', 'الفريق'], ['/notify', 'bell', 'التنبيهات'], ['/profile', 'user', 'بروفايلي']] as [string, string, string][] : []),
    ...(lead ? [['/levels', 'layers', 'المستويات'], ['/backup', 'download', 'نسخة احتياطية']] as [string, string, string][] : []),
  ];
  const shown = more.filter(([to]) => (to !== '/reports' || canReports) && (to !== '/cards' || canMembers));
  const inMore = more.some(([to]) => to === pathname);

  return (
    <>
      <nav className="mtabs mobile-only" aria-label="القايمة">
        <div>
          <NavLink to="/" end><Icon name="home" />الرئيسية</NavLink>
          <NavLink to="/members"><Icon name="people" />المخدومين</NavLink>
          {canSessions
            ? <button className="fab" onClick={start} aria-label="ابدأ حصة"><Icon name="play" size={20} />ابدأ حصة</button>
            : <NavLink to="/sessions"><Icon name="clock" />الحصص</NavLink>}
          <NavLink to="/library"><Icon name="book" />المكتبة</NavLink>
          <button className={inMore ? 'active' : ''} onClick={() => setSheet('more')}><Icon name="more" />المزيد</button>
        </div>
      </nav>
      {sheet && <div className="backdrop" onClick={() => setSheet(null)} />}
      {sheet === 'start' && (
        <div className="sheet" role="dialog" aria-label="ابدأ حصة">
          <div className="row between"><h2>ابدأ حصة لـ</h2><button className="icon" onClick={() => setSheet(null)} aria-label="اقفل"><Icon name="close" size={18} /></button></div>
          <div className="list">
            {levels.map(l => (
              <Link key={l.id} to={`/session/${l.id}`} className="li">
                <div className="grow"><b>{l.name}</b><div className="muted">{l.grades} • {data.members.filter(m => m.levelId === l.id).length} مخدوم</div></div>
                <span className="btnp" style={{ minHeight: 40 }}>ابدأ</span>
              </Link>
            ))}
          </div>
        </div>
      )}
      {sheet === 'more' && (
        <div className="sheet" role="dialog" aria-label="المزيد">
          <div className="row between">
            <div className="row">{servant && <span className="av">{servant.photo ? <img src={servant.photo} alt="" /> : servant.name[0]}</span>}<b>{servant?.name ?? 'المزيد'}</b></div>
            <button className="icon" onClick={() => setSheet(null)} aria-label="اقفل"><Icon name="close" size={18} /></button>
          </div>
          <div className="tiles">
            {shown.map(([to, icon, label]) => <Link key={to} to={to} className="tile" onClick={() => setSheet(null)}><Icon name={icon} />{label}</Link>)}
            <button className="tile" onClick={toggleTheme}><Icon name={theme === 'light' ? 'moon' : 'sun'} />{theme === 'light' ? 'وضع النبيتي' : 'الوضع الفاتح'}</button>
            {cloud && <button className="tile" onClick={signOut}><Icon name="logout" />خروج</button>}
          </div>
        </div>
      )}
    </>
  );
}
