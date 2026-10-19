import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDay } from '../data/logic';
import { STATUS_LABELS } from '../data/types';
import Icon from '../ui/Icon';
import { useView } from './Layout';
import { RatingsBody } from './Ratings';
import { memberLogout } from './session';

type Tab = 'hymns' | 'ratings' | 'info';

/** The member's own profile, laid out like the one servants see. Editing is behind the pencil. */
export default function MemberMe() {
  const v = useView();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>('hymns');
  const done = v.hymns.filter(h => h.status >= 2).length;
  const p = v.profile ?? {};
  const row = (label: string, value?: string) => value ? <div className="kv"><span className="muted">{label}</span><b>{value}</b></div> : null;
  const logout = async () => { await memberLogout(); nav('/me', { replace: true }); };

  return (
    <>
      <header className="top gutter">
        <div className="row between">
          <h1>بروفايلي</h1>
          <Link to="/me/profile/edit" className="icon" aria-label="عدّل بياناتي"><Icon name="edit" size={20} /></Link>
        </div>
        <div className="profile-hero">
          <span className="av">{v.photo ? <img src={v.photo} alt="" /> : v.name[0]}</span>
          <div className="grow">
            <h1>{v.name}</h1>
            <div className="muted">{[v.code && `كود ${v.code}`, v.grade].filter(Boolean).join(' • ')}</div>
            <div className="chips" style={{ marginTop: 6 }}>
              {v.levelName && <span className="tag tag-soft">{v.levelName}</span>}
              {v.rank && <span className="tag tag-soft">رتبة: {v.rank}</span>}
            </div>
          </div>
        </div>
        <div className="stats">
          <div className="stat dark"><b>{v.place ? `#${v.place}` : '–'}</b><span>ترتيبك في المستوى</span></div>
          <div className="stat"><b>{v.points}</b><span className="muted">نقطة الشهر ده</span></div>
          <div className="stat"><b>{v.attendanceRate === null ? '–' : `${v.attendanceRate}%`}</b><span className="muted">حضور</span></div>
        </div>
        <div className="ptabs" role="tablist">
          {([['hymns', 'الألحان'], ['ratings', 'التقييمات'], ['info', 'البيانات']] as const).map(([k, l]) =>
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}
        </div>
      </header>

      <main className="main gutter">
        {tab === 'hymns' && <>
          <div className="row between"><b>منهج {v.termName ?? 'الترم'}</b><span className="muted">{done} من {v.hymns.length} حافظهم</span></div>
          {v.hymns.length > 0 && <div className="progress-bar"><div style={{ width: `${Math.round(100 * done / v.hymns.length)}%` }} /></div>}
          <div className="card" style={{ paddingBlock: 4 }}><div className="list">
            {v.hymns.map(h => (
              <Link key={h.id} to={`/me/hymn/${h.id}`} className="li">
                <b className="grow">{h.nameAr}</b><span className={`pill st${h.status}`} style={{ display: 'inline-flex', alignItems: 'center' }}>{STATUS_LABELS[h.status]}</span>
              </Link>
            ))}
            {v.hymns.length === 0 && <div className="note">لسه الخدام ما حطوش ألحان الترم.</div>}
          </div></div>
        </>}
        {tab === 'ratings' && <RatingsBody />}
        {tab === 'info' && <>
          <div className="card">
            {p.birthdate && row('تاريخ الميلاد', formatDay(p.birthdate))}
            {row('السنة الدراسية', p.grade ?? v.grade)}
            {row('موبايلي', p.phone)}
            {row('موبايل ولي الأمر', p.parentPhone)}
            {row('العنوان', p.address)}
            {row('النوع', p.gender === 'f' ? 'أنثى' : p.gender === 'm' ? 'ذكر' : undefined)}
            <Link to="/me/profile/edit" className="btn">عدّل بياناتي</Link>
          </div>
          <Link to="/me/dictionary" className="btn">القاموس القبطي</Link>
          <Link to="/me/translate" className="btn">ترجمة جملة قبطي</Link>
          <button className="btn" onClick={logout}>خروج</button>
        </>}
      </main>
    </>
  );
}
