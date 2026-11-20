import { BRAWLERS } from '../data/brawlers';
import { MAPS } from '../data/maps';
import { MATCHUPS, STATS } from '../data/meta';
import { ROSTER, brawlerImg } from '../data/roster';
import { RESEARCHED_MATCHUPS, MAP_BOOST, RESEARCHED, metaOf } from '../data/counters';
import { REAL_META, blindSafety, hasRealMap, realCompetitive, realLabel, realMapScore, realOf } from './realMeta';
import { COUNTERS_DATA, COVERED, liveMatchup, roundAround50, weakToRole } from './liveCounters';
import type { Brawler, GameMap, GameMode, MatchupRating, Ownership, Recommendation, Role, Weights } from '../types';

export const DEFAULT_WEIGHTS: Weights = { mapMode: 0.3, matchup: 0.3, synergy: 0.2, competitive: 0.1, flex: 0.1 };
export const DATA_SOURCE = `BrawlAPI/Brawlify (catálogo e imágenes © Supercell) + meta Ranked real de ${REAL_META.source.split(' ')[0]} (${REAL_META.updatedAt}) + counters de ${COUNTERS_DATA.source.split('/')[0]} (${COUNTERS_DATA.updatedAt}) + fichas propias de estimación`;
export { metaOf };

// ---------- Roster extendido: 24 fichas detalladas + resto estimado por clase ----------
const CLASS_RANGE: Record<Role, Brawler['range']> = {
  Tanque: 'Corto', Asesino: 'Corto', Apoyo: 'Medio', Control: 'Medio', Daño: 'Medio', Artillería: 'Largo', Francotirador: 'Largo'
};
const CLASS_BASE: Record<Role, { mobility: number; survivability: number; damage: number; utility: number }> = {
  Tanque: { mobility: 2, survivability: 5, damage: 3, utility: 2 },
  Asesino: { mobility: 4, survivability: 2, damage: 4, utility: 2 },
  Apoyo: { mobility: 2, survivability: 3, damage: 2, utility: 5 },
  Control: { mobility: 2, survivability: 3, damage: 3, utility: 5 },
  Daño: { mobility: 2, survivability: 2, damage: 4, utility: 2 },
  Artillería: { mobility: 2, survivability: 2, damage: 4, utility: 3 },
  Francotirador: { mobility: 2, survivability: 2, damage: 5, utility: 2 }
};
const CLASS_MODES: Record<Role, GameMode[]> = {
  Tanque: ['Balón Brawl', 'Zona Restringida'],
  Asesino: ['Balón Brawl', 'Noqueo'],
  Apoyo: ['Atrapagemas', 'Zona Restringida'],
  Control: ['Zona Restringida', 'Atrapagemas'],
  Daño: ['Atrapagemas', 'Atraco'],
  Artillería: ['Atraco', 'Zona Restringida'],
  Francotirador: ['Noqueo', 'Recompensa']
};
const RARITY_COLOR: Record<string, string> = {
  Inicial: '#9ca3af', Especial: '#4ade80', Superespecial: '#38bdf8', Épica: '#c084fc', Mítica: '#f87171', Legendaria: '#fbbf24', Ultralegendaria: '#e879f9'
};

let ALL_CACHE: Brawler[] | null = null;

export function getAllBrawlers(): Brawler[] {
  if (ALL_CACHE) return ALL_CACHE;
  const curatedKeys = new Set(BRAWLERS.map((b) => b.id));
  const generated: Brawler[] = ROSTER.filter(([key]) => !curatedKeys.has(key)).map(([key, apiId, name, rarity, role]) => {
    const base = CLASS_BASE[role];
    return {
      id: key, name, rarity, roles: [role], range: CLASS_RANGE[role],
      mobility: base.mobility, survivability: base.survivability, damage: base.damage, utility: base.utility,
      strengths: [`Perfil de ${role} (estimación por clase)`],
      weaknesses: ['Sin ficha detallada: úsalo con cautela en competitivo'],
      favoredModes: CLASS_MODES[role], favoredMaps: [],
      synergies: [], counters: [], weakAgainst: [],
      gadgetDependent: false, updatedAt: '2026-10-10',
      color: RARITY_COLOR[rarity] ?? '#9ca3af', emoji: '🆕',
      image: brawlerImg(apiId), curated: false
    } as Brawler;
  });
  const withImages = BRAWLERS.map((b) => {
    const row = ROSTER.find(([k]) => k === b.id);
    return { ...b, image: row ? brawlerImg(row[1]) : undefined, curated: true };
  });
  ALL_CACHE = [...withImages, ...generated];
  return ALL_CACHE;
}

