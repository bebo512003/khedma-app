import { deleteDoc, getDoc, setDoc, type Firestore } from 'firebase/firestore';
import type { Auth } from 'firebase/auth';
import { churchRef, ref } from './paths';

/** Web Push on this device. The scheduled job (scripts/notify) sends to every saved subscription. */
export type PushState = 'unsupported' | 'needsInstall' | 'denied' | 'off' | 'on';

const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const standalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

async function subId(endpoint: string) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return [...new Uint8Array(h)].slice(0, 20).map(b => b.toString(16).padStart(2, '0')).join('');
}

const key = (b64: string) => {
  const s = atob((b64 + '='.repeat((4 - b64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, c => c.charCodeAt(0));
};

const current = async () => (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription() ?? null;

export async function pushState(): Promise<PushState> {
  if (!supported()) return ios() && !standalone() ? 'needsInstall' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.permission === 'granted' && await current() ? 'on' : 'off';
}

export async function enablePush({ auth, db }: { auth: Auth; db: Firestore }): Promise<PushState> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('signed out');
  if (await Notification.requestPermission() !== 'granted') return 'denied';
  const pub = (await getDoc(churchRef(db))).data()?.pushKey as string | undefined;
  if (!pub) throw new Error('no push key yet');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (sub && sub.options.applicationServerKey && new Uint8Array(sub.options.applicationServerKey).join() !== key(pub).join()) { await sub.unsubscribe(); sub = null; }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key(pub) });
  const j = sub.toJSON();
  await setDoc(ref(db, 'pushSubs', await subId(sub.endpoint)), { uid, endpoint: j.endpoint, p256dh: j.keys!.p256dh, auth: j.keys!.auth, at: Date.now() });
  return 'on';
}

export async function disablePush(db: Firestore) {
  const sub = await current();
  if (!sub) return;
  await deleteDoc(ref(db, 'pushSubs', await subId(sub.endpoint))).catch(() => {});
  await sub.unsubscribe();
}

