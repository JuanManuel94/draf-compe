// Intérprete de órdenes de voz (función pura, testeable sin micrófono).
// Ejemplos: "banea Piper", "pick rojo Mortis", "nosotros El Primo", "deshacer", "el sugerido".
import type { Team } from '../types';

export type VoiceCommand =
  | { type: 'apply'; brawlerId: string; kind: 'pick' | 'ban' | null; team: Team | null; heard: string }
  | { type: 'undo' } | { type: 'redo' } | { type: 'suggest' }
  | { type: 'none'; reason: string };

export interface VoiceBrawler { id: string; name: string }

const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Clave fonética aproximada: el reconocedor en español escribe los nombres ingleses "como suenan"
export function phonetic(s: string): string {
  return strip(s)
    .replace(/[^a-z0-9 ]/g, ' ')
    // "sh"/"sch" suenan como la "ch" española; se protege la "ch" (C) para que la regla c→k no la convierta en "k"
    .replace(/ph/g, 'f').replace(/s?ch|sh/g, 'C').replace(/ck/g, 'k').replace(/qu/g, 'k')
    .replace(/c(?=[eiy])/g, 's').replace(/c/g, 'k').replace(/z/g, 's').replace(/x/g, 'ks')
    .replace(/ee/g, 'i').replace(/oo/g, 'u').replace(/ea/g, 'i')
    .replace(/y/g, 'i').replace(/w/g, 'u').replace(/v/g, 'b').replace(/j/g, 'y').replace(/g(?=[ei])/g, 'y')
    .replace(/h/g, '')
    .replace(/([a-zC])\1+/g, '$1')
    .replace(/C/g, 'ch')
    .replace(/\s+/g, ' ').trim();
}

// Transcripciones típicas del reconocedor en español → nombre del brawler
const ALIASES: Record<string, string[]> = {
  piper: ['paiper', 'paiper', 'payper', 'paipe'],
  spike: ['espaik', 'spaik', 'espaic', 'espay'],
  crow: ['cro', 'crou', 'krou', 'grou'],
  byron: ['bairon', 'bayron'],
  gale: ['geil', 'gueil', 'yeil'],
  jessie: ['yesi', 'yessi', 'chesi'],
  dynamike: ['dinamaik', 'dainamaik', 'dinamique'],
  surge: ['serch', 'sersh', 'soorch'],
  sprout: ['espraut', 'sprout'],
  'el-primo': ['primo', 'el primo'],
  'mr-p': ['mister p', 'mister pi', 'senor p'],
  '8-bit': ['ocho bit', 'eight bit', 'eit bit', 'ocho bits'],
  max: ['macs', 'maks'],
  leon: ['leon', 'lion'],
  gene: ['genio', 'yen', 'yeni', 'yene', 'lleni'],
  rico: ['rico', 'riko'],
  amber: ['amber', 'ember'],
  'jae-yong': ['jaeyong', 'jay yong', 'jay young', 'jei yong', 'yei yong', 'yei yon', 'yei young', 'yeiyong', 'yeiyon', 'jeiyon', 'yeyong', 'jai yong', 'jai yon', 'jei yon'],
  fang: ['fan', 'fank', 'feng', 'fangu'],
  pam: ['pan', 'paam'],
  pearl: ['perl', 'perla', 'peral', 'purl', 'perle'],
  griff: ['grif', 'grief', 'grifo'],
  shade: ['cheid', 'sheid', 'cheit', 'shayd', 'sheyd', 'chaid', 'shaid', 'chait', 'shed', 'ched', 'shady', 'seid', 'said', 'yeid', 'jade', 'shei', 'chei', 'sheit', 'cheide'],
  wendy: ['wendi', 'uendi', 'guendi'],
  'larry-lawrie': ['lari', 'larry y lawrie', 'lari y lori']
};

