import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Navigate, Outlet } from 'react-router-dom';
import type { MemberView } from '../data/memberView';
import { useMemberView } from './session';
import Icon from '../ui/Icon';
import { cloudEnabled } from '../firebase/config';
import type { Submission } from '../data/types';
import { buildNotes, loadSeen, saveSeen, type Note } from './notes';

const ViewCtx = createContext<MemberView | null>(null);
/** Screens under the layout render only once the view exists. */
export const useView = () => useContext(ViewCtx)!;

type Notes = { subs: Submission[]; notes: Note[]; unread: number; seen: number; markSeen: () => void };
const NotesCtx = createContext<Notes>({ subs: [], notes: [], unread: 0, seen: 0, markSeen: () => {} });
/** The member's recitations and notifications, watched once for every screen. */
export const useNotes = () => useContext(NotesCtx);

function useNotesState(view: MemberView | null): Notes {
  const memberId = view?.memberId;
  const [subs, setSubs] = useState<Submission[]>([]);
  const [seen, setSeen] = useState(0);
  useEffect(() => {
    if (!cloudEnabled || !memberId) return;
    setSeen(loadSeen(memberId));
    let stop = () => {};
    import('../firebase/submissions').then(m => { stop = m.watchMySubmissions(memberId, setSubs); });
    return () => stop();
  }, [memberId]);
  const notes = useMemo(() => view ? buildNotes(view, subs) : [], [view, subs]);
  const unread = notes.filter(n => n.at > seen).length;
  const markSeen = () => {
    if (!memberId || !notes.length) return;
    const at = Math.max(seen, notes[0].at);
    saveSeen(memberId, at); setSeen(at);
  };
  return { subs, notes, unread, seen, markSeen };
}

/** Bell with the unread count, for the member's headers. */
export function Bell() {
  const { unread } = useNotes();
  return (
    <Link to="/me/notifications" className="icon bell" aria-label={unread ? `الإشعارات، ${unread} جديد` : 'الإشعارات'}>
      <Icon name="bell" size={20} />{unread > 0 && <span className="count">{unread > 9 ? '9+' : unread}</span>}
    </Link>
  );
}

export default function MemberLayout() {
  const { id, view, loading, error } = useMemberView();
  const notes = useNotesState(view);
  if (!id) return <Navigate to="/me" replace />;
  if (loading) return <main className="main gutter"><div className="note">بيحمّل…</div></main>;
  if (!view) return (
    <main className="main gutter"><div className="card">
      <b>لسه بياناتك مش جاهزة</b>
      <div className="note">{error ? 'مش قادرين نوصل لبياناتك دلوقتي. اتأكد إن معاك نت وجرّب تاني.' : 'الخادم لسه ما سجلش أي حاجة ليك. بعد أول حصة هتلاقي كل حاجة هنا.'}</div>
    </div></main>
  );
  return (
    <ViewCtx.Provider value={view}><NotesCtx.Provider value={notes}>
      <Outlet />
      <nav className="mtabs member" aria-label="تطبيق المخدوم"><div>
        <NavLink to="/me/home" className="badged"><Icon name="home" />الرئيسية{notes.unread > 0 && <span className="count">{notes.unread > 9 ? '9+' : notes.unread}</span>}</NavLink>
        <NavLink to="/me/sessions"><Icon name="clock" />الحصص</NavLink>
        <NavLink to="/me/books"><Icon name="books" />الكتب</NavLink>
        <NavLink to="/me/rank"><Icon name="chart" />الترتيب</NavLink>
        <NavLink to="/me/profile"><Icon name="user" />بروفايلي</NavLink>
      </div></nav>
    </NotesCtx.Provider></ViewCtx.Provider>
  );
}
