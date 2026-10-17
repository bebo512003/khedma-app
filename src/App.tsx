import { HashRouter, Route, Routes } from 'react-router-dom';
import { useStore } from './data/store';
import Home from './screens/Home';
import SessionScreen from './screens/Session';
import Summary from './screens/Summary';
import FollowUp from './screens/FollowUp';
import Members from './screens/Members';
import MemberForm from './screens/MemberForm';

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
        </Routes>
      </div>
    </HashRouter>
  );
}
