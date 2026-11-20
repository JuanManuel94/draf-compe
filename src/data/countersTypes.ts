// Counters descargados de brawlcalculator.com (scripts/update-counters.ts → countersData.json)
export interface RawCounter {
  attacker: string; // id del brawler que gana el enfrentamiento
  defender: string; // id del brawler que lo sufre
  rank: number; // posición en la lista de la página (1 = el counter más fuerte)
  why: string; // explicación en español
  kind: 'counter' | 'victim'; // de la lista "Mejores counters de X" o de "X es un buen pick contra"
}

export interface CountersData {
  source: string;
  updatedAt: string;
  counters: RawCounter[];
  classWeak: Record<string, string[]>; // brawler → clases que lo castigan ("Lanzador", ...)
}
