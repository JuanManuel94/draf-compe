// Meta Ranked real por mapa (generado por scripts/update-meta.ts desde brawlbetter.com)
export interface RealBrawlerStats {
  wr: number; // winrate en este mapa (0-1)
  games: number; // partidas medidas en este mapa
  pick: number; // % de partidas del mapa en las que aparece (0-1)
  modeWr: number; // winrate medio en el modo (0-1)
  modeGames: number;
  reliability: string; // early | fair | solid
  verdict: string; // strong | safe-early | strong-late | promising | avoid...
}
export interface RealMapStats {
  slug: string;
  battles: number;
  lastPlayed: string;
  inRotation: boolean;
  brawlers: Record<string, RealBrawlerStats>;
}
export interface RealMeta {
  source: string;
  updatedAt: string;
  windowDays: number;
  blindSafety: Record<string, number>; // 1-10: lo seguro que es pickearlo a ciegas
  maps: Record<string, RealMapStats>;
}
