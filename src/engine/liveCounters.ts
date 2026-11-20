import RAW from '../data/countersData.json';
import type { CountersData, RawCounter } from '../data/countersTypes';
import type { MatchupRating, Role } from '../types';

// Counters de TODOS los brawlers (brawlcalculator.com, datos de ranking SpenLC).
// Se regeneran con `npm run counters:update`.
export const COUNTERS_DATA = RAW as CountersData;

// Fuerza de cada evidencia: top-3 de "Mejores counters de X" = counter duro; resto = ventaja clara.
// "X es un buen pick contra Y" cuenta algo menos (la lista la escribe el lado que gana).
function evidence(c: RawCounter): number {
  if (c.kind === 'counter') return c.rank <= 3 ? 100 : 82;
  return c.rank <= 3 ? 85 : 75;
}

const EDGE = new Map<string, { score: number; why: string }>();
for (const c of COUNTERS_DATA.counters) {
  const key = `${c.attacker}|${c.defender}`;
  const s = evidence(c);
  const prev = EDGE.get(key);
  if (!prev || s > prev.score) EDGE.set(key, { score: s, why: c.why });
}
export const COVERED = new Set(COUNTERS_DATA.counters.flatMap((c) => [c.attacker, c.defender]));

// Redondeo simétrico: si A contra B da 62,5, B contra A da 37,5 → 63 y 37 (siempre suman 100)
export const roundAround50 = (x: number) => (x >= 50 ? Math.round(x) : 100 - Math.round(100 - x));

export interface LiveMatchup { score: number; rating: MatchupRating; note: string; confidence: 'alta' | 'media' | 'baja' }

export function ratingOf(score: number): MatchupRating {
  return score >= 90 ? 'hardCounter' : score >= 65 ? 'favorable' : score > 35 ? 'neutral' : score > 10 ? 'unfavorable' : 'hardCountered';
}

// Junta las dos direcciones: si A countera a B y además B aparece como counter de A, se compensan.
export function liveMatchup(attacker: string, defender: string): LiveMatchup | null {
  const fwd = EDGE.get(`${attacker}|${defender}`);
  const back = EDGE.get(`${defender}|${attacker}`);
  if (!fwd && !back) return null;
  let score: number;
  let note: string;
  if (fwd && back) {
    score = roundAround50(50 + (fwd.score - back.score) / 2);
    note = `Duelo disputado: ${fwd.why} Aun así, el rival también tiene recursos: ${back.why}`;
  } else if (fwd) {
    score = fwd.score;
    note = fwd.why;
  } else {
    score = 100 - back!.score;
    note = `Lo sufre: ${back!.why}`;
  }
  const confidence = fwd && back ? 'media' : (fwd?.score ?? back!.score) >= 82 ? 'alta' : 'media';
  return { score, rating: ratingOf(score), note, confidence };
}

// Clases de brawlcalculator → roles del proyecto (las que no tienen equivalente se ignoran)
const CLASS_TO_ROLE: Record<string, Role> = {
  Asesino: 'Asesino', Francotirador: 'Francotirador', Lanzador: 'Artillería', Tanque: 'Tanque'
};
// ¿El defensor es débil contra la clase del atacante? (p. ej. "Shelly también es débil contra Lanzador")
export function weakToRole(defender: string, attackerRoles: Role[]): boolean {
  const classes = COUNTERS_DATA.classWeak[defender] ?? [];
  return classes.some((c) => CLASS_TO_ROLE[c] && attackerRoles.includes(CLASS_TO_ROLE[c]));
}