const ACTIONS: { kind: 'pick' | 'ban'; words: string[] }[] = [
  { kind: 'ban', words: ['banea', 'banear', 'baneo', 'baneamos', 'banean', 'ban', 'bloquea', 'prohibe', 'quita'] },
  { kind: 'pick', words: ['pick', 'pickea', 'pickear', 'pikea', 'elige', 'elijo', 'elegimos', 'eligen', 'escoge', 'selecciona', 'toma', 'cojo', 'cogemos', 'voy con', 'vamos con', 'juego', 'pon'] }
];
const TEAMS: { team: Team; words: string[] }[] = [
  { team: 'blue', words: ['azul', 'azules', 'nosotros', 'nuestro', 'nuestra', 'mi equipo', 'aliado', 'aliados', 'yo'] },
  { team: 'red', words: ['rojo', 'rojos', 'ellos', 'rival', 'rivales', 'enemigo', 'enemigos', 'contrario'] }
];
const UNDO = ['deshacer', 'deshaz', 'deshace', 'atras', 'borra', 'borrar', 'quita el ultimo', 'me equivoque'];
const REDO = ['rehacer', 'rehaz', 'rehace'];
const SUGGEST = ['sugerido', 'sugerencia', 'recomendado', 'recomendacion', 'el mejor', 'lo que digas', 'aplica', 'el que digas'];

function lev(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[a.length][b.length];
}
const similarity = (a: string, b: string) => (a === b ? 1 : 1 - lev(a, b) / Math.max(a.length, b.length, 1));
const hasWord = (text: string, w: string) => new RegExp(`(^| )${w}( |$)`).test(text);

// Busca el brawler en ventanas de 1 a 3 palabras del texto (nombres como "el primo" o "larry y lawrie")
export function matchBrawler(text: string, roster: VoiceBrawler[]): { id: string; score: number; heard: string } | null {
  const words = phonetic(text).split(' ').filter(Boolean);
  const candidates = roster.map((b) => ({ id: b.id, keys: [phonetic(b.name), ...(ALIASES[b.id] ?? []).map(phonetic)] }));
  let best: { id: string; score: number; heard: string } | null = null;
  for (let n = 1; n <= 3; n++) {
    for (let i = 0; i + n <= words.length; i++) {
      const chunk = words.slice(i, i + n).join(' ');
      if (chunk.length < 2) continue;
      for (const c of candidates) {
        for (const k of c.keys) {
          const s = similarity(chunk, k);
          // Prefiere coincidencias más largas ante empate (evita que "el" gane a "el primo")
          if (!best || s > best.score || (s === best.score && chunk.length > best.heard.length)) best = { id: c.id, score: s, heard: chunk };
        }
      }
    }
  }
  // Nombres cortos ("Max", "Bo") exigen más precisión que los largos
  if (!best) return null;
  const minScore = best.heard.length <= 3 ? 0.99 : best.heard.length <= 5 ? 0.79 : 0.74;
  return best.score >= minScore ? best : null;
}

export function parseVoice(transcript: string, roster: VoiceBrawler[]): VoiceCommand {
  const text = phonetic(transcript);
  if (!text) return { type: 'none', reason: 'No he oído nada.' };
  const plain = strip(transcript).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (REDO.some((w) => hasWord(plain, w))) return { type: 'redo' };
  if (UNDO.some((w) => plain.includes(w))) return { type: 'undo' };
  const kind = ACTIONS.find((a) => a.words.some((w) => hasWord(plain, w)))?.kind ?? null;
  const team = TEAMS.find((t) => t.words.some((w) => hasWord(plain, w)))?.team ?? null;
  // Quita las palabras de acción/equipo antes de buscar el nombre (que "rojo" no se lea como un brawler)
  const noise = [...ACTIONS.flatMap((a) => a.words), ...TEAMS.flatMap((t) => t.words), 'para', 'el equipo', 'equipo', 'a', 'al', 'de', 'por favor', 'ahora'];
  let rest = ` ${plain} `;
  for (const w of noise.sort((x, y) => y.length - x.length)) rest = rest.replace(new RegExp(` ${w}(?= )`, 'g'), ' ');
  const m = matchBrawler(rest, roster);
  if (m) return { type: 'apply', brawlerId: m.id, kind, team, heard: m.heard };
  if (SUGGEST.some((w) => plain.includes(w))) return { type: 'suggest' };
  return { type: 'none', reason: `No reconozco ningún brawler en «${transcript}».` };
}
