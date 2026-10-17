import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { useMember } from './session';

export default function MemberLayout() {
  const { member } = useMember();
  if (!member) return <Navigate to="/me" replace />;
  return (
    <>
      <Outlet />
      <nav className="tabs gutter" aria-label="تطبيق المخدوم"><div>
        <NavLink to="/me/home">الرئيسية</NavLink>
        <NavLink to="/me/ratings">تقييماتي</NavLink>
        <NavLink to="/me/rank">الترتيب</NavLink>
      </div></nav>
    </>
  );
}
