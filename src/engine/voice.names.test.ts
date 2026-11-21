import { describe, expect, it } from 'vitest';
import { ROSTER } from '../data/roster';
import { parseVoice, parseVoiceList } from './voice';

// Cada brawler con las formas en que el reconocedor de voz en español suele escribirlo al dictarlo.
// Si se añade un brawler nuevo al roster, la última prueba obliga a añadirlo aquí.
const HEARD: Record<string, string[]> = {
  vince: ['Vince', 'Vins', 'Bins', 'Vinz'],
  cosmo: ['Cosmo', 'Cosmos', 'Kosmo'],
  wendy: ['Wendy', 'Wendi', 'Guendi', 'Uendi'],
  nori: ['Nori', 'Nory'],
  bolt: ['Bolt', 'Volt', 'Bolth'],
  'starr-nova': ['Starr Nova', 'Star Nova', 'estar nova'],
  damian: ['Damian', 'Damián', 'Demian'],
  najia: ['Najia', 'Nayia', 'Naya', 'Nagia'],
  sirius: ['Sirius', 'Sirio', 'Sirus'],
  glowy: ['Glowy', 'Glowi', 'Glouy', 'Glowie'],
  gigi: ['Gigi', 'Yiyi', 'Jiji'],
  pierce: ['Pierce', 'Pirs', 'Piers'],
  ziggy: ['Ziggy', 'Zigi', 'Sigi'],
  mina: ['Mina', 'Minna'],
  trunk: ['Trunk', 'Tronk', 'Trank'],
  alli: ['Alli', 'Ali', 'Allie'],
  kaze: ['Kaze', 'Kase', 'Kazé'],
  'jae-yong': ['Jae Yong', 'Yei Yong', 'Jay Young'],
  finx: ['Finx', 'Finks', 'Fincs', 'Fins'],
  lumi: ['Lumi', 'Lumy'],
  ollie: ['Ollie', 'Oli', 'Olly'],
  meeple: ['Meeple', 'Mipel', 'Mipol'],
  juju: ['Juju', 'Yuyu', 'Chuchu'],
  shade: ['Shade', 'Sheid', 'Cheid'],
  kenji: ['Kenji', 'Kenyi', 'Kenchi'],
  moe: ['Moe', 'Mo', 'Mou'],
  clancy: ['Clancy', 'Clansi', 'Klancy'],
  berry: ['Berry', 'Beri', 'Berri'],
  lily: ['Lily', 'Lili', 'Lilly'],
  draco: ['Draco', 'Drako'],
  angelo: ['Angelo', 'Ángelo', 'Anyelo'],
  melodie: ['Melodie', 'Melody', 'Melodi'],
  'larry-lawrie': ['Larry y Lawrie', 'Larry and Lawrie', 'Lari y Lori', 'Larry'],
  kit: ['Kit', 'Quit', 'Kid'],
  mico: ['Mico', 'Miko'],
  charlie: ['Charlie', 'Charly', 'Charli'],
  chuck: ['Chuck', 'Chak', 'Chuk'],
  pearl: ['Pearl', 'Perl', 'Perla'],
  doug: ['Doug', 'Dag', 'Dog'],
  cordelius: ['Cordelius', 'Cordelio', 'Kordelius'],
  hank: ['Hank', 'Jank', 'Hanck'],
  maisie: ['Maisie', 'Meisi', 'Maisy', 'Meisy'],
  willow: ['Willow', 'Uilou', 'Wilou', 'Güilou'],
  'r-t': ['R-T', 'RT', 'erre te', 'arti'],
  mandy: ['Mandy', 'Mandi'],
  gray: ['Gray', 'Grey', 'Grei'],
  chester: ['Chester', 'Chéster'],
  buster: ['Buster', 'Baster', 'Bastar'],
  gus: ['Gus', 'Gas'],
  sam: ['Sam', 'Sem'],
  otis: ['Otis', 'Otiz'],
  bonnie: ['Bonnie', 'Boni', 'Bony'],
  janet: ['Janet', 'Yanet', 'Llanet'],
  eve: ['Eve', 'Iv', 'Ive'],
  fang: ['Fang', 'Fan', 'Feng'],
  lola: ['Lola'],
  meg: ['Meg', 'Megh'],
  ash: ['Ash', 'Ach', 'Ashe'],
  griff: ['Griff', 'Grif', 'Grifo'],
  buzz: ['Buzz', 'Bas', 'Bus', 'Baz'],
  grom: ['Grom', 'Grum'],
  squeak: ['Squeak', 'Escuik', 'Squik', 'Esquik'],
  belle: ['Belle', 'Bel', 'Bell'],
  stu: ['Stu', 'Estu', 'Stew', 'Estiu'],
  ruffs: ['Ruffs', 'Rafs', 'Rufs', 'Rafts'],
  edgar: ['Edgar', 'Édgar'],
  byron: ['Byron', 'Bairon'],
  lou: ['Lou', 'Lu', 'Low'],
  amber: ['Amber', 'Ámber', 'Ember'],
  colette: ['Colette', 'Colet', 'Kolet'],
  surge: ['Surge', 'Serch', 'Sersh', 'Sorch'],
  sprout: ['Sprout', 'Espraut', 'Sprat'],
  nani: ['Nani', 'Nanny', 'Nany'],
  gale: ['Gale', 'Geil', 'Gueil', 'Yeil'],
  max: ['Max', 'Macs', 'Maks'],
  jacky: ['Jacky', 'Yaki', 'Jaki', 'Jackie'],
  'mr-p': ['Mr. P', 'Mister P', 'Míster Pi'],
  emz: ['Emz', 'Ems', 'Emes'],
  bea: ['Bea', 'Bi'],
  sandy: ['Sandy', 'Sandi'],
  '8-bit': ['8-Bit', '8 bit', 'ocho bit', 'eight bit'],
  bibi: ['Bibi', 'Vivi', 'Bibí'],
  carl: ['Carl', 'Karl'],
  rosa: ['Rosa'],
  leon: ['León', 'Leon', 'Lion'],
  tick: ['Tick', 'Tik', 'Tic'],
  gene: ['Gene', 'Yin', 'Jean', 'Yen'],
  frank: ['Frank', 'Franc'],
  penny: ['Penny', 'Peni'],
  darryl: ['Darryl', 'Daril', 'Darril', 'Dariel'],
  tara: ['Tara'],
  pam: ['Pam', 'Pan'],
  piper: ['Piper', 'Paiper', 'Páiper'],
  bo: ['Bo', 'Bou'],
  poco: ['Poco'],
  crow: ['Crow', 'Cro', 'Crou', 'Krou'],
  mortis: ['Mortis'],
  'el-primo': ['El Primo', 'Primo'],
  dynamike: ['Dynamike', 'Dinamaik', 'Dainamaik', 'Dinamike'],
  nita: ['Nita'],
  jessie: ['Jessie', 'Yesi', 'Jesi', 'Chesi'],
  barley: ['Barley', 'Barli', 'Barly'],
  spike: ['Spike', 'Espaik', 'Spaik'],
  rico: ['Rico'],
  brock: ['Brock', 'Brok', 'Broc'],
  bull: ['Bull', 'Bul', 'Bol'],
  colt: ['Colt', 'Col', 'Kolt'],
  shelly: ['Shelly', 'Cheli', 'Sheli', 'Chely']
};

