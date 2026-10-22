import type { GameMap } from '../types';

// ROTACIÓN RANKED actual (lista del usuario, oct-2026): 23 mapas.
// Atrapagemas (4) · Zona (5) · Noqueo (4) · Atraco (4) · Recompensa (3) · Balón (3).
// Fotos: BrawlAPI/Brawlify (comunidad, © Supercell). Terreno = ESTIMACIÓN propia, no oficial.
const M = (id: string, name: string, mode: GameMap['mode'], description: string, walls: number, bushes: number, openness: number, controlZones: number, rangeBias: GameMap['rangeBias'], image: string, cdnId: number): GameMap => ({
  id, name, mode, description, walls, bushes, openness, controlZones, rangeBias, image,
  photo: `https://cdn.brawlify.com/maps/regular/${cdnId}.png`
});

export const MAPS: GameMap[] = [
  // Atrapagemas
  M('gem-double-swoosh', 'Double Swoosh', 'Atrapagemas', 'Abierto con coberturas laterales. Francotiradores fuertes.', 2, 2, 4, 4, 'Larga', '🌀', 15000115),
  M('gem-fort', 'Fuerte de Gemas', 'Atrapagemas', 'Centro cerrado con muros y arbustos laterales.', 4, 4, 2, 5, 'Mixta', '💎', 15000010),
  M('gem-hard-rock', 'Hard Rock Mine', 'Atrapagemas', 'Muros en estrella y arbustos en esquinas.', 3, 3, 3, 4, 'Mixta', '⛏️', 15000007),
  M('gem-undermine', 'Undermine', 'Atrapagemas', 'Carriles con muros y arbustos. Pelea por el medio.', 4, 3, 2, 4, 'Mixta', '⛏️', 15000011),
  // Zona Restringida
  M('hz-over-top', 'Al Límite', 'Zona Restringida', 'Zona elevada con accesos laterales. Control y rotación.', 3, 2, 3, 5, 'Mixta', '🔥', 15000651),
  M('hz-open-zone', 'Campo Abierto', 'Zona Restringida', 'Zonas expuestas, poco muro. Sustain y rango.', 2, 2, 4, 5, 'Mixta', '🌾', 15000527),
  M('hz-beetles', 'Dueling Beetles', 'Zona Restringida', 'Zonas divididas con muros intermedios.', 4, 2, 3, 5, 'Mixta', '🪲', 15000306),
  M('hz-parallel', 'Estrategias Paralelas', 'Zona Restringida', 'Carriles paralelos con muros. Presión dividida.', 3, 2, 3, 5, 'Mixta', '↔️', 15000293),
  M('hz-quick-travel', 'Viaje Rápido', 'Zona Restringida', 'Saltaderas para rotar entre zonas. Movilidad clave.', 3, 3, 3, 5, 'Mixta', '🚀', 15000350),
  // Noqueo
  M('ko-belles-rock', "Belle's Rock", 'Noqueo', 'Abierto con coberturas puntuales. El rango manda.', 3, 1, 5, 2, 'Larga', '🪨', 15000368),
  M('ko-flaring-phoenix', 'Fénix en Llamas', 'Noqueo', 'Medio abierto con laterales para flanquear.', 3, 2, 4, 2, 'Larga', '🔥', 15000440),
  M('ko-new-horizons', 'New Horizons', 'Noqueo', 'Abierto con plataformas laterales. Rango y movilidad.', 3, 2, 4, 2, 'Larga', '🌅', 15000703),
  M('ko-open', 'Out in the Open', 'Noqueo', 'Casi sin escondites. Solo puntería.', 2, 1, 5, 2, 'Larga', '👁️', 15000548),
  // Atraco
  M('heist-bridge', 'Bridge Too Far', 'Atraco', 'Puente central con muros. Asedio por el medio.', 4, 2, 3, 2, 'Mixta', '🌉', 15000072),
  M('heist-kaboom', 'Kaboom Canyon', 'Atraco', 'Rutas laterales abiertas para asediar la caja.', 3, 3, 3, 2, 'Mixta', '💥', 15000018),
  M('heist-hot-potato', 'Patata Caliente', 'Atraco', 'Mapa compacto, peleas constantes cerca de las cajas.', 3, 3, 3, 2, 'Mixta', '🥔', 15000053),
  M('heist-safe-zone', 'Refugio', 'Atraco', 'Caja tras muro. DPS a estructuras + defensa.', 4, 2, 3, 2, 'Mixta', '🔐', 15000019),
  // Recompensa
  M('bounty-dry-season', 'Dry Season', 'Recompensa', 'Abierto con coberturas puntuales. El rango manda.', 2, 3, 4, 2, 'Larga', '🌵', 15000083),
  M('bounty-hideout', 'Hideout', 'Recompensa', 'Mucho arbusto central. Asesinos y control.', 3, 4, 3, 2, 'Mixta', '🌿', 15000022),
  M('bounty-layer-cake', 'Layer Cake', 'Recompensa', 'Capas de muros por niveles. Francotiradores fuertes.', 3, 2, 4, 2, 'Larga', '🍰', 15000082),
  // Balón Brawl
  M('bb-palco-central', 'Palco Central', 'Balón Brawl', 'Medio abierto con bandas para jugar por laterales.', 3, 3, 3, 3, 'Mixta', '🏟️', 15000132),
  M('bb-sneaky-fields', 'Sneaky Fields', 'Balón Brawl', 'Muchos arbustos y muros laterales. Tanques y asesinos.', 4, 5, 2, 3, 'Corta', '🌿', 15000050),
  M('bb-triple-dribble', 'Triple Dribble', 'Balón Brawl', 'Tres carriles con muros centrales. Equilibrio total.', 3, 3, 3, 3, 'Mixta', '⚽', 15000025)
];

export const POOL_INFO = 'Rotación Ranked actual · 23 mapas (lista del usuario, oct-2026)';
