import { createContext, useContext } from 'react';
import { NavLink, Navigate, Outlet } from 'react-router-dom';
import type { MemberView } from '../data/memberView';
import { useMemberView } from './session';

const ViewCtx = createContext<MemberView | null>(null);
/** Screens under the layout render only once the view exists. */
export const useView = () => useContext(ViewCtx)!;

export default function MemberLayout() {
  const { id, view, loading, error } = useMemberView();
  if (!id) return <Navigate to="/me" replace />;
  if (loading) return <main className="main gutter"><div className="note">بيحمّل…</div></main>;
  if (!view) return (
    <main className="main gutter"><div className="card">
      <b>لسه بياناتك مش جاهزة</b>
      <div className="note">{error ? 'مش قادرين نوصل لبياناتك دلوقتي. اتأكد إن معاك نت وجرّب تاني.' : 'الخادم لسه ما سجلش أي حاجة ليك. بعد أول حصة هتلاقي كل حاجة هنا.'}</div>
    </div></main>
  );
  return (
    <ViewCtx.Provider value={view}>
      <Outlet />
      <nav className="tabs gutter" aria-label="تطبيق المخدوم"><div>
        <NavLink to="/me/home">الرئيسية</NavLink>
        <NavLink to="/me/ratings">تقييماتي</NavLink>
        <NavLink to="/me/rank">الترتيب</NavLink>
      </div></nav>
    </ViewCtx.Provider>
  );
}
