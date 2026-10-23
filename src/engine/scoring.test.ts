import { describe, expect, it } from 'vitest';
import { REAL_META, realMapScore, shrunkWinRate } from './realMeta';
import { scoreAll, suggestBans } from './scoring';

const base = { allies: [], enemies: [], banned: [], picked: [] };

describe('meta real', () => {
  it('contrae el winrate según las partidas: pocas partidas pesan poco', () => {
    const few = { wr: 0.7, games: 30, pick: 0.03, modeWr: 0.5, modeGames: 500, reliability: 'early', verdict: 'promising' };
    const many = { ...few, games: 400, reliability: 'solid' };
    expect(shrunkWinRate(few)).toBeLessThan(shrunkWinRate(many));
    expect(realMapScore(few).weight).toBeLessThan(realMapScore(many).weight);
    expect(realMapScore(many).score).toBeGreaterThan(80);
  });

  it('cubre todos los mapas de la rotación', () => {
    expect(Object.keys(REAL_META.maps).length).toBeGreaterThanOrEqual(26);
  });

  it('el mejor brawler medido de un mapa (fiable) sube al top de recomendaciones de ese mapa', () => {
    for (const [mapId, m] of Object.entries(REAL_META.maps)) {
      // Los "fuertes pero countereables" (strong-late) se bajan a propósito en el primer pick
      const best = Object.entries(m.brawlers).filter(([, r]) => r.reliability !== 'early' && r.games >= 150 && r.verdict !== 'strong-late')
        .sort(([, a], [, b]) => shrunkWinRate(b) - shrunkWinRate(a))[0];
      if (!best) continue;
      const recs = scoreAll({ ...base, mapId });
      const pos = recs.findIndex((r) => r.brawlerId === best[0]);
      expect(pos, `${best[0]} en ${mapId}`).toBeLessThan(15);
    }
  });

  it('un "fuerte pero countereable" baja en el primer pick y no en el último', () => {
    const late = Object.entries(REAL_META.maps).flatMap(([mapId, m]) => Object.entries(m.brawlers).filter(([, r]) => r.verdict === 'strong-late').map(([id]) => ({ mapId, id })))[0];
    if (!late) return;
    const fp = scoreAll({ ...base, mapId: late.mapId }).find((r) => r.brawlerId === late.id)!;
    expect(fp.weaknesses.join(' ')).toMatch(/fácil de counterear/);
    expect(fp.safeBlind).toBe(false);
  });

  it('un brawler que pierde en el mapa ("avoid") queda por debajo de la mitad', () => {
    for (const [mapId, m] of Object.entries(REAL_META.maps)) {
      const bad = Object.entries(m.brawlers).find(([, r]) => r.verdict === 'avoid' && r.games >= 150 && r.wr < 0.45);
      if (!bad) continue;
      const recs = scoreAll({ ...base, mapId });
      expect(recs.findIndex((r) => r.brawlerId === bad[0]), `${bad[0]} en ${mapId}`).toBeGreaterThan(recs.length / 2);
    }
  });

  it('los bans sugeridos usan datos reales en mapas medidos', () => {
    const b = suggestBans('gem-fort', 3);
    expect(b[0].reason).toMatch(/partidas Ranked/);
  });
});

describe('composición', () => {
  it('penaliza un tercer brawler del mismo rol', () => {
    const assassins = scoreAll({ ...base, mapId: 'bb-triple-dribble', allies: ['mortis', 'edgar'] });
    const third = assassins.find((r) => r.brawlerId === 'crow');
    const solo = scoreAll({ ...base, mapId: 'bb-triple-dribble', allies: ['poco', 'piper'] }).find((r) => r.brawlerId === 'crow');
    expect(third!.parts.synergy).toBeLessThan(solo!.parts.synergy);
  });
});