export function brawlerById(id: string | null): Brawler | null {
  if (!id) return null;
  return getAllBrawlers().find((b) => b.id === id) ?? null;
}

const roleOf = (id: string): Role => brawlerById(id)?.roles[0] ?? 'Daño';

// Matriz de clases (ESTIMACIÓN genérica, confianza baja): atacante -> defensor
const CLASS_MATRIX: Record<Role, Partial<Record<Role, MatchupRating>>> = {
  Asesino: { Francotirador: 'hardCounter', Daño: 'favorable', Apoyo: 'favorable', Artillería: 'favorable', Tanque: 'unfavorable' },
  Tanque: { Asesino: 'favorable', Daño: 'neutral', Francotirador: 'unfavorable', Control: 'unfavorable', Artillería: 'unfavorable' },
  Francotirador: { Tanque: 'favorable', Control: 'favorable', Apoyo: 'favorable', Daño: 'neutral', Asesino: 'hardCountered' },
  Control: { Tanque: 'favorable', Asesino: 'favorable', Daño: 'neutral', Francotirador: 'unfavorable' },
  Apoyo: { Tanque: 'favorable', Asesino: 'unfavorable', Daño: 'neutral' },
  Daño: { Apoyo: 'favorable', Asesino: 'unfavorable', Tanque: 'neutral' },
  Artillería: { Tanque: 'favorable', Control: 'favorable', Asesino: 'unfavorable', Francotirador: 'unfavorable' }
};

const RATING_SCORE: Record<MatchupRating, number> = {
  hardCounter: 100, favorable: 75, neutral: 50, unfavorable: 25, hardCountered: 0
};

type MatchupResult = { score: number; note: string; confidence: string; mapDependent: boolean };
type RawMatchup = MatchupResult & { level: number }; // level: 0 = fuente más fiable

// Lo que dice cada fuente sobre "atacante contra defensor", sin mirar la dirección contraria
function rawMatchup(attackerId: string, defenderId: string): RawMatchup {
  // 0º counters descargados de TODOS los brawlers (brawlcalculator, se actualiza con npm run counters:update)
  const live = liveMatchup(attackerId, defenderId);
  if (live) return { score: live.score, note: live.note, confidence: live.confidence, mapDependent: true, level: 0 };
  // 1º datos investigados a mano (jul-2026), 2º fichas propias, 3º debilidad por clase, 4º estimación por clases
  const r = RESEARCHED_MATCHUPS.find((x) => x.attacker === attackerId && x.defender === defenderId);
  if (r) return { score: RATING_SCORE[r.rating], note: r.note + ' (investigado).', confidence: r.confidence, mapDependent: !!r.mapDependent, level: 1 };
  const m = MATCHUPS.find((x) => x.attacker === attackerId && x.defender === defenderId);
  if (m) return { score: RATING_SCORE[m.rating], note: m.note, confidence: m.confidence, mapDependent: !!m.mapDependent, level: 2 };
  const a = brawlerById(attackerId);
  if (a?.counters.includes(defenderId)) return { score: 75, note: 'Ventaja declarada en ficha (estimación).', confidence: 'baja', mapDependent: true, level: 2 };
  if (a?.weakAgainst.includes(defenderId)) return { score: 25, note: 'Desventaja declarada en ficha (estimación).', confidence: 'baja', mapDependent: true, level: 2 };
  const d = brawlerById(defenderId);
  if (a && weakToRole(defenderId, a.roles)) return { score: 68, note: `${d?.name ?? 'El rival'} sufre contra los ${a.roles[0].toLowerCase()} (debilidad de clase).`, confidence: 'media', mapDependent: true, level: 3 };
  if (a && d && weakToRole(attackerId, d.roles)) return { score: 32, note: `${a.name} sufre contra los ${d.roles[0].toLowerCase()} (debilidad de clase).`, confidence: 'media', mapDependent: true, level: 3 };
  const rating = CLASS_MATRIX[roleOf(attackerId)]?.[roleOf(defenderId)] ?? 'neutral';
  const label: Record<MatchupRating, string> = {
    hardCounter: 'su clase suele cazar a la del rival', favorable: 'su clase tiene ventaja genérica',
    neutral: 'sin ventaja clara por clase', unfavorable: 'su clase suele sufrir contra la del rival',
    hardCountered: 'su clase es cazada por la del rival'
  };
  return { score: RATING_SCORE[rating], note: `Estimación por clases: ${label[rating]}.`, confidence: 'baja', mapDependent: true, level: 4 };
}

