import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../data/store';
import { hashPin } from '../data/logic';
import { buildMemberView, type MemberView } from '../data/memberView';
import { cloudEnabled } from '../firebase/config';

/** Which member is signed in on this device. */
const KEY = 'khedma.member';
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const write = (id: string | null) => { try { if (id) localStorage.setItem(KEY, id); else localStorage.removeItem(KEY); } catch { /* private mode */ } };

/** Example members have no PIN yet, so 1234 lets anyone try the member app with them (offline mode only). */
export const EXAMPLE_PIN = '1234';

export async function memberLogin(code: string, pin: string, data: ReturnType<typeof useStore>['data']): Promise<string | null> {
  let id: string | null = null;
  if (cloudEnabled) {
    const { memberSignIn } = await import('../firebase/accounts');
    id = await memberSignIn(code, pin);
  } else {
    const m = data?.members.find(x => x.code === code);
    const ok = m && (m.pinHash ? (await hashPin(m.id, pin)) === m.pinHash : m.example && pin === EXAMPLE_PIN);
    id = ok ? m.id : null;
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

  useEffect(() => {
    if (!cloudEnabled || !id) return;
    let stop = () => {};
    let stopAuth = () => {};
    (async () => {
      const [{ memberFb }, { onAuthStateChanged }, { watchMemberView }] = await Promise.all([
        import('../firebase/app'), import('firebase/auth'), import('../firebase/accounts'),
      ]);
      // Wait for the saved login to come back before reading, or the rules see nobody.
      stopAuth = onAuthStateChanged(memberFb().auth, u => {
        stop();
        if (!u) { write(null); setLoading(false); return; }
        stop = watchMemberView(id, v => { setCloudView(v); setLoading(false); }, e => { setError(e.message); setLoading(false); });
      });
    })();
    return () => { stop(); stopAuth(); };
  }, [id]);

  const localView = useMemo(() => (!cloudEnabled && id && data ? buildMemberView(data, id) : null), [id, data]);
  return { id: read() ? id : null, view: cloudEnabled ? cloudView : localView, loading, error };
}
