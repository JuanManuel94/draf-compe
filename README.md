# Brawl Draft Pro — compañero de partida en vivo + formato torneo BSC

**Uso principal:** durante tu partida, marca los picks/baneos de ELLOS (rojo) y los vuestros (azul); la app te dice al instante **qué pickear** (🎯 "Tu mejor pick ahora"). Sin sorteos ni turnos que te frenen.

**Datos:** rotación Ranked comprobada el 22-oct-2026 (26 mapas: 4 por modo + 6 de Noqueo como modo destacado; fuentes brawlbetter.com y trophycoach.com) · 108 brawlers con foto, rarezas y clases de BrawlAPI/Brawlify (comunidad; imágenes © Supercell; Buzz Lightyear eliminado del juego) · **327 enfrentamientos investigados de brawlcalculator.com (jul-2026, datos SpenLC) para los 24 brawlers más drafteados** + matriz de clases como respaldo · **meta oct-2026 investigada** (brawlplanet 150M partidas, brawlstatsx, brawlmetrics Buffies, seemeta): tiers S/A/flojo + Buffies 🔥 · el motor exige que el counter **vaya bien en el mapa** (si counterea pero va mal, avisa y pierde fuerza) · ratings y terreno = estimación propia, nunca oficial. Sin integración oficial ni lectura automática.

Asistente de draft competitivo para Brawl Stars con el formato oficial actual: **sorteo inicial, 3 bans ciegos por equipo (1 por jugador), 6 picks snake** (BSC 2026 rulebook v1.6, BLAST.tv 29/06/2026; la pre-season añade 2 bans globales de match y map draft). **Pool de mapas en vivo, 109 brawlers con foto.**

**Fuentes y honestidad:** catálogo, rarezas, clases, mapas e imágenes = BrawlAPI/Brawlify (comunidad; imágenes © Supercell). Ratings, terreno, matchups y scores = estimación propia, nunca oficial. No existe integración oficial con el juego ni lectura automática de partidas.

## Qué incluye
- Pantalla de draft interactiva (azul/rojo/bans, turnos, estricto/libre/manual).
- Motor de recomendación 0–100 (`src/engine/scoring.ts`): 30% mapa/modo, 30% matchups, 20% sinergia, 10% competitivo, 10% flex. Pesos ajustables.
- Counters con 5 niveles (hardCounter → hardCountered), confianza y dependencia de mapa.
- Catálogo de mapas con filtros, baneos sugeridos Top 3–5, búsqueda/filtros/comparador/favoritas/historial/exportar, undo/redo, persistencia local, responsive.

## Instalación y ejecución
```bash
npm install
npm run dev      # frontend http://localhost:5173
npm run server   # API http://localhost:3001 (opcional)
npm run build    # tsc + vite build
```

## Endpoints API
- `GET /api/health` — estado + dataset
- `GET /api/brawlers` — catálogo
- `GET /api/maps` — mapas
- `GET /api/matchups` — enfrentamientos
- `POST /api/recommend` — `{ mapId, allies, enemies, banned, picked, weights }` → recomendaciones ordenadas

## Estructura
```
src/types.ts            # modelos
src/data/brawlers.ts    # 24 brawlers ejemplo
src/data/maps.ts        # 9 mapas ejemplo
src/data/meta.ts        # stats ejemplo + formatos + matchups
src/engine/scoring.ts   # puntuación + bans (NO tocar al migrar datos)
src/engine/draftMachine.ts # máquina de estados del draft
src/engine/storage.ts   # persistencia local
src/App.tsx             # UI 3 paneles
server/index.js         # Express REST
prisma/schema.prisma    # migración a PostgreSQL
```

## Actualizar datos competitivos (sin tocar el motor)
1. Edita `src/data/brawlers.ts`, `maps.ts`, `meta.ts` (campos `updatedAt`, `source`, confianza).
2. O alimenta vía API e importa el JSON resultante.
3. Para Postgres: `npx prisma migrate dev`, importa los JSON a las tablas y cambia solo la capa de carga (los `import` de `src/data/*` por llamadas Prisma). La firma de `scoreAll()` no cambia.
4. Marca mapas retirados con `active=false` en vez de borrarlos.
5. Nunca presentes estimaciones como oficiales: usa el campo `confidence` y el banner de la UI.

## Meta Ranked real

Las recomendaciones y los baneos sugeridos usan winrates reales de partidas Ranked de jugadores top
(brawlbetter.com, últimos 21 días) guardados en `src/data/realMeta.json`. Para actualizarlos:

```bash
npm run meta:update
```

Tarda unos minutos (una página por mapa, con pausa entre peticiones). El winrate se ajusta según las
partidas que lo respaldan: un 66% en 38 partidas pesa mucho menos que un 59% en 344.

## Pick por voz

Pulsa 🎤 (o la tecla `V`) y di la acción: «banea Piper», «pick rojo Mortis», «nosotros El Primo»,
«deshacer», «rehacer» o «el sugerido». Si no dices el equipo o la acción, se usa el paso actual.
Funciona en Chrome, Edge y Safari (la voz la procesa el servicio del navegador); en Brave y Firefox no.
