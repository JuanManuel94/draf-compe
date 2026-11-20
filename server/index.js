import express from 'express';
import cors from 'cors';
import { networkInterfaces } from 'node:os';

const app = express();
app.use(cors());
app.use(express.json({ limit: '256kb' }));

// Prototipo: el frontend es la fuente de verdad (src/data/*).
// Este servidor expone el mismo contrato para migrar a Postgres sin cambiar el motor.
app.get('/api/health', (_req, res) => res.json({ ok: true, dataset: 'meta Ranked real (brawlbetter) + counters (brawlcalculator), ver src/data' }));
app.get('/api/brawlers', (_req, res) => res.json({ info: 'Usa src/data/brawlers.ts y roster.ts como fuente. Ver README para migrar a Prisma/Postgres.' }));
app.get('/api/maps', (_req, res) => res.json({ info: 'Usa src/data/maps.ts como fuente.' }));
app.get('/api/matchups', (_req, res) => res.json({ info: 'Usa src/data/countersData.json (npm run counters:update) como fuente.' }));
app.post('/api/recommend', (req, res) => res.json({ info: 'Motor completo en src/engine/scoring.ts scoreAll(). Conecta Prisma aquí sin cambiar su firma.', echo: req.body ?? {} }));

// --- Draft en vivo para el teléfono ---
// El PC publica una foto del draft (POST /api/live) y cada teléfono conectado la recibe al instante
// por Server-Sent Events (GET /api/live/stream). Todo va por tu WiFi: nada sale a internet.
let live = null;
const viewers = new Set();
app.get('/api/live', (_req, res) => res.json(live));
app.post('/api/live', (req, res) => {
  // Si hay varias pestañas abiertas manda la que cambió el draft más recientemente:
  // una pestaña olvidada no puede pisar el draft que estás llevando en otra
  const body = req.body ?? {};
  const accepted = !live || body.source === live.source || (body.changedAt ?? 0) > (live.changedAt ?? 0);
  if (process.env.LIVE_DEBUG) console.log('[live]', new Date().toISOString().slice(11, 19), req.get('referer'), body.source, body.changedAt, body.step, accepted ? 'OK' : 'ignorado');
  if (!accepted) return res.json({ ok: true, accepted: false, viewers: viewers.size });
  live = { ...body, at: Date.now() };
  const msg = `data: ${JSON.stringify(live)}\n\n`;
  for (const v of viewers) v.write(msg);
  res.json({ ok: true, accepted: true, viewers: viewers.size });
});
app.get('/api/live/stream', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  if (live) res.write(`data: ${JSON.stringify(live)}\n\n`);
  viewers.add(res);
  // Latido visible para el teléfono: si deja de llegar, sabe que perdió la conexión y reconecta
  const ping = setInterval(() => res.write('event: ping\ndata: 1\n\n'), 8000);
  req.on('close', () => { clearInterval(ping); viewers.delete(res); });
});
// Direcciones de este PC en la red local, para abrir la vista desde el teléfono
// Los adaptadores virtuales (VirtualBox, VMware, Hyper-V/WSL) van al final: el teléfono no los alcanza
const VIRTUAL = /virtual|vbox|vmware|vethernet|hyper-v|wsl|docker|loopback|tailscale|zerotier/i;
app.get('/api/live/address', (_req, res) => {
  const list = Object.entries(networkInterfaces()).flatMap(([name, nets]) =>
    (nets ?? []).filter((n) => n.family === 'IPv4' && !n.internal).map((n) => ({ name, ip: n.address })));
  const rank = (x) => (VIRTUAL.test(x.name) || x.ip.startsWith('192.168.56.') ? 2 : /wi-?fi|wlan|inal/i.test(x.name) ? 0 : 1);
  const ips = list.sort((a, b) => rank(a) - rank(b)).map((x) => x.ip);
  res.json({ ips, viewers: viewers.size, hasLive: !!live });
});

const PORT = 3001;
app.listen(PORT, () => console.log(`[api] Brawl Draft Pro en http://localhost:${PORT} · vista móvil: /?live`));