// Duelo coherente en las dos direcciones: siempre matchupScore(a, d) + matchupScore(d, a) = 100.
// Manda la fuente más fiable de las dos; si son igual de fiables, se promedian.
const MATCHUP_CACHE = new Map<string, MatchupResult>();
export function matchupScore(attackerId: string, defenderId: string): MatchupResult {
  const key = `${attackerId}|${defenderId}`;
  const hit = MATCHUP_CACHE.get(key);
  if (hit) return hit;
  const f = rawMatchup(attackerId, defenderId);
  const b = rawMatchup(defenderId, attackerId);
  let out: MatchupResult;
  if (f.level < b.level) out = f;
  else if (b.level < f.level) out = { score: 100 - b.score, note: `Lo sufre: ${b.note}`, confidence: b.confidence, mapDependent: b.mapDependent };
  else if (f.level === 0) out = f; // los counters descargados ya juntan las dos direcciones
  else out = { score: roundAround50((f.score + 100 - b.score) / 2), note: f.score >= 50 ? f.note : `Lo sufre: ${b.note}`, confidence: f.confidence, mapDependent: f.mapDependent || b.mapDependent };
  MATCHUP_CACHE.set(key, out);
  return out;
}

// --- Counter VÁLIDO = gana el duelo Y rinde en el mapa ---
// Un counter que va mal en el mapa casi no aporta: su ventaja sobre 50 se recorta según el mapa.
export const MAP_OK = 55; // nota de mapa mínima para considerar que "va bien en el mapa"
export function mapGate(mapScore: number): number {
  if (mapScore >= 62) return 1;
  if (mapScore >= MAP_OK) return 0.75 + ((mapScore - MAP_OK) / (62 - MAP_OK)) * 0.25;
  if (mapScore >= 45) return 0.3 + ((mapScore - 45) / (MAP_OK - 45)) * 0.45;
  return 0.2;
}
export function gatedMatchup(matchup: number, mapScore: number): number {
  return matchup > 50 ? 50 + (matchup - 50) * mapGate(mapScore) : matchup;
}

export interface MapCounter { brawlerId: string; matchup: number; map: number; combined: number; note: string }
// Mejores counters de un rival EN ESTE MAPA: tienen que ganar el duelo (>= 65) y rendir en el mapa (>= MAP_OK).
export function countersOnMap(mapId: string, enemyId: string, excluded: string[] = [], n = 3): MapCounter[] {
  const map = MAPS.find((m) => m.id === mapId) ?? MAPS[0];
  const ex = new Set([...excluded, enemyId]);
  return getAllBrawlers().filter((b) => !ex.has(b.id))
    .map((b) => {
      const m = matchupScore(b.id, enemyId);
      const ms = mapModeScore(b, map);
      return { brawlerId: b.id, matchup: m.score, map: ms, combined: Math.round(Math.sqrt(m.score * ms)), note: m.note };
    })
    .filter((c) => c.matchup >= 65 && c.map >= MAP_OK)
    .sort((x, y) => y.combined - x.combined || y.matchup - x.matchup)
    .slice(0, n);
}

export function mapModeScore(b: Brawler, map: GameMap): number {
  const est = estimatedMapScore(b, map);
  const r = realOf(map.id, b.id);
  // Mapa con datos Ranked pero este brawler no sale entre los destacados ni entre los que pierden:
  // o es del montón o casi no se juega. Su estimación se acerca a la media en vez de competir con los medidos.
  if (!r) return hasRealMap(map.id) ? Math.round(50 + (est - 50) * 0.35) : est;
  const { score, weight } = realMapScore(r);
  return Math.round(est * (1 - weight) + score * weight);
}

