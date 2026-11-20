// Foto del draft que el PC envía al teléfono (vista /?live). Va ya resuelta (nombres, fotos, textos)
// para que el teléfono solo tenga que pintarla.
export interface LiveBrawler { id: string; name: string; img?: string }
export interface LiveSnapshot {
  mapName: string;
  mode: string;
  mapPhoto?: string;
  step: string; // qué toca ahora, en texto
  ourTurn: boolean; // nos toca pickear
  myTurn: boolean; // le toca justo al jugador (según "¿qué pick eres tú?")
  stepStart: number; // epoch ms del inicio del paso (el teléfono calcula la cuenta atrás)
  stepSeconds: number;
  timerOn: boolean;
  bansBlue: LiveBrawler[];
  bansRed: LiveBrawler[];
  picksBlue: (LiveBrawler | null)[]; // FP, MID, LAST
  picksRed: (LiveBrawler | null)[]; // FP, MID, LAST
  best: (LiveBrawler & { score: number; why: string })[]; // mejores picks ahora
  bans: (LiveBrawler & { why: string })[]; // bans sugeridos (solo en fase de bans)
  counters: { enemy: LiveBrawler; options: (LiveBrawler & { matchup: number; map: number })[] }[];
  threats: string[];
  verdict: { winChance: number; text: string; tip: string } | null;
  autoDetect: boolean; // la detección automática está leyendo la pantalla
  source: string; // id de la pestaña del PC que publica
  changedAt: number; // cuándo cambió su draft por última vez (0 = no ha cambiado desde que se abrió)
  at?: number;
}
