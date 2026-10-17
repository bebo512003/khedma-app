import { HashRouter, Route, Routes } from 'react-router-dom';
import { useStore } from './data/store';
import Home from './screens/Home';
import SessionScreen from './screens/Session';
import Summary from './screens/Summary';
import FollowUp from './screens/FollowUp';
import Members from './screens/Members';
import MemberForm from './screens/MemberForm';
import Library from './screens/Library';
import HymnForm from './screens/HymnForm';
import Curriculum from './screens/Curriculum';
import Levels from './screens/Levels';
import MemberLogin from './member/Login';
import MemberLayout from './member/Layout';
import MemberHome from './member/Home';
import MemberHymn from './member/Hymn';
import MemberRatings from './member/Ratings';
import MemberRank from './member/Rank';

export default function App() {
  const { data } = useStore();
  if (!data) return <div className="app" />;
  return (
    <HashRouter>
      <div className="app">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/session/:levelId" element={<SessionScreen />} />
          <Route path="/summary/:sessionId" element={<Summary />} />
          <Route path="/followup" element={<FollowUp />} />
          <Route path="/members" element={<Members />} />
          <Route path="/members/new" element={<MemberForm />} />
          <Route path="/members/:memberId" element={<MemberForm />} />
          <Route path="/library" element={<Library />} />
          <Route path="/hymns/new" element={<HymnForm />} />
          <Route path="/hymns/:hymnId" element={<HymnForm />} />
          <Route path="/curriculum" element={<Curriculum />} />
          <Route path="/levels" element={<Levels />} />
          <Route path="/me" element={<MemberLogin />} />
          <Route path="/me" element={<MemberLayout />}>
            <Route path="home" element={<MemberHome />} />
            <Route path="hymn/:hymnId" element={<MemberHymn />} />
            <Route path="ratings" element={<MemberRatings />} />
            <Route path="rank" element={<MemberRank />} />
          </Route>
        </Routes>
      </div>
    </HashRouter>
  );
}
