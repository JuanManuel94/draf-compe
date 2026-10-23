import type { GameMap } from '../types';

// ROTACIÓN RANKED (comprobada el 22-oct-2026): 26 mapas = 4 por modo + Noqueo como modo destacado (6).
// Fuentes: brawlbetter.com/ranked-maps (mapas vistos en partidas Ranked de los últimos 7 días) y
// Trophycoach (pool de la temporada 49, 4 por modo). Se incluyen los 24 en los que coinciden ambas
// más Goldarm Gulch y Flowing Springs (Noqueo, con datos completos en partidas Ranked actuales).
// Fuera respecto a la lista anterior: Over The Top, Open Zone y Quick Travel (no aparecen en la
// rotación actual; BrawlAPI marca Over The Top y Quick Travel como desactivados).
// Fotos: BrawlAPI/Brawlify (comunidad, © Supercell). Terreno = ESTIMACIÓN propia a partir del mapa, no oficial.
const API_DISABLED: number[] = []; // ids que BrawlAPI marque como desactivados (ninguno del pool actual)
const M = (id: string, name: string, mode: GameMap['mode'], description: string, walls: number, bushes: number, openness: number, controlZones: number, rangeBias: GameMap['rangeBias'], image: string, cdnId: number): GameMap => ({
  id, name, mode, description, walls, bushes, openness, controlZones, rangeBias, image, cdnId,
  photo: `https://cdn.brawlify.com/maps/regular/${cdnId}.png`,
  apiDisabled: API_DISABLED.includes(cdnId)
});

export const MAPS: GameMap[] = [
  // Atrapagemas
  M('gem-double-swoosh', 'Double Swoosh', 'Atrapagemas', 'Abierto con coberturas laterales. Francotiradores fuertes.', 2, 2, 4, 4, 'Larga', '🌀', 15000115),
  M('gem-fort', 'Fuerte de Gemas', 'Atrapagemas', 'Centro cerrado con muros y arbustos laterales.', 4, 4, 2, 5, 'Mixta', '💎', 15000010),
  M('gem-hard-rock', 'Hard Rock Mine', 'Atrapagemas', 'Muros en estrella y arbustos en esquinas.', 3, 3, 3, 4, 'Mixta', '⛏️', 15000007),
  M('gem-undermine', 'Undermine', 'Atrapagemas', 'Carriles con muros y arbustos. Pelea por el medio.', 4, 3, 2, 4, 'Mixta', '⛏️', 15000011),
  // Zona Restringida
  M('hz-open-business', 'Open Business', 'Zona Restringida', 'Una zona central muy expuesta con coberturas sueltas y arbustos en los bordes. Rango y sustain.', 2, 3, 4, 5, 'Mixta', '🏪', 15000292),
  M('hz-ring-of-fire', 'Ring of Fire', 'Zona Restringida', 'Zona central entre lagos y dos grandes franjas de arbustos: emboscadas y peleas a corta distancia.', 3, 5, 2, 5, 'Corta', '💍', 15000300),
  M('hz-beetles', 'Dueling Beetles', 'Zona Restringida', 'Zonas divididas con muros intermedios.', 4, 2, 3, 5, 'Mixta', '🪲', 15000306),
  M('hz-parallel', 'Estrategias Paralelas', 'Zona Restringida', 'Carriles paralelos con muros. Presión dividida.', 3, 2, 3, 5, 'Mixta', '↔️', 15000293),
  // Noqueo
  M('ko-belles-rock', "Belle's Rock", 'Noqueo', 'Abierto con coberturas puntuales. El rango manda.', 3, 1, 5, 2, 'Larga', '🪨', 15000368),
  M('ko-flaring-phoenix', 'Fénix en Llamas', 'Noqueo', 'Medio abierto con laterales para flanquear.', 3, 2, 4, 2, 'Larga', '🔥', 15000440),
  M('ko-new-horizons', 'New Horizons', 'Noqueo', 'Abierto con plataformas laterales. Rango y movilidad.', 3, 2, 4, 2, 'Larga', '🌅', 15000703),
  M('ko-open', 'Out in the Open', 'Noqueo', 'Casi sin escondites. Solo puntería.', 2, 1, 5, 2, 'Larga', '👁️', 15000548),
  M('ko-goldarm-gulch', 'Goldarm Gulch', 'Noqueo', 'Pasillos de muros y lagos con arbustos en los bordes para flanquear.', 4, 3, 3, 2, 'Mixta', '🤠', 15000367),
  M('ko-flowing-springs', 'Flowing Springs', 'Noqueo', 'Ríos que parten el mapa en carriles y coberturas medias. Control de carril.', 3, 3, 3, 2, 'Mixta', '🌊', 15000502),
  // Atraco
  M('heist-bridge', 'Bridge Too Far', 'Atraco', 'Puente central con muros. Asedio por el medio.', 4, 2, 3, 2, 'Mixta', '🌉', 15000072),
  M('heist-kaboom', 'Kaboom Canyon', 'Atraco', 'Rutas laterales abiertas para asediar la caja.', 3, 3, 3, 2, 'Mixta', '💥', 15000018),
  M('heist-hot-potato', 'Patata Caliente', 'Atraco', 'Mapa compacto, peleas constantes cerca de las cajas.', 3, 3, 3, 2, 'Mixta', '🥔', 15000053),
  M('heist-safe-zone', 'Refugio', 'Atraco', 'Caja tras muro. DPS a estructuras + defensa.', 4, 2, 3, 2, 'Mixta', '🔐', 15000019),
  // Recompensa
  M('bounty-dry-season', 'Dry Season', 'Recompensa', 'Abierto con coberturas puntuales. El rango manda.', 2, 3, 4, 2, 'Larga', '🌵', 15000083),
  M('bounty-hideout', 'Hideout', 'Recompensa', 'Mucho arbusto central. Asesinos y control.', 3, 4, 3, 2, 'Mixta', '🌿', 15000022),
  M('bounty-shooting-star', 'Shooting Star', 'Recompensa', 'Muy abierto con coberturas sueltas. Francotiradores y rango largo mandan.', 2, 2, 5, 2, 'Larga', '🌠', 15000005),
  M('bounty-layer-cake', 'Layer Cake', 'Recompensa', 'Capas de muros por niveles. Francotiradores fuertes.', 3, 2, 4, 2, 'Larga', '🍰', 15000082),
  // Balón Brawl
  M('bb-palco-central', 'Palco Central', 'Balón Brawl', 'Medio abierto con bandas para jugar por laterales.', 3, 3, 3, 3, 'Mixta', '🏟️', 15000132),
  M('bb-pinball-dreams', 'Pinball Dreams', 'Balón Brawl', 'Hileras de muros en el medio y arbustos laterales: rebotes y juego por carriles.', 3, 3, 3, 3, 'Mixta', '🎰', 15000118),
  M('bb-sneaky-fields', 'Sneaky Fields', 'Balón Brawl', 'Muchos arbustos y muros laterales. Tanques y asesinos.', 4, 5, 2, 3, 'Corta', '🌿', 15000050),
  M('bb-triple-dribble', 'Triple Dribble', 'Balón Brawl', 'Tres carriles con muros centrales. Equilibrio total.', 3, 3, 3, 3, 'Mixta', '⚽', 15000025)
];

export const POOL_INFO = 'Rotación Ranked actual · 26 mapas (comprobada 22-oct-2026)';
