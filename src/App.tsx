import type { ReactNode } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import Gate from './screens/Gate';
import Home from './screens/Home';
import SessionScreen from './screens/Session';
import Summary from './screens/Summary';
import FollowUp from './screens/FollowUp';
import Members from './screens/Members';
import MemberForm from './screens/MemberForm';
import ImportMembers from './screens/ImportMembers';
import Library from './screens/Library';
import HymnForm from './screens/HymnForm';
import Curriculum from './screens/Curriculum';
import Books from './screens/Books';
import BookPage from './screens/BookPage';
import Levels from './screens/Levels';
import Team from './screens/Team';
import Cards from './screens/Cards';
import Dictionary from './screens/Dictionary';
import Reports from './screens/Reports';
import MemberLogin from './member/Login';
import MemberLayout from './member/Layout';
import MemberHome from './member/Home';
import MemberHymn from './member/Hymn';
import MemberProfile from './member/Profile';
import MemberRatings from './member/Ratings';
import MemberRank from './member/Rank';

const s = (el: ReactNode) => <Gate>{el}</Gate>;

export default function App() {
  return (
    <HashRouter>
      <div className="app">
        <Routes>
          <Route path="/" element={s(<Home />)} />
          <Route path="/session/:levelId" element={s(<SessionScreen />)} />
          <Route path="/summary/:sessionId" element={s(<Summary />)} />
          <Route path="/followup" element={s(<FollowUp />)} />
          <Route path="/members" element={s(<Members />)} />
          <Route path="/members/new" element={s(<MemberForm />)} />
          <Route path="/members/import" element={s(<ImportMembers />)} />
          <Route path="/members/:memberId" element={s(<MemberForm />)} />
          <Route path="/library" element={s(<Library />)} />
          <Route path="/hymns/new" element={s(<HymnForm />)} />
          <Route path="/hymns/:hymnId" element={s(<HymnForm />)} />
          <Route path="/curriculum" element={s(<Curriculum />)} />
          <Route path="/books" element={s(<Books />)} />
          <Route path="/books/:bookId" element={s(<BookPage />)} />
          <Route path="/levels" element={s(<Levels />)} />
          <Route path="/team" element={s(<Team />)} />
          <Route path="/cards" element={s(<Cards />)} />
          <Route path="/dictionary" element={s(<Dictionary />)} />
          <Route path="/reports" element={s(<Reports />)} />
          <Route path="/me" element={<MemberLogin />} />
          <Route path="/me" element={<MemberLayout />}>
            <Route path="home" element={<MemberHome />} />
            <Route path="hymn/:hymnId" element={<MemberHymn />} />
            <Route path="ratings" element={<MemberRatings />} />
            <Route path="profile" element={<MemberProfile />} />
            <Route path="rank" element={<MemberRank />} />
            <Route path="dictionary" element={<Dictionary back="/me/home" />} />
          </Route>
        </Routes>
      </div>
    </HashRouter>
  );
}
