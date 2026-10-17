import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import App from './App';
import { StoreProvider } from './data/store';
import { applyTheme, loadTheme } from './theme';

applyTheme(loadTheme());
registerSW({ immediate: true });

// Emulator only: lets automated tests sign in as a Google servant without a real Google popup.
if (import.meta.env.VITE_FB_EMULATOR === '1') {
  Object.assign(window, {
    __testSignIn: async (email: string, name: string) => {
      const [{ servantFb }, { GoogleAuthProvider, signInWithCredential }] = await Promise.all([import('./firebase/app'), import('firebase/auth')]);
      const token = JSON.stringify({ sub: email, email, email_verified: true, name });
      await signInWithCredential(servantFb().auth, GoogleAuthProvider.credential(token));
    },
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
);
