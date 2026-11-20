// Genera los iconos de la app instalable (PWA) a partir de un SVG propio:
// equipo azul a la izquierda, rojo a la derecha y una estrella amarilla (el mejor pick) en medio.
// Uso: node scripts/make-icons.mjs   → escribe en public/
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, writeFileSync } from 'node:fs';

const star = (cx, cy, r) => {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
};

// pad = margen de seguridad (los iconos "maskable" de Android se recortan en círculo)
function svg({ pad = 0, round = 112 } = {}) {
  const s = 512 - pad * 2;
  const k = s / 512;
  const T = (x) => pad + x * k;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${pad ? 0 : round}" fill="#231e3f"/>
  <rect x="${T(56)}" y="${T(96)}" width="${150 * k}" height="${320 * k}" rx="${34 * k}" fill="#3498db"/>
  <rect x="${T(306)}" y="${T(96)}" width="${150 * k}" height="${320 * k}" rx="${34 * k}" fill="#e74c3c"/>
  <circle cx="${T(256)}" cy="${T(256)}" r="${118 * k}" fill="#231e3f"/>
  <polygon points="${star(T(256), T(262), 108 * k)}" fill="#f1c40f" stroke="#231e3f" stroke-width="${10 * k}" stroke-linejoin="round"/>
</svg>`;
}

mkdirSync('public', { recursive: true });
const png = (src, size, file) => writeFileSync(`public/${file}`, new Resvg(src, { fitTo: { mode: 'width', value: size } }).render().asPng());
png(svg(), 192, 'icon-192.png');
png(svg(), 512, 'icon-512.png');
png(svg({ pad: 60 }), 512, 'icon-maskable-512.png');
png(svg({ pad: 0, round: 0 }), 180, 'apple-touch-icon.png');
writeFileSync('public/favicon.svg', svg());
console.log('Iconos generados en public/');
