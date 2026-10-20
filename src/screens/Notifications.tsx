import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../data/store';
import PushToggle from './PushToggle';
import Icon from '../ui/Icon';
import { useServantNotes } from './servantNotes';

/** The servant's bell: every alert in one list, urgent ones first. Opening it clears the counter. */
export default function ServantNotifications() {
  const { notes, seen, markSeen } = useServantNotes();
  const { cloud } = useStore();
  const nav = useNavigate();
  // Keep what was new when the screen opened highlighted while the servant reads it.
  const [before] = useState(seen);
  useEffect(() => { markSeen(); }, [notes.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const list = [...notes].sort((a, b) => Number(!!b.urgent) - Number(!!a.urgent));

  return (
    <>
      <header className="top gutter"><div className="row">
        <button className="icon" onClick={() => nav(-1)} aria-label="رجوع"><Icon name="back" size={20} /></button>
        <div><h1>الإشعارات</h1><div className="muted">كل اللي مستنيك في مستوياتك</div></div>
      </div></header>
      <main className="main gutter">
        {list.length === 0 && <div className="card"><div className="note">مفيش حاجة مستنياك دلوقتي.</div></div>}
        <div className="list">
          {list.map(n => (
            <Link key={n.key} to={n.to} className={`card notice${before.includes(n.key) ? '' : ' new'}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <span className={`nicon${n.urgent ? ' urgent' : ''}`}><Icon name={n.kind} size={18} /></span>
                <div className="grow"><b>{n.title}</b>{n.body && <div className="muted">{n.body}</div>}</div>
              </div>
            </Link>
          ))}
        </div>
        {cloud && <PushToggle who="servant" />}
        <Link to="/notify" className="btn">مواعيد التنبيهات على الموبايل</Link>
      </main>
    </>
  );
}
