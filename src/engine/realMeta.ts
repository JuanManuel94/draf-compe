import RAW from '../data/realMeta.json';
import type { RealBrawlerStats, RealMeta } from '../data/realMetaTypes';

// Meta Ranked REAL (brawlbetter.com, partidas de jugadores top). Se regenera con `npm run meta:update`.
export const REAL_META = RAW as RealMeta;

const clamp = (v: number) => Math.max(0, Math.min(100, v));
// Con pocas partidas un 70% no significa nada: el winrate se "contrae" hacia la media del modo
// (prior de K partidas). Así 66% en 165 partidas pesa mucho más que 66% en 38.
const K = 60;

export function realOf(mapId: string, brawlerId: string): RealBrawlerStats | null {
  return REAL_META.maps[mapId]?.brawlers[brawlerId] ?? null;
}
export const hasRealMap = (mapId: string) => !!REAL_META.maps[mapId] && Object.keys(REAL_META.maps[mapId].brawlers).length > 0;

export function shrunkWinRate(r: RealBrawlerStats): number {
  const prior = r.modeGames >= 50 ? r.modeWr : 0.5;
  return (r.wr * r.games + prior * K) / (r.games + K);
}

// Puntuación 0-100 en el mapa (50 = 50% de victorias; cada punto de winrate ≈ 3 puntos) y cuánto fiarse (0-0.85)
export function realMapScore(r: RealBrawlerStats): { score: number; weight: number } {
  return { score: clamp(50 + (shrunkWinRate(r) - 0.5) * 300), weight: Math.min(0.85, r.games / (r.games + 80)) };
}

// Meta global del brawler: winrate y presencia medios en todos los mapas medidos (ponderado por partidas)
const GLOBAL: Record<string, { wr: number; pick: number; games: number }> = (() => {
  const acc: Record<string, { w: number; p: number; g: number; n: number }> = {};
  for (const m of Object.values(REAL_META.maps)) {
    for (const [id, r] of Object.entries(m.brawlers)) {
      const a = (acc[id] ??= { w: 0, p: 0, g: 0, n: 0 });
      a.w += shrunkWinRate(r) * r.games; a.g += r.games; a.p += r.pick; a.n += 1;
    }
  }
  const mapsCount = Math.max(1, Object.keys(REAL_META.maps).length);
  return Object.fromEntries(Object.entries(acc).map(([id, a]) => [id, { wr: a.w / a.g, pick: a.p / mapsCount, games: a.g }]));
})();

export function realGlobal(brawlerId: string) {
  return GLOBAL[brawlerId] ?? null;
}
// Fuerza en el meta (0-100): winrate global + bonus por presencia (lo que la gente de verdad juega)
export function realCompetitive(brawlerId: string): number | null {
  const g = GLOBAL[brawlerId];
  if (!g || g.games < 100) return null;
  return clamp(50 + (g.wr - 0.5) * 260 + Math.min(15, g.pick * 60));
}
export function blindSafety(brawlerId: string): number | null {
  return REAL_META.blindSafety[brawlerId] ?? null;
}

const RELIABILITY: Record<string, string> = { solid: 'fiable', fair: 'bastante fiable', early: 'muestra pequeña' };
export function realLabel(r: RealBrawlerStats): string {
  return `${Math.round(r.wr * 100)}% de victorias en ${r.games} partidas Ranked (${RELIABILITY[r.reliability] ?? r.reliability})`;
}
