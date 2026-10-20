import type { FirebaseOptions } from 'firebase/app';

/**
 * Paste the web app config from Firebase console → Project settings → Your apps.
 * It is public by design (security lives in firestore.rules). Left empty, the app runs fully offline on one device.
 */
const PROJECT: FirebaseOptions | null = {
  apiKey: 'AIzaSyA8wMb0quPu81pfSfNy8d4pLPzCVRDsAjc',
  authDomain: 'khedma-app-190d3.firebaseapp.com',
  projectId: 'khedma-app-190d3',
  storageBucket: 'khedma-app-190d3.firebasestorage.app',
  messagingSenderId: '442063855286',
  appId: '1:442063855286:web:a77ed300278192abac5017',
};

/** reCAPTCHA Enterprise site key for App Check (public by design, like the config above). */
export const APP_CHECK_KEY = '6LdCBPktAAAAALB8WQx2dSzxYA6Yik6eRy9ZpqKH';

/** `VITE_FB_EMULATOR=1 npm run dev` runs against local emulators with a demo project. */
export const useEmulator = import.meta.env.VITE_FB_EMULATOR === '1';

export const firebaseConfig: FirebaseOptions | null = useEmulator
  ? { apiKey: 'demo-key', authDomain: 'demo-khedma.firebaseapp.com', projectId: 'demo-khedma', appId: 'demo-app' }
  : PROJECT;

export const cloudEnabled = firebaseConfig !== null;

/** All data lives under churches/{CHURCH_ID} so more churches can be added later. */
export const CHURCH_ID = 'stephanos-darwa';
