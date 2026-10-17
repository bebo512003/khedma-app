import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: { globPatterns: ['**/*.{js,css,html,png,ttf,svg}'], maximumFileSizeToCacheInBytes: 2 * 1024 * 1024 },
      manifest: {
        name: 'مدرسة الشهيد اسطفانوس للشمامسة',
        short_name: 'مدرسة الألحان',
        lang: 'ar',
        dir: 'rtl',
        start_url: './',
        display: 'standalone',
        background_color: '#FAF6EF',
        theme_color: '#5C1716',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
});
