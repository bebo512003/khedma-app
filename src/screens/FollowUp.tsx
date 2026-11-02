import { useData } from '../data/store';
import { absenceStreak, needsFollowUp } from '../data/logic';
import FollowUpList from './FollowUpList';
import { BackButton } from '../ui/back';

export default function FollowUp() {
  const [data] = useData();
  const list = data.members.filter(m => needsFollowUp(absenceStreak(data, m)));
  return (
    <>
      <header className="top gutter"><div className="row"><BackButton /><h1>الافتقاد</h1></div></header>
      <main className="main gutter">
        {list.length ? <FollowUpList members={list} /> : <div className="card"><div className="note">مفيش حد محتاج افتقاد دلوقتي.</div></div>}
      </main>
    </>
  );
}
