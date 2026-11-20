import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { useApp } from '../app/useDraftApp';
import { store } from '../engine/storage';
import { classify, confident, describe, isEmpty, loadImage, ZONE_DEFS, type Descriptor, type Match, type Zone } from '../engine/vision';
import { BrawlerImg, norm } from './ui';

// Panel 📱: (1) ver el draft en el teléfono por WiFi y (2) detectar bans/picks automáticamente
// leyendo la pantalla del teléfono reflejada en el PC (scrcpy). Se mantiene montado aunque esté
// cerrado para que la detección siga funcionando.
export function PhonePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <div className="dd-modal-backdrop" style={{ display: open ? undefined : 'none' }} onClick={onClose}>
      <div className="dd-modal dd-phone" role="dialog" aria-modal="true" aria-labelledby="phone-title" onClick={(e) => e.stopPropagation()}>
        <div className="dd-modal-head">
          <h2 id="phone-title">📱 Conectar el teléfono</h2>
          <button className="dd-btn small gray" onClick={onClose}>✕ Cerrar</button>
        </div>
        <div className="dd-phone-body scroll-thin">
          <PhoneLink open={open} />
          <Detector />
        </div>
      </div>
    </div>
  );
}

function PhoneLink({ open }: { open: boolean }) {
  const a = useApp();
  const [ips, setIps] = useState<string[] | null>(null);
  const [qr, setQr] = useState('');
  const port = location.port || '5173';
  useEffect(() => {
    if (!open) return;
    fetch('/api/live/address').then((r) => r.json()).then((j: { ips: string[] }) => setIps(j.ips)).catch(() => setIps([]));
  }, [open]);
  const url = ips && ips[0] ? `http://${ips[0]}:${port}/?live` : '';
  useEffect(() => { if (url) QRCode.toDataURL(url, { margin: 1, width: 180 }).then(setQr).catch(() => setQr('')); }, [url]);
  return (
    <section className="dd-panel">
      <h3 className="dd-h3">1 · Ver el draft en el teléfono</h3>
      {ips === null ? <p className="dd-muted">Buscando la dirección del PC…</p>
        : ips.length === 0 ? <p className="dd-c-red">No encuentro el servidor. Arranca la app con «Iniciar Brawl Draft Pro» (inicia también la API).</p>
        : (
          <div className="dd-phone-link">
            {qr && <img src={qr} alt={`Código QR de ${url}`} width={180} height={180} />}
            <div>
              <p>Con el teléfono en la <b>misma WiFi</b>, escanea el código o abre:</p>
              <p className="dd-phone-url">{url}</p>
              {ips.length > 1 && <p className="dd-muted small">Otras direcciones de este PC: {ips.slice(1).map((ip) => `http://${ip}:${port}/?live`).join(' · ')}</p>}
              <p className="dd-muted small">Verás bans, picks, el mejor pick y los counters que van bien en el mapa, al instante. Ábrelo en <b>ventana flotante</b> o <b>pantalla dividida</b> de Android para tenerlo encima del juego. Si Windows pregunta por el firewall, permite el acceso en redes privadas.</p>
              <p className={a.phoneViewers > 0 ? 'dd-c-green' : 'dd-muted'}>{a.phoneViewers > 0 ? `✅ ${a.phoneViewers} teléfono(s) conectado(s)` : 'Ningún teléfono conectado todavía.'}</p>
            </div>
          </div>
        )}
      <UsbLink />
    </section>
  );
}