function estimatedMapScore(b: Brawler, map: GameMap): number {
  let s = 50;
  if (b.favoredModes.includes(map.mode)) s += 18;
  // Alias de mapas legacy (rotaciones anteriores) al pool competitivo actual
  const ALIAS: Record<string, string[]> = {
    'gem-shooting-star': ['bounty-shooting-star', 'bounty-hideout', 'bounty-layer-cake', 'bounty-dry-season'],
    'knockout-belle-rock': ['ko-belles-rock', 'ko-flaring-phoenix', 'ko-open', 'ko-new-horizons', 'ko-goldarm-gulch', 'ko-flowing-springs'],
    'knockout-out-law': ['ko-flaring-phoenix'],
    'hot-ring': ['hz-ring-of-fire', 'hz-beetles', 'hz-parallel'],
    'hot-open-business': ['hz-open-business'],
    'brawl-ball-center': ['bb-triple-dribble', 'bb-palco-central', 'bb-pinball-dreams'],
    'brawl-ball-sneaky': ['bb-sneaky-fields']
  };
  const fav = new Set([...b.favoredMaps, ...b.favoredMaps.flatMap((f) => ALIAS[f] ?? []), ...(MAP_BOOST[b.id] ?? [])]);
  if (fav.has(map.id)) s += 14;
  if (map.openness >= 4 && b.range === 'Largo') s += 10;
  if (map.openness >= 4 && b.range === 'Corto') s -= 12;
  if (map.bushes >= 4 && b.range === 'Corto') s += 6;
  if (map.controlZones >= 4 && b.roles.includes('Control')) s += 8;
  if (map.controlZones >= 4 && b.utility >= 4) s += 4;
  return Math.max(0, Math.min(100, s));
}

function matchupPart(b: Brawler, enemies: string[], mapScore: number): { avg: number; multi: number; risk: number; rawMulti: number } {
  if (enemies.length === 0) return { avg: 55, multi: 0, risk: 20, rawMulti: 0 };
  const raw = enemies.map((e) => matchupScore(b.id, e).score);
  // Cada duelo ganado solo cuenta entero si además rinde en el mapa
  const scores = raw.map((s) => gatedMatchup(s, mapScore));
  const avg = scores.reduce((a, c) => a + c, 0) / scores.length;
  const rawMulti = raw.filter((s) => s >= 70).length;
  const multi = mapScore >= MAP_OK ? rawMulti : 0;
  const riskScores = enemies.map((e) => matchupScore(e, b.id).score);
  const risk = riskScores.reduce((a, c) => a + c, 0) / riskScores.length;
  return { avg, multi, risk, rawMulti };
}

function synergyPart(b: Brawler, allies: string[], map: GameMap): number {
  if (allies.length === 0) return 55;
  let s = 50;
  for (const a of allies) {
    if (b.synergies.includes(a)) s += 14;
    if (brawlerById(a)?.synergies.includes(b.id)) s += 8;
    // sinergia genérica apoyo↔tanque
    const ra = roleOf(a);
    if ((b.roles[0] === 'Apoyo' && ra === 'Tanque') || (b.roles[0] === 'Tanque' && ra === 'Apoyo')) s += 8;
  }
  const roles = new Set<string>();
  [...allies, b.id].forEach((id) => brawlerById(id)?.roles.forEach((r) => roles.add(r)));
  if (roles.size >= 3) s += 6;
  // Tercer brawler del mismo rol = composición coja (p. ej. tres asesinos)
  const sameRole = allies.filter((a) => roleOf(a) === b.roles[0]).length;
  if (sameRole >= 2) s -= 18; else if (sameRole === 1 && allies.length === 2) s -= 6;
  // Alcance: en mapas abiertos hace falta al menos un brawler de rango largo, en cerrados uno de corto
  const ranges = allies.map((a) => brawlerById(a)?.range);
  if (map.rangeBias === 'Larga' && !ranges.includes('Largo') && b.range === 'Largo') s += 10;
  if (map.rangeBias === 'Corta' && !ranges.includes('Corto') && b.range === 'Corto') s += 8;
  return Math.max(0, Math.min(100, s));
}

