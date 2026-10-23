import { describe, expect, it } from 'vitest';
import { ROSTER } from '../data/roster';
import { parseVoice } from './voice';

const roster = ROSTER.map(([id, , name]) => ({ id, name }));
const apply = (t: string) => {
  const r = parseVoice(t, roster);
  if (r.type !== 'apply') throw new Error(`"${t}" → ${JSON.stringify(r)}`);
  return r;
};

describe('parseVoice', () => {
  it('reconoce acción, equipo y brawler', () => {
    expect(apply('banea Piper')).toMatchObject({ brawlerId: 'piper', kind: 'ban', team: null });
    expect(apply('pick rojo Mortis')).toMatchObject({ brawlerId: 'mortis', kind: 'pick', team: 'red' });
    expect(apply('nosotros elegimos a Shelly')).toMatchObject({ brawlerId: 'shelly', kind: 'pick', team: 'blue' });
    expect(apply('ellos banean a Spike')).toMatchObject({ brawlerId: 'spike', kind: 'ban', team: 'red' });
  });

  it('entiende nombres escritos como suenan en español', () => {
    expect(apply('paiper').brawlerId).toBe('piper');
    expect(apply('banea espaik').brawlerId).toBe('spike');
    expect(apply('pick bairon').brawlerId).toBe('byron');
    expect(apply('cheli').brawlerId).toBe('shelly');
  });

  it('reconoce a Shade como lo transcribe el reconocedor en español', () => {
    for (const t of ['Shade', 'banea Shade', 'sheid', 'Shayd', 'cheid', 'shed', 'Chait', 'shady']) {
      expect(apply(t).brawlerId, t).toBe('shade');
    }
  });

  it.each([
    ['jae-yong', ['Jae Yong', 'jaeyong', 'jay young', 'jei yong', 'yei yon', 'yeiyong', 'jeiyon', 'jai yong']],
    ['fang', ['Fang', 'fan', 'fank', 'feng', 'fangu']],
    ['pam', ['Pam', 'pan', 'paam']],
    ['griff', ['Griff', 'grif', 'grief', 'grifo']],
    ['shade', ['Shade', 'shei', 'chei', 'sheit', 'cheide']]
  ])('reconoce variantes de %s conservando la acción y el equipo', (id, variants) => {
    for (const variant of variants) {
      expect(apply(variant).brawlerId, variant).toBe(id);
      expect(apply(`pick rojo ${variant}`), variant).toMatchObject({ brawlerId: id, kind: 'pick', team: 'red' });
      expect(apply(`nosotros banea ${variant}`), variant).toMatchObject({ brawlerId: id, kind: 'ban', team: 'blue' });
    }
  });

  it('la "ch" y la "sh" no se convierten en "k" (Shelly, Chester, Chuck, Charlie)', () => {
    expect(apply('Shelly').brawlerId).toBe('shelly');
    expect(apply('Chester').brawlerId).toBe('chester');
    expect(apply('pick Chuck').brawlerId).toBe('chuck');
    expect(apply('Charlie').brawlerId).toBe('charlie');
  });

  it('cada brawler se reconoce al decir su propio nombre', () => {
    const wrong = roster.filter((b) => { const r = parseVoice(b.name, roster); return r.type !== 'apply' || r.brawlerId !== b.id; })
      .map((b) => { const r = parseVoice(b.name, roster); return `${b.name}→${r.type === 'apply' ? r.brawlerId : r.type}`; });
    expect(wrong).toEqual([]);
  });

  it('ignora tildes y mayúsculas, y resuelve nombres de varias palabras', () => {
    expect(apply('vamos con EL PRIMO').brawlerId).toBe('el-primo');
    expect(apply('león').brawlerId).toBe('leon');
  });

  it('no confunde palabras de equipo con brawlers', () => {
    expect(parseVoice('rojo', roster).type).toBe('none');
    expect(parseVoice('pick azul', roster).type).toBe('none');
  });

  it('órdenes de control', () => {
    expect(parseVoice('deshacer', roster).type).toBe('undo');
    expect(parseVoice('me equivoqué, atrás', roster).type).toBe('undo');
    expect(parseVoice('rehacer', roster).type).toBe('redo');
    expect(parseVoice('pon el sugerido', roster).type).toBe('suggest');
  });

  it('no inventa un brawler con texto que no se parece a ninguno', () => {
    expect(parseVoice('hola qué tal', roster).type).toBe('none');
  });
});
