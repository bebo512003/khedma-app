import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDay, formatTime, isoDate } from '../data/logic';
import PushToggle from '../screens/PushToggle';
import Icon from '../ui/Icon';
import { useNotes } from './Layout';

const ICON = { review: 'mic', summary: 'clock', note: 'heart' } as const;

/** The member's notifications: servant replies on recitations, session summaries and notes. Opening it clears the counter. */
export default function MemberNotifications() {
  const { notes, seen, markSeen } = useNotes();
  const nav = useNavigate();
  // Keep what was new when the screen opened highlighted while the member reads it.
  const [before] = useState(seen);
  useEffect(() => { markSeen(); }, [notes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <header className="top gutter"><div className="row">
        <button className="icon" onClick={() => nav(-1)} aria-label="رجوع"><Icon name="back" size={20} /></button>
        <div><h1>الإشعارات</h1><div className="muted">ردود الخدام وملخصات الحصص في آخر شهر</div></div>
      </div></header>
      <main className="main gutter">
        <PushToggle who="member" />
        {notes.length === 0 && <div className="card"><div className="note">مفيش إشعارات لسه. لما الخادم يرد على تسميعك أو ينزّل ملخص حصة هتلاقيه هنا.</div></div>}
        <div className="list">
          {notes.map(n => (
            <Link key={n.key} to={n.to} className={`card notice${n.at > before ? ' new' : ''}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <span className="nicon"><Icon name={ICON[n.kind]} size={18} /></span>
                <div className="grow">
                  <b>{n.title}</b>
                  {n.body && <div className="reply">{n.body}</div>}
                  <div className="muted">{formatDay(isoDate(new Date(n.at)))} • {formatTime(n.at)}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
