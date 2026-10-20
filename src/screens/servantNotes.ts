import { useMemo, useSyncExternalStore } from 'react';
import { absenceStreak, birthdayWhen, needsFollowUp, todayISO, upcomingBirthdays, watchList } from '../data/logic';
import { useAllowedLevel, useCan, useData, useStore } from '../data/store';
import { usePending } from './usePending';
import { monthName, shiftMonth, thisMonth } from '../data/monthReport';

/** One line in the servant's notifications: anything waiting on them, newest worries first. */
export type ServantNote = { key: string; kind: 'mic' | 'heart' | 'cake' | 'eye' | 'clock' | 'alert' | 'chart'; title: string; body?: string; to: string; urgent?: boolean };

const WEEK = 7 * 86_400_000;
const SEEN = 'servantSeen';
const loadSeen = (): string[] => { try { const x = JSON.parse(localStorage.getItem(SEEN) ?? '[]'); return Array.isArray(x) ? x : []; } catch { return []; } };
/** Shared by the bell on every screen, so opening the notifications clears all the counters at once. */
let seenNow: string[] | undefined;
const seenListeners = new Set<() => void>();
const seenStore = {
  subscribe: (cb: () => void) => { seenListeners.add(cb); return () => { seenListeners.delete(cb); }; },
  get: () => (seenNow ??= loadSeen()),
  set: (keys: string[]) => {
    seenNow = keys;
    try { localStorage.setItem(SEEN, JSON.stringify(keys)); } catch { /* private mode: the counter just resets */ }
    seenListeners.forEach(f => f());
  },
};

/** Everything the bell counts: recitations, members due a visit or a word, birthdays, sessions missing a summary, sync trouble. */
export function useServantNotes() {
  const [data] = useData();
  const { syncError } = useStore();
  const allowed = useAllowedLevel();
  const canSessions = useCan('sessions');
  const pending = usePending();
  const seen = useSyncExternalStore(seenStore.subscribe, seenStore.get);
  const levelsKey = data.levels.filter(l => allowed(l.id)).map(l => l.id).join();
  const notes = useMemo(() => {
    const mine = data.members.filter(m => allowed(m.levelId));
    const notes: ServantNote[] = [];

    if (syncError) notes.push({ key: 'sync', kind: 'alert', title: 'في مشكلة في المزامنة', body: syncError, to: '/', urgent: true });
    for (const s of pending) notes.push({ key: `sub_${s.id}`, kind: 'mic', title: `${data.members.find(m => m.id === s.memberId)?.name ?? s.memberName} سمّع «${s.hymnName}»`, body: 'مستني تسمعه وترد عليه', to: '/reviews', urgent: true });
    for (const m of mine) {
      const n = absenceStreak(data, m);
      if (needsFollowUp(n)) notes.push({ key: `fu_${m.id}_${n}`, kind: 'heart', title: `${m.name} محتاج افتقاد`, body: `غاب ${n} مرات ورا بعض`, to: '/followup', urgent: true });
    }
    for (const { member: m, daysAway } of upcomingBirthdays(mine, 3))
      notes.push({ key: `bd_${m.id}_${new Date().getFullYear()}`, kind: 'cake', title: `عيد ميلاد ${m.name} ${birthdayWhen(daysAway)}`, body: 'ابعتله تهنئة من الرئيسية', to: '/' });
    for (const { member: m, reasons } of watchList(data, allowed))
      notes.push({ key: `w_${m.id}_${reasons.join('|')}`, kind: 'eye', title: `خلّي بالك من ${m.name}`, body: reasons.join(' • '), to: `/members/${m.id}` });
    if (canSessions) for (const s of data.sessions)
      if (allowed(s.levelId) && !s.summary && !(s.recordings?.length) && s.date <= todayISO() && Date.now() - new Date(s.date).getTime() < WEEK)
        notes.push({ key: `sum_${s.id}`, kind: 'clock', title: `حصة ${data.levels.find(l => l.id === s.levelId)?.name ?? ''} يوم ${s.date} من غير ملخص`, body: 'المخدومين بيستنوا الملخص والتسجيل عشان يراجعوا', to: `/summary/${s.id}` });

    // Month report: the past month's, for the first week of a new month; and a heads-up in the last three days before the ranking resets.
    const today = new Date(), last = shiftMonth(thisMonth(), -1);
    const daysLeft = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate();
    const had = (month: string) => data.sessions.some(s => allowed(s.levelId) && s.date.startsWith(month));
    if (today.getDate() <= 7 && had(last))
      notes.push({ key: `month_${last}`, kind: 'chart', title: `تقرير ${monthName(last)} جاهز`, body: 'الحضور والأوائل ومين مستواه نزل', to: `/month/${last}` });
    if (daysLeft < 3 && had(thisMonth()))
      notes.push({ key: `reset_${thisMonth()}`, kind: 'chart', title: daysLeft === 0 ? 'الترتيب بيتصفّر بكرة' : `الترتيب بيتصفّر بعد ${daysLeft === 1 ? 'يومين' : `${daysLeft + 1} أيام`}`, body: 'شوف الأوائل ومين محتاج تشجيع قبل ما الشهر يخلص', to: `/month/${thisMonth()}` });

    return notes;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, pending.map(p => p.id).join(), syncError, levelsKey, canSessions]);

  const unread = notes.filter(n => !seen.includes(n.key)).length;
  const markSeen = () => seenStore.set([...new Set([...notes.map(n => n.key), ...seen])].slice(0, 600));
  return { notes, unread, seen, markSeen, pending: pending.length };
}
