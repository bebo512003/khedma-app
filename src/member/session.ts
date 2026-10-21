import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../data/store';
import { hashPin } from '../data/logic';
import { buildMemberView, type MemberView } from '../data/memberView';
import { applyMemberEdit, type MemberEdit } from '../data/types';
import { cloudEnabled } from '../firebase/config';

/** Which member is signed in on this device. */
const KEY = 'khedma.member';
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const write = (id: string | null) => { try { if (id) localStorage.setItem(KEY, id); else localStorage.removeItem(KEY); } catch { /* private mode */ } };

/** Example members have no PIN yet, so 123456 lets anyone try the member app with them (offline mode only). */
export const EXAMPLE_PIN = '123456';

/** A mobile number typed at login instead of a code. */
export const isPhone = (s: string) => /^01\d{9}$/.test(s);

/** `code` may also be a mobile number: the member's own or a parent's. */
export async function memberLogin(code: string, pin: string, data: ReturnType<typeof useStore>['data']): Promise<string | null> {
  let id: string | null = null;
  if (cloudEnabled) {
    const { memberSignIn, memberSignInByPhone } = await import('../firebase/accounts');
    id = isPhone(code) ? await memberSignInByPhone(code, pin) : await memberSignIn(code, pin);
  } else {
    for (const m of data?.members.filter(x => isPhone(code) ? x.phone === code || x.parentPhone === code : x.code === code) ?? []) {
      if (m.pinHash ? (await hashPin(m.id, pin)) === m.pinHash : m.example && pin === EXAMPLE_PIN) { id = m.id; break; }
    }
  }
  if (id) write(id);
  return id;
}

export async function memberLogout() {
  write(null);
  if (cloudEnabled) await (await import('../firebase/accounts')).memberSignOut();
}

/** The signed-in member's view: computed locally offline, or the copy servants publish in cloud mode. */
export function useMemberView() {
  const { data } = useStore();
  const [id] = useState(read);
  const [cloudView, setCloudView] = useState<MemberView | null>(null);
  const [loading, setLoading] = useState(cloudEnabled && !!id);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<MemberEdit | null>(null);

  useEffect(() => {
    if (!cloudEnabled || !id) return;
    let stop = () => {};
    let stopAuth = () => {};
    (async () => {
      const [{ memberFb }, { onAuthStateChanged }, { watchMemberView, watchMemberEdit }] = await Promise.all([
        import('../firebase/app'), import('firebase/auth'), import('../firebase/accounts'),
      ]);
      // Wait for the saved login to come back before reading, or the rules see nobody.
      stopAuth = onAuthStateChanged(memberFb().auth, u => {
        stop();
        if (!u) { write(null); setLoading(false); return; }
        const stopView = watchMemberView(id, v => { setCloudView(v); setLoading(false); }, e => { setError(e.message); setLoading(false); });
        const stopEdit = watchMemberEdit(id, setPending);
        stop = () => { stopView(); stopEdit(); };
      });
    })();
    return () => { stop(); stopAuth(); };
  }, [id]);

  const localView = useMemo(() => (!cloudEnabled && id && data ? buildMemberView(data, id) : null), [id, data]);
  const base = cloudEnabled ? cloudView : localView;
  // An edit the servants' app hasn't applied yet shows straight away on the member's own screens.
  const view = useMemo(() => {
    if (!base || !pending) return base;
    const p = { ...base.profile, ...pending };
    return { ...base, name: p.name?.trim() || base.name, photo: p.photo ?? base.photo, profile: p };
  }, [base, pending]);
  return { id: read() ? id : null, view, loading, error, pending: !!pending };
}

/** Saves a member's own photo and details: straight into the data offline, or as a pending edit in the cloud. */
export function useSaveProfile() {
  const { update } = useStore();
  return async (memberId: string, edit: MemberEdit) => {
    if (cloudEnabled) return (await import('../firebase/accounts')).submitMemberEdit(memberId, edit);
    update(d => ({ ...d, members: d.members.map(m => m.id === memberId ? applyMemberEdit(m, edit) : m) }));
  };
}