// Plan B: por cable USB con `adb reverse` (no depende de la WiFi ni del router)
const USB_ERRORS: Record<string, string> = {
  noadb: 'No encuentro adb en este PC. Descarga scrcpy (trae adb), descomprímelo en Descargas y vuelve a probar.',
  nodevice: 'No veo ningún teléfono por USB. Conecta el cable y activa la «Depuración USB» en Opciones de desarrollador.',
  unauthorized: 'El teléfono pide permiso: acepta «¿Permitir depuración USB?» en la pantalla del teléfono y vuelve a pulsar.',
  reverse: 'adb no pudo crear la conexión.',
  server: 'No responde el servidor de la app. Arráncala con «Iniciar Brawl Draft Pro».'
};
function UsbLink() {
  const [state, setState] = useState<{ busy: boolean; ok?: boolean; reason?: string; detail?: string }>({ busy: false });
  const [qr, setQr] = useState('');
  const url = 'http://localhost:5173/?live';
  useEffect(() => { if (state.ok) QRCode.toDataURL(url, { margin: 1, width: 140 }).then(setQr).catch(() => setQr('')); }, [state.ok]);
  async function connect() {
    setState({ busy: true });
    try {
      const r = await fetch('/api/live/usb', { method: 'POST' }).then((x) => x.json()) as { ok: boolean; reason?: string; detail?: string };
      setState({ busy: false, ...r });
    } catch { setState({ busy: false, ok: false, reason: 'server' }); }
  }
  return (
    <div className="dd-usb">
      <h4>¿No conecta por WiFi? Usa el cable USB</h4>
      <p className="dd-muted small">Algunos routers aíslan los dispositivos de la WiFi entre sí (o el teléfono usa VPN / DNS privado). Por cable no hace falta la WiFi: es la misma conexión que usa scrcpy.</p>
      <ol className="dd-steps">
        <li>En el teléfono: Ajustes → Acerca del teléfono → toca 7 veces «Número de compilación». Luego en Opciones de desarrollador activa <b>Depuración USB</b>.</li>
        <li>Conecta el cable al PC y acepta «¿Permitir depuración USB?» en el teléfono.</li>
        <li>Pulsa el botón y abre en el teléfono <span className="dd-phone-url">{url}</span></li>
      </ol>
      <button className="dd-btn small blue" disabled={state.busy} onClick={connect}>{state.busy ? 'Conectando…' : '🔌 Conectar por cable USB'}</button>
      {state.ok && (
        <div className="dd-phone-link">
          {qr && <img src={qr} alt={`Código QR de ${url}`} width={140} height={140} />}
          <p className="dd-c-green">✅ Listo. En el teléfono abre <b>{url}</b> (escanea este QR o escríbelo). Si desconectas el cable, vuelve a pulsar el botón.</p>
        </div>
      )}
      {state.ok === false && <p className="dd-c-red">{USB_ERRORS[state.reason ?? 'reverse']}{state.detail ? ` (${state.detail})` : ''}</p>}
    </div>
  );
}

type Learned = Record<string, number[][]>;
interface Recent { zone: string; id: string; desc: number[]; at: number }

