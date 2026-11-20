import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// /api → servidor Express (draft en vivo para el teléfono)
// /cdn → imágenes de Brawlify servidas desde el mismo origen, para que la detección automática
//        pueda leer sus píxeles (el navegador bloquea leer imágenes de otro dominio sin CORS)
const proxy = {
  '/api': 'http://localhost:3001',
  '/cdn': { target: 'https://cdn.brawlify.com', changeOrigin: true, rewrite: (p: string) => p.replace(/^\/cdn/, '') }
};

// BASE = carpeta donde se publica (GitHub Pages: /<repo>/). En el PC es la raíz.
const base = process.env.BASE ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    // App instalable en el teléfono (PWA): icono en la pantalla de inicio, pantalla completa
    // y funciona sin conexión (las fotos de brawlers y mapas se guardan al verlas la primera vez)
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Brawl Draft Pro',
        short_name: 'Draft Pro',
        description: 'Asistente de draft Ranked (Mítico+): qué banear y qué pickear en cada mapa.',
        lang: 'es',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#231e3f',
        theme_color: '#231e3f',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/api/, /^\/cdn/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/(cdn|cdn-misc)\.brawlify\.com\//,
            handler: 'CacheFirst',
            options: { cacheName: 'brawlify-img', expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 60 }, cacheableResponse: { statuses: [0, 200] } }
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'fonts', cacheableResponse: { statuses: [0, 200] } }
          }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    host: true, // accesible desde el teléfono en la misma WiFi
    proxy
  },
  preview: { host: true, proxy }
});