function competitivePart(brawlerId: string): number {
  // 1º meta Ranked real (winrate y presencia en todos los mapas), mezclado con el tier investigado;
  // 2º tier investigado oct-2026; 3º stats de ejemplo; 4º neutral
  const real = realCompetitive(brawlerId);
  const meta = metaOf(brawlerId);
  if (real !== null) return Math.round(meta.score !== null ? real * 0.65 + meta.score * 0.35 : real);
  if (meta.score !== null) return meta.score;
  const st = STATS.find((s) => s.brawlerId === brawlerId);
  if (!st) return 50;
  return Math.max(0, Math.min(100, st.winRate * 70 + st.pickRate * 30));
}

export function metaLabel(brawlerId: string): string | null {
  // Primero el meta medido (Ranked real de todos los mapas); si no hay datos, la lista investigada de oct-2026
  const real = realCompetitive(brawlerId);
  if (real !== null) {
    const t = real >= 72 ? 'Meta S' : real >= 60 ? 'Meta A' : real < 42 ? 'Flojo en meta' : 'Neutro';
    return `${t} (Ranked real, ${REAL_META.updatedAt})`;
  }
  const m = metaOf(brawlerId);
  if (!m.tier && !m.buffy) return null;
  const t = m.tier === 'S' ? 'Meta S' : m.tier === 'A' ? 'Meta A' : m.tier === 'W' ? 'Flojo en meta' : 'Neutro';
  return `${t}${m.buffy ? ' · Buffies 🔥' : ''} (oct-2026)`;
}

function flexPart(b: Brawler, map: GameMap): number {
  let s = 45 + b.favoredModes.length * 4 + b.roles.length * 3;
  if (!b.gadgetDependent) s += 5;
  if (b.mobility >= 4) s += 5;
  if (map.rangeBias === 'Mixta') s += 4;
  // Seguridad a ciegas medida (1-10): lo difícil que es castigarlo si lo pickeas sin ver al rival
  const blind = blindSafety(b.id);
  if (blind !== null) s = s * 0.4 + blind * 10 * 0.6;
  return Math.max(0, Math.min(100, s));
}

export interface ScoreInput {
  mapId: string;
  allies: string[];
  enemies: string[];
  weights?: Weights;
  banned: string[];
  picked: string[];
  ownership?: Record<string, Ownership>;
}