const roster = ROSTER.map(([id, , name]) => ({ id, name }));
const heardAs = (t: string) => { const r = parseVoice(t, roster); return r.type === 'apply' ? r.brawlerId : `(${r.type})`; };

describe('todos los brawlers se entienden por voz', () => {
  it('cada forma dictada lleva a su brawler (y a ningún otro)', () => {
    const wrong = Object.entries(HEARD).flatMap(([id, forms]) => forms.filter((f) => heardAs(f) !== id).map((f) => `${f} → ${heardAs(f)} (esperado ${id})`));
    expect(wrong).toEqual([]);
  });
  it('también con orden delante: «banea …», «pick rojo …», «rival …»', () => {
    const wrong = Object.entries(HEARD).flatMap(([id, [f]]) => ['banea', 'pick rojo', 'rival'].map((p) => `${p} ${f}`).filter((t) => heardAs(t) !== id).map((t) => `${t} → ${heardAs(t)}`));
    expect(wrong).toEqual([]);
  });
  it('no falta ningún brawler del roster', () => {
    expect(roster.filter((b) => !HEARD[b.id]).map((b) => b.id)).toEqual([]);
  });
});

describe('todos los brawlers dichos seguidos, sin comas', () => {
  const ids = Object.keys(HEARD);
  const chain = (t: string) => parseVoiceList(t, roster).map((c) => (c.type === 'apply' ? c.brawlerId : `(${c.type})`));
  it('cada brawler en un trío con los dos siguientes, con su nombre y con cada forma dictada', () => {
    const wrong: string[] = [];
    ids.forEach((id, i) => {
      const b = ids[(i + 1) % ids.length];
      const c = ids[(i + 2) % ids.length];
      for (const f of HEARD[id]) {
        const t = `${f} ${HEARD[b][0]} ${HEARD[c][0]}`;
        const got = chain(t);
        if (got.join() !== [id, b, c].join()) wrong.push(`${t} → ${got.join(', ')}`);
      }
    });
    expect(wrong).toEqual([]);
  });
});

