// Descarga los counters de TODOS los brawlers de brawlcalculator.com (versión en español, datos de
// ranking SpenLC) y los guarda en src/data/countersData.json. Uso: npm run counters:update
// brawlcalculator.com/robots.txt permite /es/counters; se piden las páginas de una en una con pausa.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ROSTER } from '../src/data/roster';
import type { CountersData, RawCounter } from '../src/data/countersTypes';

const BASE = 'https://brawlcalculator.com';
const UA = 'Mozilla/5.0 (BrawlDraftPro counters updater)';
const OUT = fileURLToPath(new URL('../src/data/countersData.json', import.meta.url));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const byName = new Map(ROSTER.map(([key, , name]) => [norm(name), key]));
// La web acorta algunos nombres ("Larry" = Larry & Lawrie): si no casa entero, se busca por el inicio
const keyOf = (name: string) => byName.get(norm(name)) ?? byName.get(norm(name.replace(/&/g, 'and')))
  ?? (norm(name).length >= 4 ? [...byName.entries()].find(([n]) => n.startsWith(norm(name)))?.[1] : undefined);
const text = (html: string) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();

async function get(url: string): Promise<string> {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return r.text();
}

// Cada <section> trae un <h2> y una lista de <li> con el brawler (<span>) y el porqué (<p class="why">)
function sectionItems(html: string, h2Start: string): { name: string; why: string }[] {
  const i = html.indexOf(`<h2>${h2Start}`);
  if (i < 0) return [];
  const block = html.slice(i, html.indexOf('</section>', i));
  return [...block.matchAll(/<li>[\s\S]*?<span>([^<]+)<\/span>[\s\S]*?<p class="why">([\s\S]*?)<\/p>[\s\S]*?<\/li>/g)]
    .map((m) => ({ name: text(m[1]), why: text(m[2]) }));
}

async function main() {
  const sitemap = await get(`${BASE}/sitemap.xml`);
  const slugs = [...new Set([...sitemap.matchAll(/\/es\/counters\/([a-z0-9-]+)\//g)].map((m) => m[1]))];
  const out: CountersData = { source: 'brawlcalculator.com/es/counters (datos de ranking SpenLC)', updatedAt: new Date().toISOString().slice(0, 10), counters: [], classWeak: {} };
  const unknown = new Set<string>();
  let pages = 0;

  for (const slug of slugs) {
    let html: string;
    try { html = await get(`${BASE}/es/counters/${slug}/`); } catch (e) { console.warn(`⚠ ${slug}: ${(e as Error).message}`); continue; }
    const title = text(html.match(/<h1>([\s\S]*?)<\/h1>/)?.[1] ?? '').replace(/^Counters de\s+/i, '');
    const target = keyOf(title);
    if (!target) { unknown.add(title || slug); await sleep(400); continue; }
    const counters = sectionItems(html, 'Mejores counters');
    const victims = sectionItems(html, `${title} es un buen pick`);
    counters.forEach((c, rank) => {
      const a = keyOf(c.name);
      if (!a) { unknown.add(c.name); return; }
      out.counters.push({ attacker: a, defender: target, rank: rank + 1, why: c.why, kind: 'counter' } satisfies RawCounter);
    });
    victims.forEach((v, rank) => {
      const d = keyOf(v.name);
      if (!d) { unknown.add(v.name); return; }
      out.counters.push({ attacker: target, defender: d, rank: rank + 1, why: v.why, kind: 'victim' } satisfies RawCounter);
    });
    const weakLine = html.match(/<p class="classes">([\s\S]*?)<\/p>/)?.[1] ?? '';
    const classes = [...weakLine.matchAll(/<span class="chip">([^<]+)<\/span>/g)].map((m) => text(m[1]));
    if (classes.length) out.classWeak[target] = classes;
    pages++;
    console.log(`✓ ${title.padEnd(16)} ${String(counters.length).padStart(2)} counters · ${String(victims.length).padStart(2)} víctimas${classes.length ? ' · débil vs ' + classes.join(', ') : ''}`);
    await sleep(600);
  }
  if (unknown.size) console.warn(`⚠ Sin casar con el roster (se ignoran): ${[...unknown].join(', ')}`);
  writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`\nGuardado ${OUT} · ${pages} brawlers · ${out.counters.length} enfrentamientos · ${out.updatedAt}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
