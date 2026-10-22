import { BRAWLERS } from '../data/brawlers';
import { MAPS } from '../data/maps';
import { MATCHUPS, STATS } from '../data/meta';
import { ROSTER, brawlerImg } from '../data/roster';
import { RESEARCHED_MATCHUPS, MAP_BOOST, RESEARCHED, metaOf } from '../data/counters';
import type { Brawler, GameMap, GameMode, MatchupRating, Ownership, Recommendation, Role, Weights } from '../types';

export const DEFAULT_WEIGHTS: Weights = { mapMode: 0.3, matchup: 0.3, synergy: 0.2, competitive: 0.1, flex: 0.1 };
export const DATA_SOURCE = 'BrawlAPI/Brawlify (comunidad, imágenes © Supercell) + fichas propias de estimación';
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

export function matchupScore(attackerId: string, defenderId: string): { score: number; note: string; confidence: string; mapDependent: boolean } {
  // 1º datos investigados (brawlcalculator jul-2026), 2º fichas propias, 3º estimación por clases
  const r = RESEARCHED_MATCHUPS.find((x) => x.attacker === attackerId && x.defender === defenderId);
  if (r) return { score: RATING_SCORE[r.rating], note: r.note + ' (investigado).', confidence: r.confidence, mapDependent: !!r.mapDependent };
  const m = MATCHUPS.find((x) => x.attacker === attackerId && x.defender === defenderId);
  if (m) return { score: RATING_SCORE[m.rating], note: m.note, confidence: m.confidence, mapDependent: !!m.mapDependent };
  const a = brawlerById(attackerId);
  if (a?.counters.includes(defenderId)) return { score: 75, note: 'Ventaja declarada en ficha (estimación).', confidence: 'baja', mapDependent: true };
  if (a?.weakAgainst.includes(defenderId)) return { score: 25, note: 'Desventaja declarada en ficha (estimación).', confidence: 'baja', mapDependent: true };
  const rating = CLASS_MATRIX[roleOf(attackerId)]?.[roleOf(defenderId)] ?? 'neutral';
  const label: Record<MatchupRating, string> = {
    hardCounter: 'su clase suele cazar a la del rival', favorable: 'su clase tiene ventaja genérica',
    neutral: 'sin ventaja clara por clase', unfavorable: 'su clase suele sufrir contra la del rival',
    hardCountered: 'su clase es cazada por la del rival'
  };
  return { score: RATING_SCORE[rating], note: `Estimación por clases: ${label[rating]}.`, confidence: 'baja', mapDependent: true };
}

function mapModeScore(b: Brawler, map: GameMap): number {
  let s = 50;
  if (b.favoredModes.includes(map.mode)) s += 18;
  // Alias de mapas legacy (rotaciones anteriores) al pool competitivo actual
  const ALIAS: Record<string, string[]> = {
    'gem-shooting-star': ['bounty-hideout', 'bounty-layer-cake', 'bounty-dry-season'],
    'knockout-belle-rock': ['ko-belles-rock', 'ko-flaring-phoenix', 'ko-open', 'ko-new-horizons'],
    'knockout-out-law': ['ko-flaring-phoenix'],
    'hot-ring': ['hz-over-top', 'hz-open-zone', 'hz-beetles', 'hz-parallel', 'hz-quick-travel'],
    'hot-open-business': ['hz-parallel'],
    'brawl-ball-center': ['bb-triple-dribble', 'bb-palco-central'],
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

function matchupPart(b: Brawler, enemies: string[]): { avg: number; multi: number; risk: number } {
  if (enemies.length === 0) return { avg: 55, multi: 0, risk: 20 };
  const scores = enemies.map((e) => matchupScore(b.id, e).score);
  const avg = scores.reduce((a, c) => a + c, 0) / scores.length;
  const multi = scores.filter((s) => s >= 70).length;
  const riskScores = enemies.map((e) => matchupScore(e, b.id).score);
  const risk = riskScores.reduce((a, c) => a + c, 0) / riskScores.length;
  return { avg, multi, risk };
}

function synergyPart(b: Brawler, allies: string[]): number {
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
  return Math.max(0, Math.min(100, s));
}

function competitivePart(brawlerId: string): number {
  // 1º meta real oct-2026 investigado, 2º stats de ejemplo, 3º neutral
  const meta = metaOf(brawlerId);
  if (meta.score !== null) return meta.score;
  const st = STATS.find((s) => s.brawlerId === brawlerId);
  if (!st) return 50;
  return Math.max(0, Math.min(100, st.winRate * 70 + st.pickRate * 30));
}

export function metaLabel(brawlerId: string): string | null {
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
    const { avg, multi, risk } = matchupPart(b, enemySet);
    // ACOPLE counter×mapa: un counter que va mal en el mapa pierde fuerza.
    // Con rivales, el matchup rinde entre el 55% (mapa horrible) y el 100% (mapa ideal).
    const mapFit = mapMode / 100;
    const matchupAdj = enemySet.length > 0 ? avg * (0.55 + 0.45 * mapFit) : avg;
    const synergy = synergyPart(b, allySet);
    const competitive = competitivePart(b.id);
    const flex = flexPart(b, map);
    const raw = mapMode * w.mapMode + matchupAdj * w.matchup + synergy * w.synergy + competitive * w.competitive + flex * w.flex;
    // DECISIONES FINALES: el riesgo pesa más cuanto menos se conoce del rival.
    // Temprano (0 rivales vistos) un pick countereable es una condena; tardío se puede apurar el counter.
    const unknownEnemies = Math.max(0, 3 - enemySet.length);
    const riskPenalty = risk * 0.35 * (unknownEnemies / 3);
    // Colección: sin tener = excluido (arriba); a bajo nivel = -15 y aviso
    const isLow = own[b.id] === 'low';
    const score = Math.round(Math.max(0, Math.min(100, raw - riskPenalty - (isLow ? 15 : 0))));
    const safeBlind = risk <= 35 && flex >= 55;
    const parts = { mapMode: Math.round(mapMode), matchup: Math.round(matchupAdj), synergy: Math.round(synergy), competitive: Math.round(competitive), flex: Math.round(flex) };
    const explanation = buildExplanation(b, map, enemySet, allySet, multi, parts);
    const weaknesses = [...b.weaknesses];
    if (risk >= 65) weaknesses.push(`Alto riesgo de ser contrarrestado (${Math.round(risk)}/100) por el draft rival actual.`);
    if (multi >= 1 && mapMode < 45 && enemySet.length > 0) weaknesses.push(`Counterea pero va MAL en ${map.name} (${Math.round(mapMode)}/100 en mapa): elige solo si no hay otro counter que vaya bien aquí.`);
    if (isLow) weaknesses.push('Lo tienes a BAJO NIVEL: rinde por debajo de su potencial. Máxéalo o elige la alternativa.');
    const alternatives = all
      .filter((x) => x.id !== b.id && !excluded.has(x.id) && x.roles.some((r) => b.roles.includes(r)))
      .sort((x, y) => (own[x.id] === 'low' ? 1 : 0) - (own[y.id] === 'low' ? 1 : 0))
      .slice(0, 3).map((x) => x.id);
    const known = b.curated || RESEARCHED.has(b.id);
    const confidence = (!known ? 'baja' : enemySet.length >= 2 || b.favoredMaps.includes(map.id) || (MAP_BOOST[b.id] ?? []).includes(map.id) ? 'media' : 'baja') as Recommendation['confidence'];
    return { brawlerId: b.id, score, parts, explanation, weaknesses, alternatives, multiCounter: multi, counterRisk: Math.round(risk), confidence, safeBlind };
  });
  return recs.sort((a, b) => b.score - a.score);
}

