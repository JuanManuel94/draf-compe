// Versión "independiente": la app publicada en internet para instalar en el teléfono.
// Todo el motor (meta, counters, recomendaciones) funciona dentro del navegador; lo único que
// necesita el servidor del PC (vista en vivo para otro teléfono y detección por pantalla) se oculta.
export const STANDALONE = import.meta.env.VITE_STANDALONE === '1';
