import { describe, expect, it } from 'vitest';
import { COUNTERS_DATA, liveMatchup } from './liveCounters';
import { MAP_OK, countersOnMap, gatedMatchup, getAllBrawlers, matchupScore, scoreAll, verdict } from './scoring';
import { MAPS } from '../data/maps';

describe('counters de todos los brawlers', () => {
  it('cada brawler del roster tiene counters descargados', () => {
    const covered = new Set(COUNTERS_DATA.counters.map((c) => c.defender));
    const missing = getAllBrawlers().filter((b) => !covered.has(b.id)).map((b) => b.id);
    expect(missing).toEqual([]);
  });

  it('los dos lados de un duelo son coherentes (si A gana a B, B pierde contra A)', () => {
    for (const c of COUNTERS_DATA.counters.slice(0, 200)) {
      const ab = liveMatchup(c.attacker, c.defender)!;
      const ba = liveMatchup(c.defender, c.attacker)!;
      expect(ab.score + ba.score).toBe(100);
    }
  });

  it('todo duelo es coherente en las dos direcciones, también sin datos descargados', () => {
    const ids = getAllBrawlers().map((b) => b.id);
    for (const a of ids) for (const d of ids) {
      if (a === d) continue;
      expect(matchupScore(a, d).score + matchupScore(d, a).score, `${a} vs ${d}`).toBe(100);
    }
  });

  it('el motor usa los counters descargados antes que la estimación por clases', () => {
    const c = COUNTERS_DATA.counters.find((x) => x.kind === 'counter' && x.rank === 1)!;
    expect(matchupScore(c.attacker, c.defender).score).toBeGreaterThanOrEqual(75);
  });
});

describe('counter válido = gana el duelo Y rinde en el mapa', () => {
  it('un counter que va mal en el mapa pierde casi toda su ventaja', () => {
    expect(gatedMatchup(100, 80)).toBe(100);
    expect(gatedMatchup(100, 40)).toBeLessThan(65);
    expect(gatedMatchup(30, 40)).toBe(30); // las desventajas no se perdonan
  });

  it('los counters por mapa cumplen las dos condiciones en todos los mapas', () => {
    for (const map of MAPS) {
      for (const enemy of ['mortis', 'piper', 'shelly', 'edgar']) {
        for (const c of countersOnMap(map.id, enemy, [], 5)) {
          expect(c.matchup, `${c.brawlerId} vs ${enemy} en ${map.id}`).toBeGreaterThanOrEqual(65);
          expect(c.map, `${c.brawlerId} en ${map.id}`).toBeGreaterThanOrEqual(MAP_OK);
        }
      }
    }
  });

  it('con rival visto, un counter que rinde en el mapa supera a uno que no rinde', () => {
    for (const map of MAPS) {
      const recs = scoreAll({ mapId: map.id, allies: ['poco', 'gene'], enemies: ['mortis'], banned: [], picked: ['poco', 'gene', 'mortis'] });
      const good = countersOnMap(map.id, 'mortis', ['poco', 'gene'], 1)[0];
      const bad = recs.find((r) => matchupScore(r.brawlerId, 'mortis').score >= 90 && r.parts.mapMode < 45);
      if (!good || !bad) continue;
      const g = recs.find((r) => r.brawlerId === good.brawlerId)!;
      expect(g.parts.matchup, `${good.brawlerId} vs ${bad.brawlerId} en ${map.id}`).toBeGreaterThan(bad.parts.matchup);
    }
  });
});

describe('veredicto', () => {
  it('da probabilidad acotada, tres líneas y avisos de composición', () => {
    const v = verdict('bb-triple-dribble', ['mortis', 'edgar', 'crow'], ['piper', 'poco', 'bull']);
    expect(v.winChance).toBeGreaterThanOrEqual(20);
    expect(v.winChance).toBeLessThanOrEqual(80);
    expect(v.lanes).toHaveLength(3);
    expect(v.roleWarnings.join(' ')).toMatch(/asesino/);
  });
});
