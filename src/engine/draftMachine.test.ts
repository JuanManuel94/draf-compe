import { describe, expect, it } from 'vitest';
import { applyBan, applyGlobalBan, applyPick, expectedAction, flipCoin, initialDraft, pickOrderIssues, redo, restoreDraft, undo } from './draftMachine';
import type { DraftState, Team } from '../types';

const ok = (r: DraftState | { error: string }): DraftState => {
  if ('error' in r) throw new Error(r.error);
  return r;
};
const live = (first: Team = 'blue') => ({ ...initialDraft('Balón Brawl', 'bb-triple-dribble', 'live'), coinWinner: first });
const banAll = (s: DraftState) => {
  for (const id of ['b1', 'b2', 'b3']) s = ok(applyBan(s, 'blue', id));
  for (const id of ['r1', 'r2', 'r3']) s = ok(applyBan(s, 'red', id));
  return s;
};
// Recorre el draft pickeando siempre para el equipo que toca y devuelve la secuencia de equipos
const pickSequence = (s: DraftState) => {
  const seq: Team[] = [];
  for (let i = 0; i < 6; i++) {
    const e = expectedAction(s);
    if (e.kind !== 'pick') throw new Error(`esperaba pick, llegó ${e.kind}`);
    seq.push(e.team);
    s = ok(applyPick(s, e.team, `p${i}`));
  }
  return { s, seq };
};

describe('Ranked (live)', () => {
  it('bloquea los picks hasta terminar los 6 bans', () => {
    const r = applyPick(live(), 'blue', 'x');
    expect('error' in r && r.error).toMatch(/bloqueados/);
  });

  it('permite que ambos equipos baneen al mismo brawler, pero no repetirlo en el mismo equipo', () => {
    let s = ok(applyBan(live(), 'blue', 'shelly'));
    s = ok(applyBan(s, 'red', 'shelly'));
    expect(s.bansRed).toContain('shelly');
    expect('error' in applyBan(s, 'blue', 'shelly')).toBe(true);
  });

  it('acepta los bans en cualquier orden (son simultáneos)', () => {
    let s = ok(applyBan(live(), 'red', 'a'));
    s = ok(applyBan(s, 'blue', 'b'));
    expect(s.bansRed).toEqual(['a']);
    expect(s.bansBlue).toEqual(['b']);
  });

  it('sigue el snake 1-2-2-1 empezando azul', () => {
    expect(pickSequence(banAll(live('blue'))).seq).toEqual(['blue', 'red', 'red', 'blue', 'blue', 'red']);
  });

  it('sigue el snake 1-2-2-1 empezando rojo', () => {
    expect(pickSequence(banAll(live('red'))).seq).toEqual(['red', 'blue', 'blue', 'red', 'red', 'blue']);
  });

  it('impide pickear al equipo que no está en turno', () => {
    const r = applyPick(banAll(live('blue')), 'red', 'x');
    expect('error' in r && r.error).toMatch(/Está eligiendo el equipo AZUL/);
  });

  it('no deja pickear un brawler baneado o ya elegido', () => {
    let s = banAll(live('blue'));
    expect('error' in applyPick(s, 'blue', 'b1')).toBe(true);
    s = ok(applyPick(s, 'blue', 'x'));
    expect('error' in applyPick(s, 'red', 'x')).toBe(true);
  });

  it('coloca al rojo de FP (índice 2) a LAST (índice 0)', () => {
    const { s } = pickSequence(banAll(live('red')));
    // Secuencia R(p0) B(p1) B(p2) R(p3) R(p4) B(p5)
    expect(s.picksRed).toEqual(['p4', 'p3', 'p0']);
    expect(s.picksBlue).toEqual(['p1', 'p2', 'p5']);
  });

  it('deshacer y rehacer conservan quién pickea primero', () => {
    let s = banAll(live('red'));
    s = ok(applyPick(s, 'red', 'x'));
    s = undo(s);
    expect(s.coinWinner).toBe('red');
    expect(expectedAction(s)).toEqual({ kind: 'pick', team: 'red' });
    s = redo(s);
    expect(s.picksRed[2]).toBe('x');
    expect(expectedAction(s)).toEqual({ kind: 'pick', team: 'blue' });
  });

  it('termina en done y sin incidencias de orden', () => {
    const { s } = pickSequence(banAll(live('blue')));
    expect(expectedAction(s).kind).toBe('done');
    expect(pickOrderIssues(s)).toEqual([]);
  });
});

describe('Torneo BSC', () => {
  const bsc = () => initialDraft('Balón Brawl', 'bb-triple-dribble', 'bsc-stage');

  it('exige el sorteo antes de banear', () => {
    expect(expectedAction(bsc()).kind).toBe('coin');
    expect('error' in applyGlobalBan(bsc(), 'blue', 'x')).toBe(true);
  });

  it('alterna los globales empezando por el ganador del sorteo y luego bans de set', () => {
    let s = flipCoin(bsc(), 'red');
    const seq: Team[] = [];
    for (let i = 0; i < 4; i++) {
      const e = expectedAction(s);
      if (e.kind !== 'globalban') throw new Error(e.kind);
      seq.push(e.team);
      s = ok(applyGlobalBan(s, e.team, `g${i}`));
    }
    expect(seq).toEqual(['red', 'blue', 'red', 'blue']);
    expect(expectedAction(s).kind).toBe('ban');
  });

  it('deshacer el sorteo vuelve a pedir moneda', () => {
    const s = undo(flipCoin(bsc(), 'blue'));
    expect(s.coinWinner).toBeNull();
    expect(expectedAction(s).kind).toBe('coin');
  });
});

describe('restoreDraft', () => {
  it('reconstruye un draft idéntico desde su historial', () => {
    const { s } = pickSequence(banAll(live('red')));
    const r = restoreDraft(s.mode, s.mapId, s.formatId, s.coinWinner, s.history);
    expect(r.picksBlue).toEqual(s.picksBlue);
    expect(r.picksRed).toEqual(s.picksRed);
    expect(r.bansRed).toEqual(s.bansRed);
    expect(r.phase).toBe('done');
  });

  it('en BSC recupera el ganador del sorteo desde el historial', () => {
    const s = flipCoin(initialDraft('Balón Brawl', 'bb-triple-dribble', 'bsc-stage'), 'red');
    expect(restoreDraft(s.mode, s.mapId, s.formatId, null, s.history).coinWinner).toBe('red');
  });
});
