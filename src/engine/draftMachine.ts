import { FORMATS } from '../data/meta';
import type { DraftFormat, DraftState, GameMode, Team } from '../types';

// Formato competitivo vigente (BSC 2026, rulebook BLAST.tv v1.6 29/06/2026):
// sorteo -> bans globales (match) -> map draft (externo) -> bans de set ciegos (1 por jugador) -> picks snake.

export function initialDraft(mode: GameMode, mapId: string, formatId = 'live'): DraftState {
  const strict = !getFormat(formatId).freeOrder;
  return {
    mode, mapId, formatId,
    strict, freeMode: false,
    coinWinner: null,
    globalBansBlue: [], globalBansRed: [],
    bansBlue: [], bansRed: [],
    picksBlue: [null, null, null],
    picksRed: [null, null, null],
    turnIndex: 0, phase: 'coin',
    history: [], future: []
  };
}

export function getFormat(id: string): DraftFormat {
  return FORMATS.find((f) => f.id === id) ?? FORMATS[0];
}

const other = (t: Team): Team => (t === 'blue' ? 'red' : 'blue');
// Orden de slots: azul izq→der (FP, MID, LAST), rojo der→izq (FP a la derecha).
export const SLOT_LABELS: Record<Team, [string, string, string]> = {
  blue: ['1º FP', '2º MID', '3º LAST'],
  red: ['3º LAST', '2º MID', '1º FP']
};
function nextSlot(picks: (string | null)[], team: Team): number {
  if (team === 'blue') return picks.indexOf(null);
  for (let i = picks.length - 1; i >= 0; i--) if (picks[i] === null) return i;
  return -1;
}
// Nº de pick nuestro (0,1,2) → rol FP/MID/LAST
export function ourPickJob(picksBlue: (string | null)[]): 'FP' | 'MID' | 'LAST' | 'DONE' {
  const n = picksBlue.filter(Boolean).length;
  return n >= 3 ? 'DONE' : n === 0 ? 'FP' : n === 1 ? 'MID' : 'LAST';
}
export const starterOf = (s: DraftState): Team => s.coinWinner ?? 'blue';

export type ExpectedAction = { kind: 'coin' } | { kind: 'globalban' | 'ban' | 'pick'; team: Team } | { kind: 'done' };

export function expectedAction(s: DraftState): ExpectedAction {
  const f = getFormat(s.formatId);
  if (f.coinFlip && !s.coinWinner) return { kind: 'coin' };
  const starter = starterOf(s);
  const totalGlobal = f.globalBansPerTeam * 2;
  const globalDone = s.globalBansBlue.length + s.globalBansRed.length;
  if (globalDone < totalGlobal) {
    return { kind: 'globalban', team: globalDone % 2 === 0 ? starter : other(starter) };
  }
  const totalBans = f.bansPerTeam * 2;
  const bansDone = s.bansBlue.length + s.bansRed.length;
  // Baneos por bloques: primero todo el equipo azul (nosotros) y luego el rojo (ellos).
  if (bansDone < totalBans) {
    if (s.bansBlue.length < f.bansPerTeam) return { kind: 'ban', team: 'blue' };
    return { kind: 'ban', team: 'red' };
  }
  const picksDone = [...s.picksBlue, ...s.picksRed].filter(Boolean).length;
  if (picksDone >= 6) return { kind: 'done' };
  const order = f.pickOrder.map((t) => (s.coinWinner === 'red' ? other(t) : t));
  return { kind: 'pick', team: order[picksDone] };
}

export function flipCoin(s: DraftState, winner: Team): DraftState {
  const next = structuredClone(s) as DraftState;
  next.coinWinner = winner;
  next.history.push({ kind: 'coin', team: winner, brawlerId: null, at: Date.now() });
  next.future = [];
  next.phase = 'globalban';
  return next;
}