export function scoreAll(input: ScoreInput): Recommendation[] {
  const base = input.weights ?? DEFAULT_WEIGHTS;
  const allySet = input.allies.filter(Boolean);
  const enemySet = input.enemies.filter(Boolean);
  // Pesos dinámicos según Nº de pick nuestro (snake 1-2-2-1, investigado):
  // FP = poder seguro de mapa (flex), MID = completar roles (sinergia), LAST = rematar counter (matchup).
  const w = { ...base };
  if (allySet.length === 0) {
    w.flex = Math.min(0.3, w.flex + 0.05); w.competitive = Math.max(0, w.competitive - 0.05);
  } else if (allySet.length === 1) {
    w.synergy = Math.min(0.4, w.synergy + 0.05); w.competitive = Math.max(0, w.competitive - 0.05);
  } else {
    w.matchup = Math.min(0.5, w.matchup + 0.1); w.mapMode = Math.max(0.1, w.mapMode - 0.05); w.flex = Math.max(0, w.flex - 0.05);
  }
  const map = MAPS.find((m) => m.id === input.mapId) ?? MAPS[0];
  const excluded = new Set([...input.banned, ...input.picked]);
  const own = input.ownership ?? {};
  for (const [id, st] of Object.entries(own)) if (st === 'no') excluded.add(id);
  const all = getAllBrawlers();

  const recs: Recommendation[] = all.filter((b) => !excluded.has(b.id)).map((b) => {
    const mapMode = mapModeScore(b, map);
    // ACOPLE counter×mapa: el duelo ganado solo cuenta entero si el brawler también rinde en el mapa
    const { avg, multi, risk, rawMulti } = matchupPart(b, enemySet, mapMode);
    const matchupAdj = avg;
    const synergy = synergyPart(b, allySet, map);
    const competitive = competitivePart(b.id);
    const flex = flexPart(b, map);
    const raw = mapMode * w.mapMode + matchupAdj * w.matchup + synergy * w.synergy + competitive * w.competitive + flex * w.flex;
    // DECISIONES FINALES: el riesgo pesa más cuanto menos se conoce del rival.
    // Temprano (0 rivales vistos) un pick countereable es una condena; tardío se puede apurar el counter.
    const unknownEnemies = Math.max(0, 3 - enemySet.length);
    const riskPenalty = risk * 0.35 * (unknownEnemies / 3);
    // Colección: sin tener = excluido (arriba); a bajo nivel = -15 y aviso
    const isLow = own[b.id] === 'low';
    const real = realOf(map.id, b.id);
    const early = allySet.length === 0;
    let verdictAdj = 0;
    if (real?.verdict === 'safe-early') verdictAdj += early ? 6 : 2;
    if (real?.verdict === 'strong-late') verdictAdj += early ? -7 : enemySet.length >= 2 ? 4 : 0;
    if (real?.verdict === 'avoid' || real?.verdict === 'overrated') verdictAdj -= 5;
    const score = Math.round(Math.max(0, Math.min(100, raw - riskPenalty + verdictAdj - (isLow ? 15 : 0))));
    const safeBlind = (risk <= 35 && flex >= 55) || real?.verdict === 'safe-early';
    const parts = { mapMode: Math.round(mapMode), matchup: Math.round(matchupAdj), synergy: Math.round(synergy), competitive: Math.round(competitive), flex: Math.round(flex) };
    const explanation = buildExplanation(b, map, enemySet, allySet, multi, parts, real ? realLabel(real) : null);
    const weaknesses = [...b.weaknesses];
    if (risk >= 65) weaknesses.push(`Alto riesgo de ser contrarrestado (${Math.round(risk)}/100) por el draft rival actual.`);
    if (rawMulti >= 1 && mapMode < MAP_OK && enemySet.length > 0) weaknesses.push(`Counterea pero NO rinde en ${map.name} (${Math.round(mapMode)}/100 en mapa): su counter casi no cuenta. Busca un counter que también vaya bien aquí.`);
    if (real?.verdict === 'strong-late') weaknesses.push(`Gana en ${map.name} pero es fácil de counterear: guárdalo para un pick tardío (datos Ranked).`);
    if (real?.verdict === 'avoid' || real?.verdict === 'overrated') weaknesses.push(`En ${map.name} pierde más de lo que gana: ${realLabel(real)}.`);
    if (isLow) weaknesses.push('Lo tienes a BAJO NIVEL: rinde por debajo de su potencial. Máxéalo o elige la alternativa.');
    const alternatives = all
      .filter((x) => x.id !== b.id && !excluded.has(x.id) && x.roles.some((r) => b.roles.includes(r)))
      .sort((x, y) => (own[x.id] === 'low' ? 1 : 0) - (own[y.id] === 'low' ? 1 : 0))
      .slice(0, 3).map((x) => x.id);
    const known = b.curated || RESEARCHED.has(b.id) || COVERED.has(b.id);
    const confidence = (real && real.reliability === 'solid' ? 'alta' : real ? 'media' : !known ? 'baja' : enemySet.length >= 2 || b.favoredMaps.includes(map.id) || (MAP_BOOST[b.id] ?? []).includes(map.id) ? 'media' : 'baja') as Recommendation['confidence'];
    return { brawlerId: b.id, score, parts, explanation, weaknesses, alternatives, multiCounter: multi, counterRisk: Math.round(risk), confidence, safeBlind };
  });
  return recs.sort((a, b) => b.score - a.score);
}

