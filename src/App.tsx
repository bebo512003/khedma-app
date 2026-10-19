import type { ReactNode } from 'react';
import { HashRouter, Link, Route, Routes } from 'react-router-dom';
import { useCan } from './data/store';
import type { Perm } from './data/types';
import Gate from './screens/Gate';
import Home from './screens/Home';
import SessionScreen from './screens/Session';
import Sessions from './screens/Sessions';
import Backup from './screens/Backup';
import Reviews from './screens/Reviews';
import Summary from './screens/Summary';
import FollowUp from './screens/FollowUp';
import Members from './screens/Members';
import MemberForm from './screens/MemberForm';
import MemberCard from './screens/MemberProfile';
import ImportMembers from './screens/ImportMembers';
import Library from './screens/Library';
import HymnForm from './screens/HymnForm';
import HymnView from './screens/HymnView';
import Curriculum from './screens/Curriculum';
import Books from './screens/Books';
import BookPage from './screens/BookPage';
import Levels from './screens/Levels';
import Team from './screens/Team';
import Cards from './screens/Cards';
import Dictionary from './screens/Dictionary';
import Translate from './screens/Translate';
import Reports from './screens/Reports';
import MemberLogin from './member/Login';
import Install from './screens/Install';
import ServantProfile from './screens/ServantProfile';
import Notify from './screens/Notify';
import MemberLayout from './member/Layout';
import MemberHome from './member/Home';
import MemberHymn from './member/Hymn';
import MemberProfile from './member/Profile';
import MemberRatings from './member/Ratings';
import MemberRank from './member/Rank';
import MemberMe from './member/Me';
import MemberSessions from './member/Sessions';
import { MemberBook, MemberBooks } from './member/Books';

const s = (el: ReactNode) => <Gate>{el}</Gate>;
/** A screen behind a permission (see PERMS). */
const n = (p: Perm, el: ReactNode) => <Gate><Need p={p}>{el}</Need></Gate>;
function Need({ p, children }: { p: Perm; children: ReactNode }) {
  return useCan(p) ? children : <main className="main gutter"><div className="card">الصفحة دي محتاجة صلاحية مش معاك. اطلبها من الأدمن. <Link to="/">ارجع للرئيسية</Link></div></main>;
}

export default function App() {
  return (
    <HashRouter>
      <div className="app">
        <Routes>
          <Route path="/" element={s(<Home />)} />
          <Route path="/session/:levelId" element={n('sessions', <SessionScreen />)} />
          <Route path="/summary/:sessionId" element={s(<Summary />)} />
          <Route path="/sessions" element={s(<Sessions />)} />
          <Route path="/backup" element={s(<Backup />)} />
          <Route path="/reviews" element={n('sessions', <Reviews />)} />
          <Route path="/sessions/:sessionId/edit" element={n('sessions', <SessionScreen />)} />
          <Route path="/followup" element={s(<FollowUp />)} />
          <Route path="/members" element={s(<Members />)} />
          <Route path="/members/new" element={n('members', <MemberForm />)} />
          <Route path="/members/import" element={n('members', <ImportMembers />)} />
          <Route path="/members/:memberId" element={s(<MemberCard />)} />
          <Route path="/members/:memberId/edit" element={n('members', <MemberForm />)} />
          <Route path="/library" element={s(<Library />)} />
          <Route path="/hymns/new" element={n('curriculum', <HymnForm />)} />
          <Route path="/hymns/:hymnId" element={s(<HymnView />)} />
          <Route path="/hymns/:hymnId/edit" element={n('curriculum', <HymnForm />)} />
          <Route path="/curriculum" element={s(<Curriculum />)} />
          <Route path="/books" element={s(<Books />)} />
          <Route path="/books/:bookId" element={s(<BookPage />)} />
          <Route path="/levels" element={s(<Levels />)} />
          <Route path="/team" element={s(<Team />)} />
          <Route path="/profile" element={s(<ServantProfile />)} />
          <Route path="/notify" element={s(<Notify />)} />
          <Route path="/cards" element={n('members', <Cards />)} />
          <Route path="/dictionary" element={s(<Dictionary />)} />
          <Route path="/translate" element={s(<Translate />)} />
          <Route path="/reports" element={n('reports', <Reports />)} />
          <Route path="/install" element={<Install />} />
          <Route path="/me" element={<MemberLogin />} />
          <Route path="/me" element={<MemberLayout />}>
            <Route path="home" element={<MemberHome />} />
            <Route path="hymn/:hymnId" element={<MemberHymn />} />
            <Route path="ratings" element={<MemberRatings />} />
            <Route path="profile" element={<MemberMe />} />
            <Route path="profile/edit" element={<MemberProfile />} />
            <Route path="sessions" element={<MemberSessions />} />
            <Route path="books" element={<MemberBooks />} />
            <Route path="books/:bookId" element={<MemberBook />} />
            <Route path="rank" element={<MemberRank />} />
            <Route path="dictionary" element={<Dictionary back="/me/home" base="/me" />} />
            <Route path="translate" element={<Translate base="/me" />} />
          </Route>
        </Routes>
      </div>
    </HashRouter>
  );
}
