import { initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { connectAuthEmulator, getAuth, initializeAuth, inMemoryPersistence, type Auth } from 'firebase/auth';
import {
  connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore,
} from 'firebase/firestore';
import { APP_CHECK_KEY, firebaseConfig, useEmulator } from './config';

/**
 * Three app instances so sessions don't collide on one phone:
 * - 'servant': Google sign-in for servants, full church data.
 * - 'member': code + PIN sign-in for members, reads only their own view.
 * - 'provision': throwaway, used by a servant to create a member's login without signing themselves out.
 */
interface Handle { app: FirebaseApp; auth: Auth; db: Firestore }
const cache: Record<string, Handle> = {};

function make(name: 'servant' | 'member' | 'provision'): Handle {
  if (cache[name]) return cache[name];
  if (!firebaseConfig) throw new Error('Firebase is not configured');
  const app = initializeApp(firebaseConfig, name);
  // App Check: Firebase answers only this site, not scripts that copied its public config.
  if (!useEmulator && APP_CHECK_KEY) initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(APP_CHECK_KEY), isTokenAutoRefreshEnabled: true });
  const auth = name === 'provision' ? initializeAuth(app, { persistence: inMemoryPersistence }) : getAuth(app);
  const db = initializeFirestore(app, {
    ignoreUndefinedProperties: true,
    localCache: name === 'provision' ? undefined : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  if (useEmulator) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
  return (cache[name] = { app, auth, db });
}

export const servantFb = () => make('servant');
export const memberFb = () => make('member');
export const provisionFb = () => make('provision');