function buildExplanation(b: Brawler, map: GameMap, enemies: string[], allies: string[], multi: number, parts: Recommendation['parts'], realText: string | null): string {
  const job = allies.length === 0 ? 'FP' : allies.length === 1 ? 'MID' : 'LAST';
  const bits: string[] = [];
  if (job === 'FP') bits.push('primer pick: poder seguro de mapa');
  if (job === 'LAST') bits.push('último pick: remata el counter');
  if (realText && parts.mapMode >= 60) bits.push(`gana en ${map.name}: ${realText}`);
  else if (parts.mapMode >= 65) bits.push(`rinde bien en ${map.name} (${map.mode}, terreno ${map.rangeBias.toLowerCase()})`);
  if (multi >= 2) bits.push(`presiona a ${multi} rivales a la vez`);
  else if (multi === 1) {
    const target = enemies[0] ? brawlerById(enemies[0])?.name ?? 'rival' : 'rival';
    bits.push(`responde al pick rival (${target})`);
  }
  if (allies.length > 0 && parts.synergy >= 65) bits.push('complementa la composición aliada');
  if (parts.competitive >= 60) bits.push('fuerte en el meta Ranked actual');
  if (bits.length === 0) bits.push(b.curated ? 'opción flexible sin grandes pegas en este mapa' : 'perfil estimado por clase:opción flexible');
  return `${b.name} ${bits.join(', ')}.`;
}

// --- Guerra de counters ---
// A quién counterea `pickId` entre los enemigos (score >= 75)
export function countersVs(pickId: string, enemies: string[]): string[] {
  return enemies.filter((e) => matchupScore(pickId, e).score >= 75);
}
// Amenazas: enemigos que counterean a nuestros aliados (score >= 75 del enemigo hacia el aliado)
export function threatsTo(allies: string[], enemies: string[]): { ally: string; enemy: string; score: number; note: string }[] {
  const out: { ally: string; enemy: string; score: number; note: string }[] = [];
  for (const a of allies) for (const e of enemies) {
    const m = matchupScore(e, a);
    if (m.score >= 75) out.push({ ally: a, enemy: e, score: m.score, note: m.note });
  }
  return out.sort((x, y) => y.score - x.score);
}

// --- Veredicto final (draft cerrado: sin cambios posibles, solo plan de juego) ---
export interface Lane { name: string; blue: string; red: string; score: number; note: string }
export interface Verdict {
  blue: { map: number; counter: number; total: number; grade: string };
  red: { map: number; counter: number; total: number; grade: string };
  edge: 'blue' | 'red' | 'even';
  tip: string;
  winChance: number; // % estimado de victoria del azul (20-80: el draft no decide solo la partida)
  lanes: Lane[];
  roleWarnings: string[];
}

