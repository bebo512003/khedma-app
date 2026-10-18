import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: { globPatterns: ['**/*.{js,css,html,png,ttf,svg,woff2}'], maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
        // The dictionary is big, so it's cached the first time it's opened instead of on install.
        runtimeCaching: [
          { urlPattern: /\/dict\/.*\.json/, handler: 'CacheFirst', options: { cacheName: 'dictionary' } },
          { urlPattern: /\/packs\/.*\.json/, handler: 'StaleWhileRevalidate', options: { cacheName: 'packs' } },
          // Booklet pages are cached as they're opened, so a hymn's hazzat work offline after the first look.
          { urlPattern: /\/books\/.*\.webp/, handler: 'CacheFirst', options: { cacheName: 'books', expiration: { maxEntries: 400 } } },
        ] },
      manifest: {
        name: 'St. Stephan SCH',
        short_name: 'St. Stephan SCH',
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
