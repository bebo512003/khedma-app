import { Link } from 'react-router-dom';
import { useData } from '../data/store';
import { absenceStreak, needsFollowUp } from '../data/logic';
import FollowUpList from './FollowUpList';

export default function FollowUp() {
  const [data] = useData();
  const list = data.members.filter(m => needsFollowUp(absenceStreak(data, m)));
  return (
    <>
      <header className="top gutter"><div className="row"><Link to="/" className="icon" aria-label="رجوع">→</Link><h1>الافتقاد</h1></div></header>
      <main className="main gutter">
        {list.length ? <FollowUpList members={list} /> : <div className="card"><div className="note">مفيش حد محتاج افتقاد دلوقتي.</div></div>}
      </main>
    </>
  );
}
