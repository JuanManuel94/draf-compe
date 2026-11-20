# Brawl Draft Pro — compañero de partida en vivo + formato torneo BSC

**Uso principal:** durante tu partida, marca los picks/baneos de ELLOS (rojo) y los vuestros (azul); la app te dice al instante **qué pickear** (🎯 "Tu mejor pick ahora"). Sin sorteos ni turnos que te frenen.

**Datos (actualizados el 20-nov-2026, tras el Ranked Refresh):** rotación Ranked de 26 mapas (brawlbetter.com/ranked-maps) · 108 brawlers con foto, rarezas y clases de BrawlAPI/Brawlify (comunidad; imágenes © Supercell) · **counters de los 108 brawlers (1.300 enfrentamientos) de brawlcalculator.com, datos de ranking SpenLC** · **meta Ranked real por mapa** (brawlbetter.com, últimos 21 días, ~1.100 partidas por mapa) · el motor solo da por bueno un counter si **gana el duelo y además rinde en el mapa** · ratings y terreno = estimación propia, nunca oficial.

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

## Uso en Mítico+ con el teléfono

Pulsa **📱** en la cabecera:

1. **Ver el draft en el teléfono:** escanea el QR con el teléfono en la misma WiFi (o abre `http://IP-DEL-PC:5173/?live`). Muestra bans, picks, el mejor pick, los counters que van bien en el mapa, el temporizador y la predicción final, en directo. Ábrelo en ventana flotante o pantalla dividida de Android. Si Windows pregunta por el firewall, permite redes privadas.
2. **Detección automática:** refleja el teléfono en el PC con [scrcpy](https://github.com/Genymobile/scrcpy) (depuración USB activada), pulsa *Compartir pantalla* y elige su ventana. Con el draft vacío, marca una vez cada hueco (bans y picks de cada equipo) y pulsa *Fotografiar huecos vacíos*. Al *Iniciar detección*, los bans y picks se marcan solos (los picks respetan el orden 1-2-2-1) y el mejor pick se recalcula al momento. Si se equivoca, *Corregir* arregla el draft y la detección aprende ese retrato. Todo se procesa en el PC; no toca el juego.

## Counters (duelo + mapa)
- `npm run counters:update` descarga los counters de los 108 brawlers a `src/data/countersData.json`.
- Un counter solo cuenta entero si el brawler también rinde en el mapa (nota de mapa ≥ 55). Si no, su ventaja se recorta y la app avisa.
- El panel «🎯 Counters que también van bien en …» lista, para cada pick rival, los counters que cumplen las dos condiciones.
- Al cerrar el draft: predicción de victoria (acotada a 20–80 %), duelos por línea y avisos de composición.

## Estructura
```
src/types.ts            # modelos
src/data/brawlers.ts    # 24 fichas detalladas (el resto, por clase)
src/data/maps.ts        # 26 mapas de la rotación Ranked
src/data/countersData.json # counters de los 108 brawlers (npm run counters:update)
src/engine/liveCounters.ts # lee los counters descargados
src/engine/vision.ts    # reconocimiento de retratos (detección automática)
src/components/PhonePanel.tsx # QR del teléfono + detección automática
src/components/LiveView.tsx  # vista del teléfono (/?live)
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
npm run meta:update      # winrates por mapa
npm run counters:update  # counters de todos los brawlers
npm run data:update      # los dos
```

Tarda unos minutos (una página por mapa, con pausa entre peticiones). El winrate se ajusta según las
partidas que lo respaldan: un 66% en 38 partidas pesa mucho menos que un 59% en 344.

## Pick por voz

Pulsa 🎤 (o la tecla `V`) y di la acción: «banea Piper», «pick rojo Mortis», «nosotros El Primo»,
«deshacer», «rehacer» o «el sugerido». Si no dices el equipo o la acción, se usa el paso actual.
Funciona en Chrome, Edge y Safari (la voz la procesa el servicio del navegador); en Brave y Firefox no.
