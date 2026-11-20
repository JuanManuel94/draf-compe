// Descarga el meta Ranked REAL (partidas de jugadores top) de brawlbetter.com para los mapas de
// nuestra rotación y lo guarda en src/data/realMeta.json. Uso: npm run meta:update
// brawlbetter.com/robots.txt permite /maps; se piden las páginas de una en una con pausa.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MAPS } from '../src/data/maps';
import { ROSTER } from '../src/data/roster';
import type { RealMeta, RealMapStats } from '../src/data/realMetaTypes';

const BASE = 'https://www.brawlbetter.com';
const UA = 'Mozilla/5.0 (BrawlDraftPro meta updater)';
const OUT = fileURLToPath(new URL('../src/data/realMeta.json', import.meta.url));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

async function get(url: string): Promise<string> {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return r.text();
}

// El estado de la página viene serializado como objetos JS ({name:"Shade",games:165,winRate:0.66,...})
function parseObjects(src: string, startKey: string): Record<string, string | number | boolean>[] {
  const i = src.indexOf(startKey);
  if (i < 0) return [];
  // La lista acaba en "}]" (las referencias $R[n] también llevan corchetes)
  const end = src.indexOf('}]', src.indexOf('brawlers:', i)) + 1;
  const chunk = src.slice(i, end);
  return [...chunk.matchAll(/\{([^{}]*name:"[^"]+"[^{}]*)\}/g)].map((m) => {
    const o: Record<string, string | number | boolean> = {};
    for (const [, k, v] of m[1].matchAll(/(\w+):("(?:[^"\\]|\\.)*"|!0|!1|[-\d.e]+)/g)) {
      o[k] = v.startsWith('"') ? JSON.parse(v) : v === '!0' ? true : v === '!1' ? false : Number(v);
    }
    return o;
  });
}

const byName = new Map(ROSTER.map(([key, , name]) => [norm(name), key]));
const keyOf = (name: string) => byName.get(norm(name)) ?? byName.get(norm(name.replace(/&/g, 'and')));

async function main() {
  // Slugs reales de brawlbetter y nombres en inglés de BrawlAPI para casar con nuestros ids
  const index = await get(`${BASE}/ranked-maps`);
  const slugs = [...new Set([...index.matchAll(/href="\/maps\/([a-z0-9-]+)"/g)].map((m) => m[1]))];
  const out: RealMeta = { source: 'brawlbetter.com (Ranked de jugadores top)', updatedAt: new Date().toISOString().slice(0, 10), windowDays: 0, blindSafety: {}, maps: {} };
  const unknown = new Set<string>();

  for (const map of MAPS) {
    const api = await fetch(`https://api.brawlapi.com/v1/maps/${map.cdnId}`).then((r) => r.json()) as { name: string };
    const slug = slugs.find((s) => norm(s) === norm(api.name)) ?? slugs.find((s) => norm(s) === norm(map.en ?? map.name));
    if (!slug) { console.warn(`⚠ ${map.name}: sin página en brawlbetter`); continue; }
    const html = await get(`${BASE}/maps/${slug}`);
    const head = html.match(/insights:\$R\[\d+\]=\{windowDays:(\d+),battles:(\d+),lastPlayed:"([^"]*)",firstPlayed:"[^"]*",inRotation:(!0|!1)/);
    // La página trae el top 12 y además las listas "más pickeados", "sobrevalorados", "evitar"...:
    // se juntan todas las filas con winrate del bloque de insights (sin repetir brawler)
    const ins = html.indexOf('insights:');
    const block = html.slice(ins, html.indexOf('</script>', ins));
    const seen = new Set<string>();
    const rows = [...block.matchAll(/\{(name:"[^"]+",class:"[^"]*",blind:\d+,boost:\d+,games:[^{}]*)\}/g)]
      .map((m) => parseObjects(`brawlers:[{${m[1]}}]`, 'brawlers:')[0])
      .filter((r) => r && typeof r.winRate === 'number' && !seen.has(String(r.name)) && seen.add(String(r.name)));
    if (!head || rows.length === 0) { console.warn(`⚠ ${map.name}: sin datos medidos`); continue; }
    const stats: RealMapStats = { slug, battles: Number(head[2]), lastPlayed: head[3], inRotation: head[4] === '!0', brawlers: {} };
    for (const r of rows) {
      const key = keyOf(String(r.name));
      if (!key) { unknown.add(String(r.name)); continue; }
      stats.brawlers[key] = {
        wr: +Number(r.winRate).toFixed(4), games: Number(r.games), pick: +Number(r.pickRate).toFixed(4),
        modeWr: +Number(r.modeWinRate).toFixed(4), modeGames: Number(r.modeGames),
        reliability: String(r.reliability), verdict: String(r.verdict)
      };
    }
    out.windowDays = Number(head[1]);
    out.maps[map.id] = stats;
    // Seguridad a ciegas (1-10) del modelo de brawlbetter: viene en la lista global de cada página
    if (Object.keys(out.blindSafety).length === 0) {
      for (const b of parseObjects(html, 'data:$R')) {
        const key = keyOf(String(b.name));
        if (key && typeof b.blind === 'number') out.blindSafety[key] = b.blind;
      }
    }
    console.log(`✓ ${map.name.padEnd(24)} ${String(rows.length).padStart(3)} brawlers · ${stats.battles} partidas · rotación: ${stats.inRotation ? 'sí' : 'NO'}`);
    await sleep(800);
  }
  if (unknown.size) console.warn(`⚠ Brawlers sin casar con el roster: ${[...unknown].join(', ')}`);
  writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`\nGuardado ${OUT} · ${Object.keys(out.maps).length}/${MAPS.length} mapas · ventana ${out.windowDays} días · ${out.updatedAt}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