function buildExplanation(b: Brawler, map: GameMap, enemies: string[], allies: string[], multi: number, parts: Recommendation['parts']): string {
  const job = allies.length === 0 ? 'FP' : allies.length === 1 ? 'MID' : 'LAST';
  const bits: string[] = [];
  if (job === 'FP') bits.push('primer pick: poder seguro de mapa');
  if (job === 'LAST') bits.push('último pick: remata el counter');
  if (parts.mapMode >= 65) bits.push(`rinde bien en ${map.name} (${map.mode}, terreno ${map.rangeBias.toLowerCase()})`);
  if (multi >= 2) bits.push(`presiona a ${multi} rivales a la vez`);
  else if (multi === 1) {
    const target = enemies[0] ? brawlerById(enemies[0])?.name ?? 'rival' : 'rival';
    bits.push(`responde al pick rival (${target})`);
  }
  if (allies.length > 0 && parts.synergy >= 65) bits.push('complementa la composición aliada');
  if (parts.competitive >= 55) bits.push('buen winrate de ejemplo en torneos');
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
export interface Verdict {
  blue: { map: number; counter: number; total: number; grade: string };
  red: { map: number; counter: number; total: number; grade: string };
  edge: 'blue' | 'red' | 'even';
  tip: string;
}
function gradeOf(t: number): string {
  return t >= 75 ? 'S' : t >= 65 ? 'A' : t >= 55 ? 'B' : t >= 45 ? 'C' : 'D';
}
export function verdict(mapId: string, allies: string[], enemies: string[]): Verdict {
  const map = MAPS.find((m) => m.id === mapId) ?? MAPS[0];
  const team = (picks: string[], foes: string[]) => {
    if (picks.length === 0) return { map: 0, counter: 0, total: 0, grade: '—' };
    const ms = picks.map((id) => { const b = brawlerById(id); return b ? mapModeScore(b, map) : 50; });
    const cs = picks.map((id) => {
      if (foes.length === 0) return 55;
      const ss = foes.map((f) => matchupScore(id, f).score);
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
  return { blue, red, edge, tip };
}

export function suggestBans(mapId: string, count = 3, alreadyBanned: string[] = []): { brawlerId: string; reason: string; score: number }[] {
  const map = MAPS.find((m) => m.id === mapId) ?? MAPS[0];
  return getAllBrawlers().filter((b) => !alreadyBanned.includes(b.id))
    .map((b) => {
      const mm = mapModeScore(b, map);
      const comp = competitivePart(b.id);
      const researchedTargets = new Set(RESEARCHED_MATCHUPS.filter((m) => m.attacker === b.id).map((m) => m.defender));
      const dominance = (b.counters.length + researchedTargets.size) * 4 + (b.favoredMaps.includes(map.id) ? 8 : 0);
      const score = Math.round(mm * 0.5 + comp * 0.3 + Math.min(100, 50 + dominance) * 0.2);
      const reason = `${b.name}: domina ${map.name} (${mm}/100 en mapa/modo) y amenaza a ${b.counters.length + researchedTargets.size} picks. Winrate ejemplo ${(STATS.find((s) => s.brawlerId === b.id)?.winRate ?? 0.5) * 100}% — estimación, no oficial.`;
      return { brawlerId: b.id, reason, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, count);
}
