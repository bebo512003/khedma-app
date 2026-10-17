import type { FirebaseOptions } from 'firebase/app';

/**
 * Paste the web app config from Firebase console → Project settings → Your apps.
 * It is public by design (security lives in firestore.rules). Left empty, the app runs fully offline on one device.
 */
const PROJECT: FirebaseOptions | null = null;

/** `VITE_FB_EMULATOR=1 npm run dev` runs against local emulators with a demo project. */
export const useEmulator = import.meta.env.VITE_FB_EMULATOR === '1';

export const firebaseConfig: FirebaseOptions | null = useEmulator
  ? { apiKey: 'demo-key', authDomain: 'demo-khedma.firebaseapp.com', projectId: 'demo-khedma', appId: 'demo-app' }
  : PROJECT;

export const cloudEnabled = firebaseConfig !== null;

/** All data lives under churches/{CHURCH_ID} so more churches can be added later. */
export const CHURCH_ID = 'stephanos-darwa';
