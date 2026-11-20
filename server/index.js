import express from 'express';
import cors from 'cors';
import { networkInterfaces, homedir } from 'node:os';
import { execFile, execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

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
const lastSeen = new Map(); // pestaña del PC → última señal de vida
app.get('/api/live', (_req, res) => res.json(live));
app.post('/api/live', (req, res) => {
  // Si hay varias pestañas abiertas manda la que cambió el draft más recientemente:
  // una pestaña olvidada no puede pisar el draft que estás llevando en otra
  const body = req.body ?? {};
  // …salvo que la pestaña que mandaba ya no dé señales (cerrada o recargada): entonces manda la nueva
  const ownerGone = !!live && Date.now() - (lastSeen.get(live.source) ?? 0) > 15000;
  const accepted = !live || ownerGone || body.source === live.source || (body.changedAt ?? 0) > (live.changedAt ?? 0);
  if (body.source) lastSeen.set(body.source, Date.now());
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
app.get('/api/live/address', (req, res) => {
  if (typeof req.query.source === 'string') lastSeen.set(req.query.source, Date.now());
  const list = Object.entries(networkInterfaces()).flatMap(([name, nets]) =>
    (nets ?? []).filter((n) => n.family === 'IPv4' && !n.internal).map((n) => ({ name, ip: n.address })));
  const rank = (x) => (VIRTUAL.test(x.name) || x.ip.startsWith('192.168.56.') ? 2 : /wi-?fi|wlan|inal/i.test(x.name) ? 0 : 1);
  const ips = list.sort((a, b) => rank(a) - rank(b)).map((x) => x.ip);
  res.json({ ips, viewers: viewers.size, hasLive: !!live, owner: live?.source ?? null });
});

// --- Conexión por cable USB (no depende de la WiFi) ---
// `adb reverse` hace que en el teléfono http://localhost:5173 sea este PC. Necesita la depuración USB
// activada (la misma que usa scrcpy). Se busca adb en el PATH, en ADB y en carpetas habituales.
function findAdb() {
  const home = homedir();
  const candidates = [
    process.env.ADB,
    'adb',
    'C:\\Program Files\\ASUS\\GlideX\\adb.exe',
    join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk', 'platform-tools', 'adb.exe')
  ];
  // Carpetas de scrcpy descomprimidas en Descargas, Escritorio o la carpeta personal
  for (const dir of [join(home, 'Downloads'), join(home, 'Desktop'), home]) {
    try {
      for (const d of readdirSync(dir)) if (/scrcpy/i.test(d)) candidates.push(join(dir, d, 'adb.exe'), join(dir, d, 'adb'));
    } catch { /* carpeta inexistente */ }
  }
  return candidates.filter(Boolean).find((p) => p === 'adb' ? hasCommand('adb') : existsSync(p)) ?? null;
}
function hasCommand(cmd) {
  try { execFileSync(cmd, ['version'], { stdio: 'ignore', timeout: 5000 }); return true; } catch { return false; }
}
function adb(bin, args) {
  return new Promise((resolve) => execFile(bin, args, { timeout: 15000 }, (err, stdout, stderr) => resolve({ ok: !err, out: `${stdout}${stderr}`.trim() })));
}
app.post('/api/live/usb', async (_req, res) => {
  const bin = findAdb();
  if (!bin) return res.json({ ok: false, reason: 'noadb' });
  const devices = await adb(bin, ['devices']);
  const lines = devices.out.split(/\r?\n/).slice(1).filter((l) => l.trim());
  if (lines.length === 0) return res.json({ ok: false, reason: 'nodevice' });
  if (lines.every((l) => /unauthorized/.test(l))) return res.json({ ok: false, reason: 'unauthorized' });
  const r1 = await adb(bin, ['reverse', 'tcp:5173', 'tcp:5173']);
  const r2 = await adb(bin, ['reverse', 'tcp:3001', 'tcp:3001']);
  res.json({ ok: r1.ok && r2.ok, reason: r1.ok ? undefined : 'reverse', detail: r1.ok ? undefined : r1.out, url: 'http://localhost:5173/?live' });
});

const PORT = 3001;
app.listen(PORT, () => console.log(`[api] Brawl Draft Pro en http://localhost:${PORT} · vista móvil: /?live`));
