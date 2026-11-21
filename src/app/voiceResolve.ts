import { MAPS } from '../data/maps';
import { getAllBrawlers } from '../engine/scoring';
import { closestBrawlers, matchAllBrawlers, matchName } from '../engine/voice';

// Qué escribir en un buscador a partir de lo dicho por voz
const roster = () => getAllBrawlers().map((b) => ({ id: b.id, name: b.name }));

export function resolveBrawlerName(heard: string): string | null {
  const r = roster();
  const id = matchAllBrawlers(heard, r)[0]?.id ?? closestBrawlers(heard, r, 1)[0];
  return id ? r.find((b) => b.id === id)?.name ?? null : null;
}

export function resolveMapName(heard: string): string | null {
  const modes = [...new Set(MAPS.map((m) => m.mode))];
  const items = [
    ...MAPS.map((m) => ({ id: `m:${m.name}`, names: [m.name, m.en ?? ''].filter(Boolean) })),
    ...modes.map((mo) => ({ id: `o:${mo}`, names: [mo] }))
  ];
  const id = matchName(heard, items);
  return id ? id.slice(2) : null;
}
