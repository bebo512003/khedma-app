import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../data/store';
import { applyTheme, loadTheme } from '../theme';
import Icon from '../ui/Icon';
import PushToggle from './PushToggle';
import { useSettingsMenu } from './menu';

/** Everything about the account, the school's setup and the app itself, in one place. */
export default function Settings() {
  const { cloud, servant, signOut } = useStore();
  const groups = useSettingsMenu();
  const [theme, setTheme] = useState(loadTheme());
  const toggle = () => { const t = theme === 'light' ? 'maroon' : 'light'; applyTheme(t); setTheme(t); };

  return (
    <>
      <header className="top gutter"><h1>الإعدادات</h1>
        {servant && <div className="muted">{servant.name} • {servant.role === 'admin' ? 'أدمن' : servant.role === 'lead' ? 'خادم مسؤول' : 'خادم'}</div>}</header>
      <main className="main gutter">
        <div className="card">
          <h2>الشكل</h2>
          <div className="row" style={{ gap: 8 }}>
            <button className={`${theme === 'light' ? 'btnp' : 'btn'} grow`} aria-pressed={theme === 'light'} onClick={() => theme !== 'light' && toggle()}><Icon name="sun" size={18} /> فاتح</button>
            <button className={`${theme === 'maroon' ? 'btnp' : 'btn'} grow`} aria-pressed={theme === 'maroon'} onClick={() => theme !== 'maroon' && toggle()}><Icon name="moon" size={18} /> نبيتي</button>
          </div>
        </div>
        {cloud && <PushToggle who="servant" always />}
        {groups.map(g => (
          <div key={g.title} className="card" style={{ paddingBlock: 4 }}>
            <h2 style={{ marginTop: 10 }}>{g.title}</h2>
            <div className="list">
              {g.items.map(([to, icon, label]) => (
                <Link key={to} to={to} className="li"><Icon name={icon} size={20} /><b className="grow">{label}</b><span className="muted">‹</span></Link>
              ))}
            </div>
          </div>
        ))}
        {cloud && <button className="btn" onClick={signOut}><Icon name="logout" size={18} /> خروج</button>}
      </main>
    </>
  );
}