// Ranked (live): los bans son simultáneos (cada jugador banea 1 a la vez), así que se pueden
// registrar en cualquier orden. Los picks SIEMPRE van por turnos (snake 1-2-2-1): mientras
// un equipo elige, el otro no puede pickear. Solo el modo manual externo (freeMode) lo salta.
function checkTurn(s: DraftState, kind: 'globalban' | 'ban' | 'pick', team: Team): string | null {
  if (s.freeMode) return null;
  if (getFormat(s.formatId).freeOrder && kind !== 'pick') return null;
  const exp = expectedAction(s);
  if (exp.kind === 'done') return 'Draft ya finalizado.';
  if (exp.kind === 'coin') return 'Primero hay que lanzar la moneda.';
  if (exp.kind !== kind) {
    const need = exp.kind === 'globalban' ? 'baneos globales' : exp.kind === 'ban' ? 'baneos de set' : 'picks';
    return `Ahora tocan ${need}.`;
  }
  if (exp.team !== team) return `⏳ Está eligiendo el equipo ${exp.team === 'blue' ? 'AZUL' : 'ROJO'}: el ${team === 'blue' ? 'azul' : 'rojo'} no puede pickear hasta que termine.`;
  return null;
}

const usedIds = (s: DraftState) => [...s.globalBansBlue, ...s.globalBansRed, ...s.bansBlue, ...s.bansRed, ...s.picksBlue, ...s.picksRed].filter(Boolean) as string[];

export function applyGlobalBan(s: DraftState, team: Team, brawlerId: string): DraftState | { error: string } {
  if (usedIds(s).includes(brawlerId)) return { error: 'Brawler no disponible para ban global.' };
  const err = checkTurn(s, 'globalban', team);
  if (err) return { error: err };
  const f = getFormat(s.formatId);
  const next = structuredClone(s) as DraftState;
  const arr = team === 'blue' ? next.globalBansBlue : next.globalBansRed;
  if (arr.length >= f.globalBansPerTeam) return { error: 'Límite de bans globales alcanzado.' };
  arr.push(brawlerId);
  next.history.push({ kind: 'globalban', team, brawlerId, at: Date.now() });
  next.future = [];
  syncPhase(next);
  return next;
}

export function applyPick(s: DraftState, team: Team, brawlerId: string, slot?: number): DraftState | { error: string } {
  // Sin picks hasta terminar los baneos (cada jugador banea 1). Solo el modo manual externo lo permite.
  if (!s.freeMode && !bansComplete(s)) {
    const f = getFormat(s.formatId);
    const need = (f.bansPerTeam + f.globalBansPerTeam) * 2;
    const done = s.bansBlue.length + s.bansRed.length + s.globalBansBlue.length + s.globalBansRed.length;
    return { error: `🔒 Picks bloqueados: primero completa los baneos (${done}/${need}). Cada jugador banea 1 brawler.` };
  }
  if (usedIds(s).includes(brawlerId)) {
    const banned = [...s.bansBlue, ...s.bansRed, ...s.globalBansBlue, ...s.globalBansRed];
    if (banned.includes(brawlerId)) return { error: 'Brawler baneado: no disponible.' };
    return { error: 'Brawler ya seleccionado.' };
  }
  const err = checkTurn(s, 'pick', team);
  if (err) return { error: err };
  const next = structuredClone(s) as DraftState;
  const arr = team === 'blue' ? next.picksBlue : next.picksRed;
  // Orden obligatorio FP→MID→LAST (azul izq→der, rojo der→izq), salvo modo manual externo.
  let idx = slot;
  if (s.freeMode) {
    if (idx === undefined) idx = nextSlot(arr, team);
  } else {
    idx = nextSlot(arr, team);
  }
  if (idx === -1) return { error: 'Equipo completo.' };
  if (idx < 0 || idx > 2 || arr[idx] !== null) return { error: 'Hueco ocupado o inválido.' };
  arr[idx] = brawlerId;
  next.history.push({ kind: 'pick', team, brawlerId, slot: idx, at: Date.now() });
  next.future = [];
  syncPhase(next);
  return next;
}

// En Ranked los bans son simultáneos y ocultos: ambos equipos pueden banear al mismo brawler.
// Solo se rechaza repetirlo dentro del mismo equipo o si ya está pickeado / baneado globalmente.
export function banBlocked(s: DraftState, team: Team, brawlerId: string): boolean {
  const own = team === 'blue' ? s.bansBlue : s.bansRed;
  const taken = [...s.globalBansBlue, ...s.globalBansRed, ...s.picksBlue, ...s.picksRed].filter(Boolean) as string[];
  return own.includes(brawlerId) || taken.includes(brawlerId);
}

