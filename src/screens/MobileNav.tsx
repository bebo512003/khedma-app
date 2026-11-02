import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAllowedLevel, useData, useStore, useCan } from '../data/store';
import { useMenu } from './menu';
import Icon from '../ui/Icon';
import { usePending } from './usePending';

/** Main sections get a bottom tab bar on phones; forms and the session keep their own action bar instead. */
const TAB_ROUTES = ['/', '/notifications', '/sessions', '/reviews', '/members', '/library', '/curriculum', '/books', '/reports', '/ranking', '/dictionary', '/translate', '/followup', '/team', '/notify', '/levels', '/backup', '/settings', '/profile'];

export default function MobileNav() {
  const { pathname } = useLocation();
  const [data] = useData();
  const canSessions = useCan('sessions');
  const { servant } = useStore();
  const allowed = useAllowedLevel();
  const nav = useNavigate();
  const [sheet, setSheet] = useState<'more' | 'start' | null>(null);
  const pending = usePending().length;
  // The tab bar already has these.
  const groups = useMenu().map(g => ({ ...g, items: g.items.filter(([to]) => to !== '/members' && to !== '/library') }));
  // Any page change (a link, the back button) closes an open sheet.
  useEffect(() => setSheet(null), [pathname]);
  if (!TAB_ROUTES.includes(pathname)) return null;

  const levels = [...data.levels].sort((a, b) => a.order - b.order).filter(l => allowed(l.id));
  const start = () => levels.length === 1 ? nav(`/session/${levels[0].id}`) : setSheet('start');
  const inMore = !['/', '/members', '/library'].includes(pathname);

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
          <button className={`badged${inMore ? ' active' : ''}`} onClick={() => setSheet('more')}><Icon name="more" />المزيد{pending > 0 && <span className="count">{pending > 9 ? '9+' : pending}</span>}</button>
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
          {groups.map(g => (
            <div key={g.title} className="menu-group">
              <div className="muted menu-t">{g.title}</div>
              <div className="tiles tiles4">
                {g.items.map(([to, icon, label]) => <Link key={to} to={to} className="tile badged" onClick={() => setSheet(null)}><Icon name={icon} />{label}{to === '/reviews' && pending > 0 && <span className="count">{pending > 9 ? '9+' : pending}</span>}</Link>)}
              </div>
            </div>
          ))}
          <Link to="/settings" className="li" onClick={() => setSheet(null)}><Icon name="gear" size={20} /><b className="grow">الإعدادات</b><span className="muted">الشكل، الفريق، النسخة الاحتياطية</span></Link>
        </div>
      )}
    </>
  );
}
