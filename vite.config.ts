import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// /api → servidor Express (draft en vivo para el teléfono)
// /cdn → imágenes de Brawlify servidas desde el mismo origen, para que la detección automática
//        pueda leer sus píxeles (el navegador bloquea leer imágenes de otro dominio sin CORS)
const proxy = {
  '/api': 'http://localhost:3001',
  '/cdn': { target: 'https://cdn.brawlify.com', changeOrigin: true, rewrite: (p: string) => p.replace(/^\/cdn/, '') }
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // accesible desde el teléfono en la misma WiFi
    proxy
  },
  preview: { host: true, proxy }
});