export function applyBan(s: DraftState, team: Team, brawlerId: string): DraftState | { error: string } {
  if (banBlocked(s, team, brawlerId)) return { error: 'Brawler no disponible para ban (ya baneado por tu equipo o pickeado).' };
  const err = checkTurn(s, 'ban', team);
  if (err) return { error: err };
  const f = getFormat(s.formatId);
  const next = structuredClone(s) as DraftState;
  const arr = team === 'blue' ? next.bansBlue : next.bansRed;
  if (arr.length >= f.bansPerTeam) return { error: 'Límite de bans alcanzado.' };
  arr.push(brawlerId);
  next.history.push({ kind: 'ban', team, brawlerId, at: Date.now() });
  next.future = [];
  syncPhase(next);
  return next;
}

function syncPhase(s: DraftState) {
  const exp = expectedAction(s);
  s.phase = exp.kind === 'coin' ? 'coin' : exp.kind === 'done' ? 'done' : exp.kind;
}

export function bansComplete(s: DraftState): boolean {
  const f = getFormat(s.formatId);
  const need = (f.bansPerTeam + f.globalBansPerTeam) * 2;
  if (need === 0) return true;
  const done = s.bansBlue.length + s.bansRed.length + s.globalBansBlue.length + s.globalBansRed.length;
  return done >= need;
}

export function pickOrderIssues(s: DraftState): string[] {
  // Compara la secuencia real de picks (historial) con el snake esperado (1-2-2-1 + sorteo).
  const f = getFormat(s.formatId);
  const order = f.pickOrder.map((t) => (s.coinWinner === 'red' ? other(t) : t));
  const actual = s.history.filter((h) => h.kind === 'pick' && h.team).map((h) => h.team as Team);
  const issues: string[] = [];
  actual.forEach((team, i) => {
    if (order[i] && team !== order[i]) {
      issues.push(`El pick #${i + 1} se marcó ${team === 'blue' ? 'AZUL' : 'ROJO'} pero por orden (sorteo ${s.coinWinner === 'red' ? 'ROJO' : 'AZUL'}) tocaba ${order[i] === 'blue' ? 'AZUL' : 'ROJO'}. Revisa ese hueco.`);
    }
  });
  return issues.slice(0, 2);
}

export function undo(s: DraftState): DraftState {
  const last = s.history[s.history.length - 1];
  if (!last) return s;
  const next = structuredClone(s) as DraftState;
  next.history.pop();
  next.future.unshift(last);
  rebuildFromHistory(next);
  return next;
}

export function redo(s: DraftState): DraftState {
  const act = s.future[0];
  if (!act) return s;
  const next = structuredClone(s) as DraftState;
  next.future.shift();
  next.history.push(act);
  rebuildFromHistory(next);
  return next;
}

function rebuildFromHistory(s: DraftState) {
  s.coinWinner = null;
  s.globalBansBlue = []; s.globalBansRed = [];
  s.bansBlue = []; s.bansRed = [];
  s.picksBlue = [null, null, null]; s.picksRed = [null, null, null];
  for (const h of s.history) {
    if (h.kind === 'coin' && h.team) { s.coinWinner = h.team; continue; }
    if (!h.brawlerId) continue;
    if (h.kind === 'globalban' && h.team) (h.team === 'blue' ? s.globalBansBlue : s.globalBansRed).push(h.brawlerId);
    if (h.kind === 'ban' && h.team) (h.team === 'blue' ? s.bansBlue : s.bansRed).push(h.brawlerId);
    if (h.kind === 'pick' && h.team) {
      const arr = h.team === 'blue' ? s.picksBlue : s.picksRed;
      let idx = h.slot;
      if (idx === undefined || idx === null || idx < 0 || idx > 2 || arr[idx] !== null) idx = nextSlot(arr, h.team);
      if (idx !== -1) arr[idx] = h.brawlerId;
    }
  }
  syncPhase(s);
}