function Detector() {
  const a = useApp();
  const appRef = useRef(a);
  appRef.current = a;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [zones, setZones] = useState<Zone[]>(() => store.load('detZones', []));
  const [empty, setEmpty] = useState<Record<string, number[]>>(() => store.load('detEmpty', {}));
  const [learned, setLearned] = useState<Learned>(() => store.load('detLearned', {}));
  const [placing, setPlacing] = useState<string>(ZONE_DEFS[0].key);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [running, setRunning] = useState(false);
  const [refs, setRefs] = useState<Map<string, Descriptor> | null>(null);
  const [live, setLive] = useState<Record<string, Match | 'empty' | null>>({});
  const [recent, setRecent] = useState<Recent[]>([]);
  const [fixing, setFixing] = useState<Recent | null>(null);
  const [q, setQ] = useState('');
  const assigned = useRef<Record<string, string>>({});
  const stable = useRef<Record<string, { id: string; n: number }>>({});

  useEffect(() => { store.save('detZones', zones); }, [zones]);
  useEffect(() => { store.save('detEmpty', empty); }, [empty]);
  useEffect(() => { store.save('detLearned', learned); }, [learned]);
  useEffect(() => { a.setAutoDetect(running); }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

  async function share() {
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 10 }, audio: false });
      s.getVideoTracks()[0].addEventListener('ended', () => { setStream(null); setRunning(false); });
      setStream(s);
    } catch { a.setMsg('No se pudo capturar la pantalla (permiso cancelado).'); }
  }
  useEffect(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, [stream]);

  // Huellas de referencia de los 108 brawlers (una vez)
  useEffect(() => {
    if (!running || refs) return;
    let cancel = false;
    (async () => {
      const m = new Map<string, Descriptor>();
      await Promise.all(a.ALL.filter((b) => b.image).map(async (b) => {
        try { const img = await loadImage(b.image!); m.set(b.id, describe(img, 0, 0, img.naturalWidth, img.naturalHeight)); } catch { /* sin foto: solo muestras aprendidas */ }
      }));
      if (!cancel) setRefs(m);
    })();
    return () => { cancel = true; };
  }, [running, refs, a.ALL]);

  const px = (z: Zone, v: HTMLVideoElement) => [z.x * v.videoWidth, z.y * v.videoHeight, z.w * v.videoWidth, z.h * v.videoHeight] as const;

  function captureEmpty() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const e: Record<string, number[]> = {};
    for (const z of zones) e[z.key] = Array.from(describe(v, ...px(z, v)));
    setEmpty(e);
    a.setMsg('📸 Huecos vacíos guardados: la detección ya sabe cuándo un hueco está libre.');
  }

  // Bucle de detección: como mucho una acción por vuelta para no pisar el estado del draft
  useEffect(() => {
    if (!running || !refs) return;
    const iv = setInterval(() => {
      const v = videoRef.current;
      const app = appRef.current;
      if (!v || !v.videoWidth) return;
      if (app.draft.history.length === 0) { assigned.current = {}; }
      const d = app.draft;
      const used = new Set([...d.bansBlue, ...d.bansRed, ...d.globalBansBlue, ...d.globalBansRed, ...(d.picksBlue.filter(Boolean) as string[]), ...(d.picksRed.filter(Boolean) as string[])]);
      const view: Record<string, Match | 'empty' | null> = {};
      let acted = false;
      for (const z of zones) {
        const desc = describe(v, ...px(z, v));
        if (isEmpty(desc, empty[z.key])) { view[z.key] = 'empty'; delete stable.current[z.key]; continue; }
        const known = assigned.current[z.key];
        if (known) { view[z.key] = { id: known, score: 1, second: 0 }; continue; }
        // Candidatos: en un ban no puede repetirse un ban propio; en un pick nada usado
        const own = z.team === 'blue' ? d.bansBlue : d.bansRed;
        const cands = new Set(app.ALL.map((b) => b.id).filter((id) => z.kind === 'ban' ? !own.includes(id) && !(d.picksBlue.includes(id) || d.picksRed.includes(id)) : !used.has(id)));
        const m = classify(desc, refs, learned, cands);
        view[z.key] = m;
        if (!confident(m)) { delete stable.current[z.key]; continue; }
        const st = stable.current[z.key];
        stable.current[z.key] = st && st.id === m!.id ? { id: m!.id, n: st.n + 1 } : { id: m!.id, n: 1 };
        if (stable.current[z.key].n < 2 || acted) continue;
        // Aplica: bans cuando sea, picks solo cuando le toca a ese equipo (si no, espera)
        let ok = false;
        if (z.kind === 'ban') ok = app.doBan(z.team, m!.id);
        else if (app.exp.kind === 'pick' && app.exp.team === z.team) ok = app.doPick(z.team, m!.id);
        if (ok) {
          acted = true;
          assigned.current[z.key] = m!.id;
          setRecent((r) => [{ zone: z.key, id: m!.id, desc: Array.from(desc), at: Date.now() }, ...r].slice(0, 8));
        }
      }
      setLive(view);
    }, 700);
    return () => clearInterval(iv);
  }, [running, refs, zones, empty, learned]);

  // Corrección: guarda la huella como muestra del brawler correcto y arregla el draft si fue lo último
  function correct(r: Recent, rightId: string) {
    setLearned((l) => ({ ...l, [rightId]: [r.desc, ...(l[rightId] ?? [])].slice(0, 5) }));
    const last = a.draft.history[a.draft.history.length - 1];
    const def = ZONE_DEFS.find((z) => z.key === r.zone)!;
    if (last && last.brawlerId === r.id) {
      a.doUndo();
      setTimeout(() => { const app = appRef.current; if (def.kind === 'ban') app.doBan(def.team, rightId); else app.doPick(def.team, rightId); }, 50);
      a.setMsg(`✏️ Corregido: ${a.ALL.find((b) => b.id === rightId)?.name}. La detección lo recordará.`);
    } else {
      a.setMsg('✏️ Aprendido para la próxima. Como ya hubo acciones después, corrige el draft con ↩ Deshacer.');
    }
    assigned.current[r.zone] = rightId;
    setRecent((rs) => rs.map((x) => (x === r ? { ...x, id: rightId } : x)));
    setFixing(null); setQ('');
  }

  // Dibujar zonas sobre el vídeo
  const rel = (e: React.PointerEvent) => {
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: (e.clientX - box.left) / box.width, y: (e.clientY - box.top) / box.height };
  };
  function onUp() {
    if (!drag) return;
    const x = Math.min(drag.x0, drag.x1), y = Math.min(drag.y0, drag.y1), w = Math.abs(drag.x1 - drag.x0), h = Math.abs(drag.y1 - drag.y0);
    setDrag(null);
    if (w < 0.01 || h < 0.01) return;
    const def = ZONE_DEFS.find((z) => z.key === placing)!;
    setZones((zs) => [...zs.filter((z) => z.key !== def.key), { key: def.key, kind: def.kind, team: def.team, slot: def.slot, x, y, w, h }]);
    const nextIdx = ZONE_DEFS.findIndex((z) => z.key === placing) + 1;
    if (ZONE_DEFS[nextIdx]) setPlacing(ZONE_DEFS[nextIdx].key);
  }

  const name = (id: string) => a.ALL.find((b) => b.id === id)?.name ?? id;
  const ready = zones.length > 0 && Object.keys(empty).length > 0;
  return (
    <section className="dd-panel">
      <h3 className="dd-h3">2 · Detección automática de bans y picks</h3>
      <ol className="dd-steps">
        <li>Refleja el teléfono en el PC con <b>scrcpy</b> (gratis; activa la depuración USB en Android y conecta el cable o la WiFi).</li>
        <li>Pulsa <b>Compartir pantalla</b> y elige la ventana de scrcpy.</li>
        <li>Con la pantalla de draft abierta y <b>vacía</b>, marca cada hueco arrastrando un recuadro (se guarda para siempre) y pulsa <b>Fotografiar huecos vacíos</b>.</li>
        <li>Pulsa <b>Iniciar detección</b>: bans y picks se marcan solos y el mejor pick se actualiza (también en el teléfono).</li>
      </ol>
      <div className="dd-det-bar">
        {!stream ? <button className="dd-btn small blue" onClick={share}>🖥️ Compartir pantalla</button>
          : <button className="dd-btn small gray" onClick={() => { stream.getTracks().forEach((t) => t.stop()); setStream(null); setRunning(false); }}>⏹ Dejar de compartir</button>}
        <select className="dd-input dd-select-xs" value={placing} onChange={(e) => setPlacing(e.target.value)} aria-label="Hueco a marcar">
          {ZONE_DEFS.map((z) => <option key={z.key} value={z.key}>{zones.some((x) => x.key === z.key) ? '✅ ' : '◻️ '}{z.label}</option>)}
        </select>
        <button className="dd-btn small gray" disabled={!stream || zones.length === 0} onClick={captureEmpty}>📸 Fotografiar huecos vacíos</button>
        <button className={`dd-btn small ${running ? 'red' : 'green'}`} disabled={!stream || !ready} onClick={() => setRunning(!running)}>{running ? '⏸ Parar detección' : '▶ Iniciar detección'}</button>
        <button className="dd-btn small gray" disabled={zones.length === 0} onClick={() => { if (window.confirm('¿Borrar todas las zonas marcadas?')) { setZones([]); setEmpty({}); } }}>🗑 Zonas</button>
      </div>
      {running && !refs && <p className="dd-muted small">Preparando las fotos de referencia…</p>}
      <div className="dd-det-stage" style={{ display: stream ? undefined : 'none' }}
        onPointerDown={(e) => { const p = rel(e); setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y }); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { if (drag) { const p = rel(e); setDrag({ ...drag, x1: p.x, y1: p.y }); } }}
        onPointerUp={onUp}>
        <video ref={videoRef} autoPlay muted playsInline />
        {zones.map((z) => {
          const st = live[z.key];
          const lbl = st === 'empty' ? 'vacío' : st ? `${name(st.id)} ${Math.round(st.score * 100)}%` : '';
          return (
            <div key={z.key} className={`dd-zone ${z.team} ${st && st !== 'empty' && confident(st) ? 'hit' : ''}`} style={{ left: `${z.x * 100}%`, top: `${z.y * 100}%`, width: `${z.w * 100}%`, height: `${z.h * 100}%` }}>
              <span>{ZONE_DEFS.find((d) => d.key === z.key)?.label}{lbl ? ` · ${lbl}` : ''}</span>
            </div>
          );
        })}
        {drag && <div className="dd-zone drawing" style={{ left: `${Math.min(drag.x0, drag.x1) * 100}%`, top: `${Math.min(drag.y0, drag.y1) * 100}%`, width: `${Math.abs(drag.x1 - drag.x0) * 100}%`, height: `${Math.abs(drag.y1 - drag.y0) * 100}%` }} />}
      </div>
      {recent.length > 0 && (
        <div className="dd-det-recent">
          <b>Detectado</b> <span className="dd-muted small">(si alguno está mal, corrígelo: la detección aprende)</span>
          {recent.map((r) => (
            <div key={r.at} className="dd-det-item">
              <span>{ZONE_DEFS.find((z) => z.key === r.zone)?.label}: <b>{name(r.id)}</b></span>
              <button className="dd-link" onClick={() => setFixing(r)}>✏️ Corregir</button>
            </div>
          ))}
        </div>
      )}
      {fixing && (
        <div className="dd-det-fix">
          <p>¿Quién era en «{ZONE_DEFS.find((z) => z.key === fixing.zone)?.label}»?</p>
          <input className="dd-input" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar brawler…" aria-label="Buscar el brawler correcto" />
          <div className="dd-det-fix-grid">
            {a.ALL.filter((b) => q && norm(b.name).includes(norm(q))).slice(0, 12).map((b) => (
              <button key={b.id} className="dd-mc-chip" onClick={() => correct(fixing, b.id)}><span className="dd-mc-img"><BrawlerImg b={b} size="w-full h-full" /></span>{b.name}</button>
            ))}
          </div>
          <button className="dd-btn small gray" onClick={() => setFixing(null)}>Cancelar</button>
        </div>
      )}
      <p className="dd-muted small">Todo se procesa en este PC: no se envía ninguna imagen a internet. La app solo lee la pantalla; no toca el juego.</p>
    </section>
  );
}
