import { useEffect, useState } from 'react';
import type { LiveBrawler, LiveSnapshot } from '../app/live';

// Vista para el teléfono (/?live): sigue el draft del PC en directo, sin tocar nada.
// Pensada para abrirse en ventana flotante o pantalla dividida mientras juegas.
function Face({ b, size = 44 }: { b: LiveBrawler | null; size?: number }) {
  const [err, setErr] = useState(false);
  return (
    <span className="lv-face" style={{ width: size, height: size }} title={b?.name}>
      {b ? (b.img && !err ? <img src={b.img} alt={b.name} onError={() => setErr(true)} /> : <span className="lv-initial">{b.name.slice(0, 2)}</span>) : <span className="lv-empty">—</span>}
    </span>
  );
}

export function LiveView() {
  const [s, setS] = useState<LiveSnapshot | null>(null);
  const [online, setOnline] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout>;
    let lastSeen = Date.now();
    const reconnect = () => { setOnline(false); es?.close(); clearTimeout(retry); retry = setTimeout(connect, 2000); };
    function connect() {
      lastSeen = Date.now();
      es = new EventSource('/api/live/stream');
      es.onopen = () => { lastSeen = Date.now(); setOnline(true); };
      es.onmessage = (e) => { lastSeen = Date.now(); try { setS(JSON.parse(e.data)); } catch { /* mensaje incompleto */ } };
      es.addEventListener('ping', () => { lastSeen = Date.now(); setOnline(true); });
      es.onerror = reconnect;
    }
    connect();
    // Sin latido en 20 s (PC reiniciado, WiFi caída, móvil en reposo) = conexión muerta aunque no dé error
    const watchdog = setInterval(() => { if (Date.now() - lastSeen > 20000) reconnect(); }, 5000);
    return () => { es?.close(); clearTimeout(retry); clearInterval(watchdog); };
  }, []);
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(iv); }, []);
  // Vibra cuando te toca pickear
  useEffect(() => { if (s?.myTurn || s?.ourTurn) navigator.vibrate?.(200); }, [s?.myTurn, s?.ourTurn]);

  if (!s) {
    return (
      <div className="lv-app lv-wait">
        <h1>📱 Brawl Draft Pro</h1>
        <p>{online ? 'Conectado. Esperando a que el PC empiece un draft…' : 'Conectando con el PC… (misma WiFi y la app abierta en el PC)'}</p>
      </div>
    );
  }
  const left = s.timerOn ? Math.max(0, Math.ceil(s.stepSeconds - (now - s.stepStart) / 1000)) : null;
  return (
    <div className={`lv-app ${s.myTurn ? 'lv-hot' : ''}`}>
      <header className="lv-head">
        <div><b>{s.mapName}</b> <span className="lv-muted">{s.mode}</span></div>
        <span className={`lv-dot ${online ? 'on' : ''}`} title={online ? 'En directo' : 'Sin conexión'} />
      </header>
      <div className="lv-step">
        <span>{s.step}</span>
        {left !== null && <span className={`lv-timer ${left <= 5 ? 'low' : ''}`}>{left}s</span>}
        {s.autoDetect && <span className="lv-chip">📷 auto</span>}
      </div>

      <section className="lv-teams">
        <div className="lv-team blue">
          <div className="lv-label">Nosotros</div>
          <div className="lv-row">{s.picksBlue.map((b, i) => <Face key={i} b={b} />)}</div>
          <div className="lv-row lv-bans">{s.bansBlue.map((b) => <Face key={b.id} b={b} size={26} />)}</div>
        </div>
        <div className="lv-team red">
          <div className="lv-label">Ellos</div>
          <div className="lv-row">{s.picksRed.map((b, i) => <Face key={i} b={b} />)}</div>
          <div className="lv-row lv-bans">{s.bansRed.map((b) => <Face key={b.id} b={b} size={26} />)}</div>
        </div>
      </section>

      {s.verdict && (
        <section className="lv-card">
          <div className="lv-win"><span className="blue">{s.verdict.winChance}%</span><div className="lv-win-bar"><div style={{ width: `${s.verdict.winChance}%` }} /></div><span className="red">{100 - s.verdict.winChance}%</span></div>
          <b>{s.verdict.text}</b>
          <p className="lv-muted">💡 {s.verdict.tip}</p>
        </section>
      )}

      {s.bans.length > 0 && (
        <section className="lv-card">
          <h2>⛔ Banea</h2>
          {s.bans.map((b) => <div key={b.id} className="lv-item"><Face b={b} size={36} /><div><b>{b.name}</b><small>{b.why}</small></div></div>)}
        </section>
      )}

      {s.best.length > 0 && s.bans.length === 0 && (
        <section className={`lv-card ${s.ourTurn ? 'lv-focus' : ''}`}>
          <h2>🎯 Mejor pick {s.ourTurn ? 'AHORA' : '(cuando te toque)'}</h2>
          {s.best.map((b, i) => (
            <div key={b.id} className={`lv-item ${i === 0 ? 'top' : ''}`}><Face b={b} size={i === 0 ? 52 : 36} /><div><b>{b.name} <span className="lv-score">{b.score}</span></b><small>{b.why}</small></div></div>
          ))}
        </section>
      )}

      {s.counters.length > 0 && (
        <section className="lv-card">
          <h2>🗺️ Counters que van bien en este mapa</h2>
          {s.counters.map((c) => (
            <div key={c.enemy.id} className="lv-counter">
              <span className="lv-vs">vs <b>{c.enemy.name}</b></span>
              <div className="lv-row">{c.options.length ? c.options.map((o) => <span key={o.id} className="lv-opt"><Face b={o} size={32} /><small>{o.name}<br />{o.matchup}·{o.map}</small></span>) : <small className="lv-muted">ninguno rinde en el mapa</small>}</div>
            </div>
          ))}
        </section>
      )}

      {s.threats.length > 0 && <section className="lv-card lv-threat">{s.threats.map((t) => <p key={t}>⚠️ {t}</p>)}</section>}
    </div>
  );
}
