// Reconocimiento de retratos de brawlers en la pantalla reflejada del teléfono.
// Cada recorte se reduce a una "huella" de 12×12 colores normalizada (sin brillo ni contraste)
// y se compara por correlación con las fotos de referencia y con las muestras que el usuario corrigió.

export const GRID = 12;
export type Descriptor = Float32Array;

let scratch: HTMLCanvasElement | null = null;
function ctx2d(): CanvasRenderingContext2D {
  scratch ??= document.createElement('canvas');
  scratch.width = GRID; scratch.height = GRID;
  return scratch.getContext('2d', { willReadFrequently: true })!;
}

// Huella de una región (sx, sy, sw, sh en píxeles de la fuente). Se usa el 70 % central
// para ignorar marcos, bordes de rareza y fondos del hueco.
export function describe(src: CanvasImageSource, sx: number, sy: number, sw: number, sh: number): Descriptor {
  const c = ctx2d();
  const inset = 0.15;
  c.clearRect(0, 0, GRID, GRID);
  c.drawImage(src, sx + sw * inset, sy + sh * inset, sw * (1 - 2 * inset), sh * (1 - 2 * inset), 0, 0, GRID, GRID);
  const px = c.getImageData(0, 0, GRID, GRID).data;
  const v = new Float32Array(GRID * GRID * 3);
  for (let i = 0, j = 0; i < px.length; i += 4) { v[j++] = px[i]; v[j++] = px[i + 1]; v[j++] = px[i + 2]; }
  return normalize(v);
}

function normalize(v: Float32Array): Float32Array {
  let mean = 0;
  for (const x of v) mean += x;
  mean /= v.length;
  let sd = 0;
  for (const x of v) sd += (x - mean) ** 2;
  sd = Math.sqrt(sd / v.length) || 1;
  for (let i = 0; i < v.length; i++) v[i] = (v[i] - mean) / sd;
  return v;
}

// Correlación entre dos huellas: 1 = idénticas, 0 = sin relación
export function similarity(a: Descriptor, b: Descriptor | number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s / a.length;
}

export interface Match { id: string; score: number; second: number }
// Mejor candidato entre referencias (CDN) y muestras aprendidas (pesan algo más: son del propio juego)
export function classify(d: Descriptor, refs: Map<string, Descriptor>, learned: Record<string, number[][]>, candidates: Set<string>): Match | null {
  const best: { id: string; score: number }[] = [];
  for (const id of candidates) {
    let s = -1;
    const r = refs.get(id);
    if (r) s = similarity(d, r);
    for (const l of learned[id] ?? []) s = Math.max(s, similarity(d, l) + 0.05);
    if (s > -1) best.push({ id, score: s });
  }
  if (best.length === 0) return null;
  best.sort((x, y) => y.score - x.score);
  return { id: best[0].id, score: best[0].score, second: best[1]?.score ?? -1 };
}

// ¿Se parece lo suficiente al hueco vacío que se fotografió al calibrar?
export const isEmpty = (d: Descriptor, empty: number[] | undefined) => !!empty && similarity(d, empty) > 0.85;
// Umbrales para aceptar una detección sin preguntar
export const ACCEPT = { min: 0.5, margin: 0.04 };
export const confident = (m: Match | null) => !!m && m.score >= ACCEPT.min && m.score - m.second >= ACCEPT.margin;

// Las fotos de Brawlify se piden por /cdn (proxy de Vite) para poder leer sus píxeles
export const sameOrigin = (url: string) => url.replace(/^https:\/\/cdn\.brawlify\.com/, '/cdn');
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = sameOrigin(url);
  });
}

// Zonas de la pantalla del draft que el usuario marca una vez (coordenadas 0-1 del vídeo)
export type ZoneKind = 'ban' | 'pick' | 'map';
export interface Zone { key: string; kind: ZoneKind; team: 'blue' | 'red'; slot: number; x: number; y: number; w: number; h: number }
export const ZONE_DEFS: { key: string; kind: ZoneKind; team: 'blue' | 'red'; slot: number; label: string }[] = [
  ...[0, 1, 2].map((i) => ({ key: `ban-blue-${i}`, kind: 'ban' as const, team: 'blue' as const, slot: i, label: `Ban nuestro ${i + 1}` })),
  ...[0, 1, 2].map((i) => ({ key: `ban-red-${i}`, kind: 'ban' as const, team: 'red' as const, slot: i, label: `Ban rival ${i + 1}` })),
  ...['FP', 'MID', 'LAST'].map((n, i) => ({ key: `pick-blue-${i}`, kind: 'pick' as const, team: 'blue' as const, slot: i, label: `Pick nuestro ${n}` })),
  ...['FP', 'MID', 'LAST'].map((n, i) => ({ key: `pick-red-${i}`, kind: 'pick' as const, team: 'red' as const, slot: i, label: `Pick rival ${n}` })),
  // Opcional: imagen o nombre del mapa en la pantalla del draft. Aprende cada mapa la primera vez que lo eliges
  { key: 'map', kind: 'map' as const, team: 'blue' as const, slot: 0, label: 'Mapa (opcional)' }
];
