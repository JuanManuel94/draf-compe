import type { CompetitiveStat, DraftFormat, Matchup } from '../types';

// EJEMPLO — no oficial. Fuente: "dataset-ejemplo-local v0.1".
export const STATS: CompetitiveStat[] = [
  { brawlerId: 'piper', winRate: 0.58, pickRate: 0.34, tournaments: 42 },
  { brawlerId: 'belle', winRate: 0.57, pickRate: 0.31, tournaments: 42 },
  { brawlerId: 'gale', winRate: 0.56, pickRate: 0.29, tournaments: 40 },
  { brawlerId: 'max', winRate: 0.55, pickRate: 0.33, tournaments: 41 },
  { brawlerId: 'emz', winRate: 0.55, pickRate: 0.27, tournaments: 38 },
  { brawlerId: 'spike', winRate: 0.54, pickRate: 0.30, tournaments: 42 },
  { brawlerId: 'mortis', winRate: 0.53, pickRate: 0.36, tournaments: 43 },
  { brawlerId: 'lou', winRate: 0.53, pickRate: 0.24, tournaments: 35 },
  { brawlerId: 'stu', winRate: 0.52, pickRate: 0.32, tournaments: 40 },
  { brawlerId: 'colt', winRate: 0.52, pickRate: 0.28, tournaments: 39 },
  { brawlerId: 'sandy', winRate: 0.52, pickRate: 0.22, tournaments: 33 },
  { brawlerId: 'frank', winRate: 0.51, pickRate: 0.25, tournaments: 36 },
  { brawlerId: 'mandy', winRate: 0.51, pickRate: 0.21, tournaments: 30 },
  { brawlerId: 'rosa', winRate: 0.50, pickRate: 0.23, tournaments: 34 },
  { brawlerId: 'gene', winRate: 0.50, pickRate: 0.20, tournaments: 31 },
  { brawlerId: 'crow', winRate: 0.50, pickRate: 0.19, tournaments: 29 },
  { brawlerId: 'tara', winRate: 0.49, pickRate: 0.18, tournaments: 28 },
  { brawlerId: 'poco', winRate: 0.49, pickRate: 0.24, tournaments: 35 },
  { brawlerId: 'shelly', winRate: 0.48, pickRate: 0.26, tournaments: 37 },
  { brawlerId: 'edgar', winRate: 0.48, pickRate: 0.30, tournaments: 38 },
  { brawlerId: '8-bit', winRate: 0.47, pickRate: 0.17, tournaments: 27 },
  { brawlerId: 'bull', winRate: 0.46, pickRate: 0.21, tournaments: 30 },
  { brawlerId: 'el-primo', winRate: 0.46, pickRate: 0.20, tournaments: 29 },
  { brawlerId: 'pam', winRate: 0.45, pickRate: 0.16, tournaments: 26 }
];

export const FORMATS: DraftFormat[] = [
  { id: 'live', name: 'Partida en vivo / Ranked', description: 'Para usar durante la partida: 3 bans visibles por equipo (primero azul, luego rojo), sin sorteo ni orden. Toca cualquier hueco.', bansPerTeam: 3, globalBansPerTeam: 0, blindBans: false, coinFlip: false, freeOrder: true, pickOrder: ['blue', 'red', 'red', 'blue', 'blue', 'red'] },
  { id: 'bsc-stage', name: 'Torneo BSC (stage)', description: 'Pro: sorteo, 2 bans globales de match + 3 bans ciegos de set (1 por jugador). Rulebook v1.6.', bansPerTeam: 3, globalBansPerTeam: 2, blindBans: true, coinFlip: true, pickOrder: ['blue', 'red', 'red', 'blue', 'blue', 'red'] }
];

// Generada desde brawlers.counters / weakAgainst + notas. Estimación estratégica.
function buildMatchups(): Matchup[] {
  const out: Matchup[] = [];
  const push = (a: string, d: string, rating: Matchup['rating'], note: string, confidence: Matchup['confidence'] = 'media', mapDependent = false) =>
    out.push({ attacker: a, defender: d, rating: rating, note, confidence, mapDependent });
  push('shelly', 'bull', 'hardCounter', 'Ráfaga a quemarropa + súper frena el engage.', 'alta');
  push('shelly', 'el-primo', 'hardCounter', 'Mismo plan: lo borra antes de que conecte.', 'media');
  push('mortis', 'piper', 'hardCounter', 'Dash + burst: Piper no puede escapar en abierto.', 'alta');
  push('mortis', 'colt', 'favorable', 'Esquiva líneas de Colt y lo castiga.', 'media', true);
  push('emz', 'bull', 'favorable', 'Kitea tanques con slow + rango medio.', 'media');
  push('gale', 'bull', 'favorable', 'Empujón corta el engage en muros.', 'media', true);
  push('gale', 'el-primo', 'favorable', 'Similar: interrumpe salto.', 'media');
  push('piper', 'frank', 'favorable', 'Pokea desde lejos sin respuesta.', 'alta', true);
  push('belle', 'pam', 'favorable', 'Castiga objetivos estáticos y torretas.', 'media');
  push('spike', 'rosa', 'favorable', 'Súper + poke derriten tanques lentos.', 'media', true);
  push('stu', 'piper', 'favorable', 'Súper en ciclo la persigue sin parar.', 'media');
  push('stu', 'belle', 'favorable', 'Presión constante contra snipers.', 'media');
  push('edgar', 'piper', 'hardCounter', 'Salto encima = kill casi gratis.', 'alta');
  push('edgar', 'colt', 'favorable', 'Cierra distancia y lo burstéa.', 'media');
  push('rosa', 'mortis', 'favorable', 'Aguanta el combo y lo devuelve.', 'media');
  push('shelly', 'mortis', 'favorable', 'Escopetazo frena el dive.', 'media');
  push('lou', 'bull', 'favorable', 'Freeze + slow controlan tanques.', 'media');
  push('crow', 'poco', 'favorable', 'Veneno reduce la curación efectiva.', 'baja', true);
  push('gene', 'frank', 'favorable', 'Mano saca a Frank de la zona.', 'baja', true);
  return out;
}
export const MATCHUPS: Matchup[] = buildMatchups();
