// Tipos centrales. Separados de la lógica para migrar a Prisma/Postgres sin cambios.

export type Rarity = 'Inicial' | 'Especial' | 'Superespecial' | 'Épica' | 'Mítica' | 'Legendaria' | 'Ultralegendaria';
// Mi colección: ok = maxeado/listo, low = lo tengo a bajo nivel, no = no lo tengo
export type Ownership = 'ok' | 'low' | 'no';
export type Role = 'Control' | 'Daño' | 'Apoyo' | 'Tanque' | 'Asesino' | 'Francotirador' | 'Artillería';
export type GameMode = 'Atrapagemas' | 'Balón Brawl' | 'Recompensa' | 'Noqueo' | 'Atraco' | 'Zona Restringida';

export interface Brawler {
  id: string;
  name: string;
  rarity: Rarity;
  roles: Role[];
  range: 'Corto' | 'Medio' | 'Largo';
  mobility: number; // 1-5 (estimación estratégica, NO oficial)
  survivability: number; // 1-5
  damage: number; // 1-5
  utility: number; // 1-5
  strengths: string[];
  weaknesses: string[];
  favoredModes: GameMode[];
  favoredMaps: string[]; // ids de mapa
  synergies: string[]; // ids de brawler
  counters: string[]; // ids a los que contrarresta (ventaja)
  weakAgainst: string[]; // ids que lo contrarrestan
  gadgetDependent: boolean;
  updatedAt: string;
  color: string; // color retrato
  emoji: string; // retrato provisional (sin assets oficiales)
  image?: string; // foto real (CDN comunidad, © Supercell)
  curated?: boolean; // true = ficha detallada local; false = perfil estimado por clase
}

export interface GameMap {
  id: string;
  name: string;
  mode: GameMode;
  description: string;
  walls: number; // 1-5
  bushes: number; // 1-5
  openness: number; // 1-5 (5 = muy abierto)
  controlZones: number; // 1-5
  rangeBias: 'Corta' | 'Mixta' | 'Larga';
  image: string; // emoji / gradiente provisional
  photo?: string; // foto real del mapa (CDN comunidad, © Supercell)
}

export type MatchupRating = 'hardCounter' | 'favorable' | 'neutral' | 'unfavorable' | 'hardCountered';

export interface Matchup {
  attacker: string; // id brawler que eliges
  defender: string; // id rival
  rating: MatchupRating;
  note: string;
  confidence: 'alta' | 'media' | 'baja';
  mapDependent?: boolean;
}

export interface Weights {
  mapMode: number; // 0.30
  matchup: number; // 0.30
  synergy: number; // 0.20
  competitive: number; // 0.10
  flex: number; // 0.10
}

export interface DataSource {
  source: string;
  updatedAt: string;
  confidence: 'alta' | 'media' | 'baja';
  isEstimate: boolean;
}

export interface Recommendation {
  brawlerId: string;
  score: number; // 0-100 normalizado
  parts: { mapMode: number; matchup: number; synergy: number; competitive: number; flex: number };
  explanation: string;
  weaknesses: string[];
  alternatives: string[];
  multiCounter: number; // nº de rivales a los que responde (>=60)
  counterRisk: number; // 0-100 riesgo de ser contrarrestado
  confidence: 'alta' | 'media' | 'baja';
  safeBlind: boolean; // pick seguro a ciegas (poco riesgo + flexible): ideal temprano
}

export type DraftPhase = 'coin' | 'globalban' | 'ban' | 'pick' | 'done';
export type Team = 'blue' | 'red';

export interface DraftAction {
  kind: 'pick' | 'ban' | 'globalban' | 'coin' | 'undo-marker';
  team: Team | null;
  brawlerId: string | null;
  slot?: number | null; // hueco exacto del pick (para orden FP/MID/LAST)
  at: number;
}

export interface DraftState {
  mode: GameMode;
  mapId: string;
  formatId: string;
  strict: boolean;
  freeMode: boolean;
  coinWinner: Team | null;
  globalBansBlue: string[];
  globalBansRed: string[];
  bansBlue: string[];
  bansRed: string[];
  picksBlue: (string | null)[];
  picksRed: (string | null)[];
  turnIndex: number;
  phase: DraftPhase;
  history: DraftAction[];
  future: DraftAction[];
}

export interface DraftFormat {
  id: string;
  name: string;
  description: string;
  bansPerTeam: number; // bans de set (BSC 2026: 3, uno por jugador)
  globalBansPerTeam: number; // bans globales de match (BSC 2026 pre-season: 2)
  blindBans: boolean; // BSC 2026: baneos ciegos
  coinFlip: boolean; // sorteo inicial de quién empieza
  freeOrder?: boolean; // partida en vivo: tocar cualquier hueco sin orden estricto
  pickOrder: Team[]; // 6 entradas desde la perspectiva del ganador del sorteo
}

export interface CompetitiveStat {
  brawlerId: string;
  winRate: number; // 0-1 (EJEMPLO, no oficial)
  pickRate: number; // 0-1 (EJEMPLO)
  tournaments: number;
}