// Formas más difíciles: palabras del español que el teléfono elige, nombres partidos en dos o con «e» delante
const HARD: Record<string, string[]> = {
  stu: ['es tu', 'estú', 'Stu', 'stew', 'estiu'],
  shade: ['sade', 'sheid', 'shayd', 'cheid', 'shade'],
  squeak: ['es cuic', 'escuik', 'squeak', 'es quik'],
  spike: ['es paik', 'espaik', 'spaik'],
  sprout: ['es praut', 'espraut', 'sprout'],
  surge: ['serch', 'search', 'sarch'],
  'starr-nova': ['estar nova', 'starnova', 'star noba'],
  '8-bit': ['ocho bit', '8bit', 'eit bit', 'ocho bits'],
  'mr-p': ['mister pi', 'misterpi', 'mister p', 'señor p'],
  'r-t': ['erre te', 'ar ti', 'rt'],
  meeple: ['mipel', 'mi pel', 'míple'],
  glowy: ['glowi', 'glou i', 'gloui'],
  ziggy: ['sigui', 'zigui', 'sigi'],
  najia: ['naya', 'nayia', 'najia'],
  kaze: ['keis', 'kase', 'kaze'],
  finx: ['finks', 'fins', 'finx'],
  gale: ['geil', 'gueil', 'gale'],
  buzz: ['bas', 'baz', 'bus'],
  ruffs: ['rafs', 'raf', 'rufs'],
  trunk: ['trank', 'tronk'],
  chuck: ['chak', 'chac'],
  gus: ['gas', 'gus'],
  belle: ['bel', 'bell'],
  willow: ['uilou', 'güilou', 'wilou'],
  byron: ['bairon', 'vairon', 'bayron'],
  pierce: ['pirs', 'piers', 'pirce'],
  sirius: ['sirio', 'serius', 'sirius'],
  'jae-yong': ['yei yong', 'jeiyong', 'yay young'],
  gene: ['yin', 'jean', 'gin'],
  janet: ['yanet', 'llanet'],
  jacky: ['yaki', 'jaki'],
  juju: ['yuyu', 'chuchu'],
  gigi: ['yiyi', 'jiji'],
  'larry-lawrie': ['lari y lori', 'larry and lawrie'],
  'el-primo': ['el primo', 'primo'],
  emz: ['ems', 'emes', 'ens'],
  eve: ['iv', 'ive'],
  lou: ['lu', 'low'],
  moe: ['mou', 'mo'],
  bo: ['bou', 'bo']
};

describe('nombres raros: formas difíciles', () => {
  it('cada forma difícil lleva a su brawler', () => {
    const wrong = Object.entries(HARD).flatMap(([id, forms]) => forms.filter((f) => heardAs(f) !== id).map((f) => `${f} → ${heardAs(f)} (esperado ${id})`));
    expect(wrong).toEqual([]);
  });
  it('y también dentro de una frase con otros nombres', () => {
    const wrong = Object.entries(HARD).flatMap(([id, forms]) => forms.map((f) => `colt ${f} bull`).filter((t) => {
      const got = parseVoiceList(t, roster).map((c) => (c.type === 'apply' ? c.brawlerId : '?'));
      return got.join() !== ['colt', id, 'bull'].join();
    }).map((t) => `${t} → ${parseVoiceList(t, roster).map((c) => (c.type === 'apply' ? c.brawlerId : '?')).join(', ')}`));
    expect(wrong).toEqual([]);
  });
});