// --- Líneas: cada equipo se ordena de más alcance a más agresivo y se enfrentan línea a línea ---
const RANGE_ORDER: Record<Brawler['range'], number> = { Largo: 0, Medio: 1, Corto: 2 };
const LANE_NAMES = ['Línea larga (control)', 'Línea media', 'Línea agresiva'];
export function laneOrder(ids: string[]): string[] {
  return [...ids].sort((x, y) => {
    const bx = brawlerById(x); const by = brawlerById(y);
    return (bx ? RANGE_ORDER[bx.range] : 1) - (by ? RANGE_ORDER[by.range] : 1);
  });
}
export function lanes(allies: string[], enemies: string[]): Lane[] {
  if (allies.length < 3 || enemies.length < 3) return [];
  const b = laneOrder(allies); const r = laneOrder(enemies);
  return b.map((id, i) => {
    const m = matchupScore(id, r[i]);
    return { name: LANE_NAMES[i], blue: id, red: r[i], score: m.score, note: m.note };
  });
}
// Avisos de composición: roles repetidos o sin alcance largo/corto según el mapa
export function roleWarnings(ids: string[], map: GameMap): string[] {
  const out: string[] = [];
  const roles = ids.map((id) => roleOf(id));
  const counts = roles.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r]: (acc[r] ?? 0) + 1 }), {});
  for (const [role, n] of Object.entries(counts)) if (n >= 2) out.push(`${n} brawlers de ${role.toLowerCase()}: composición poco equilibrada.`);
  const ranges = ids.map((id) => brawlerById(id)?.range);
  if (ids.length >= 2 && map.rangeBias === 'Larga' && !ranges.includes('Largo')) out.push(`${map.name} es abierto y no hay nadie de rango largo.`);
  if (ids.length >= 2 && map.rangeBias === 'Corta' && !ranges.includes('Corto')) out.push(`${map.name} es cerrado y no hay nadie que pelee de cerca.`);
  return out;
}
function gradeOf(t: number): string {
  return t >= 75 ? 'S' : t >= 65 ? 'A' : t >= 55 ? 'B' : t >= 45 ? 'C' : 'D';
}
export function verdict(mapId: string, allies: string[], enemies: string[]): Verdict {
  const map = MAPS.find((m) => m.id === mapId) ?? MAPS[0];
  const team = (picks: string[], foes: string[]) => {
    if (picks.length === 0) return { map: 0, counter: 0, total: 0, grade: '—' };
    const ms = picks.map((id) => { const b = brawlerById(id); return b ? mapModeScore(b, map) : 50; });
    // Los duelos ganados solo cuentan enteros si el brawler rinde en el mapa
    const cs = picks.map((id, i) => {
      if (foes.length === 0) return 55;
      const ss = foes.map((f) => gatedMatchup(matchupScore(id, f).score, ms[i]));
      return ss.reduce((a, c) => a + c, 0) / ss.length;
    });
    const mAvg = Math.round(ms.reduce((a, c) => a + c, 0) / ms.length);
    const cAvg = Math.round(cs.reduce((a, c) => a + c, 0) / cs.length);
    const total = Math.round(mAvg * 0.5 + cAvg * 0.5);
    return { map: mAvg, counter: cAvg, total, grade: gradeOf(total) };
  };
  const blue = team(allies, enemies);
  const red = team(enemies, allies);
  const edge = blue.total > red.total + 3 ? 'blue' : red.total > blue.total + 3 ? 'red' : 'even';
  const th = threatsTo(allies, enemies)[0];
  const tip = th
    ? `Peligro mayor: ${brawlerById(th.enemy)?.name} counterea a tu ${brawlerById(th.ally)?.name}. Evita ese duelo y juega alrededor de tus otros dos.`
    : 'Sin counters duros en contra: juega tu plan de mapa con disciplina.';
  // Predicción: diferencia de nota de draft + composición → probabilidad logística, acotada a 20-80 %
  const comp = (ids: string[]) => -roleWarnings(ids, map).length * 3;
  const diff = (blue.total + comp(allies)) - (red.total + comp(enemies));
  const winChance = Math.round(Math.max(20, Math.min(80, 100 / (1 + Math.exp(-diff / 7)))));
  return { blue, red, edge, tip, winChance, lanes: lanes(allies, enemies), roleWarnings: roleWarnings(allies, map) };
}

export function suggestBans(mapId: string, count = 3, alreadyBanned: string[] = []): { brawlerId: string; reason: string; score: number }[] {
  const map = MAPS.find((m) => m.id === mapId) ?? MAPS[0];
  return getAllBrawlers().filter((b) => !alreadyBanned.includes(b.id))
    .map((b) => {
      const mm = mapModeScore(b, map);
      const comp = competitivePart(b.id);
      const researchedTargets = new Set(RESEARCHED_MATCHUPS.filter((m) => m.attacker === b.id).map((m) => m.defender));
      const dominance = (b.counters.length + researchedTargets.size) * 4 + (b.favoredMaps.includes(map.id) ? 8 : 0);
      const real = realOf(map.id, b.id);
      const presence = real ? Math.min(100, real.pick * 250) : 0;
      // En un mapa medido solo merece ban lo que de verdad gana y se juega: sin datos, pierde prioridad
      const score = Math.round(real
        ? mm * 0.55 + presence * 0.25 + comp * 0.2
        : (mm * 0.5 + comp * 0.3 + Math.min(100, 50 + dominance) * 0.2) * (hasRealMap(map.id) ? 0.8 : 1));
      const reason = real
        ? `${b.name}: ${realLabel(real)} en ${map.name}, aparece en el ${Math.round(real.pick * 100)}% de partidas.`
        : `${b.name}: domina ${map.name} (${mm}/100 en mapa/modo) y amenaza a ${b.counters.length + researchedTargets.size} picks — estimación, sin datos Ranked de este mapa.`;
      return { brawlerId: b.id, reason, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, count);
}
