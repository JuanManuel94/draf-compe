import { useApp } from '../app/useDraftApp';
import type { Team } from '../types';

const teamName = (t: Team) => (t === 'blue' ? 'azul 🔵' : 'rojo 🔴');

// Textos de turno compartidos por el panel de fase, el tablero y el panel de turno
export function useTurnTexts() {
  const { exp, format, banPhase, setBansDone, setBansTotal } = useApp();
  const baseTurn = exp.kind === 'done' ? '✅ Draft completo'
    : exp.kind === 'coin' ? '🪙 Sorteo inicial: lanza la moneda'
    : exp.kind === 'globalban' ? `🌍 Baneo GLOBAL: ${teamName(exp.team)}`
    : exp.kind === 'ban' ? `🚫 Banea (set${format.blindBans ? ', ciego' : ''}): ${teamName(exp.team)}`
    : `👉 Elige: ${teamName(exp.team)}`;
  const turnText = exp.kind === 'done' ? '✅ Draft completo'
    : banPhase && exp.kind === 'ban' ? `🚫 1º Baneos (${setBansDone}/${setBansTotal})${format.freeOrder ? ' — simultáneos, en cualquier orden' : ''} · luego 2º picks`
    : baseTurn.replace(/^👉 /, '👉 2º ');
  const centerBadge = exp.kind === 'done' ? '✅ Draft completo'
    : exp.kind === 'coin' ? '🪙 Sorteo'
    : exp.kind === 'globalban' ? `🌍 Global: ${exp.team === 'blue' ? 'AZUL' : 'ROJO'}`
    : exp.kind === 'ban' ? (format.freeOrder ? `🚫 Baneos (${setBansDone}/${setBansTotal})` : `🚫 Banea: ${exp.team === 'blue' ? 'AZUL' : 'ROJO'}`)
    : `👉 Elige: ${exp.team === 'blue' ? 'AZUL' : 'ROJO'}`;
  return { turnText, centerBadge };
}

export function Timer({ compact = false }: { compact?: boolean }) {
  const a = useApp();
  if (!a.timerActive) return null;
  const s = a.secondsLeft;
  const cls = s <= 0 ? 'out' : s <= 5 ? 'warn' : '';
  return (
    <button className={`dd-timer ${cls} ${compact ? 'compact' : ''}`} onClick={a.restartTimer} title="Tiempo del turno (como en el juego). Toca para reiniciarlo." aria-live="off">
      ⏱ {s <= 0 ? '¡Tiempo!' : `${Math.ceil(s)} s`}
      {!compact && <span className="dd-timer-track"><span style={{ width: `${(s / a.stepSeconds) * 100}%` }} /></span>}
    </button>
  );
}

export function PhasePanel() {
  const a = useApp();
  const { turnText } = useTurnTexts();
  const firstPicker = a.draft.coinWinner === 'red' ? 'Equipo Rojo' : a.draft.coinWinner === 'blue' || !a.format.coinFlip ? 'Equipo Azul' : 'por sortear 🪙';
  const turnCls = a.exp.kind === 'done' ? 'done' : a.exp.kind === 'coin' ? 'coin' : a.exp.team === 'blue' ? 'blue' : 'red';
  return (
    <section className="dd-panel dd-phase-panel">
      <h2>Mapa: {a.map.name}</h2>
      <h2>First Pick: {firstPicker}</h2>
      <div className="dd-series" aria-label="Serie al mejor de 3">
        <span>Serie Bo3</span>
        <b className="dd-c-blue">{a.wins}</b> – <b className="dd-c-red">{a.losses}</b>
        <span className="dd-muted">{a.seriesOver ? (a.wins > a.losses ? '· ¡Serie ganada!' : '· Serie perdida') : `· Partida ${a.series.length + 1}`}</span>
      </div>
      <div className="dd-turn-row">
        <div className={`dd-turn ${turnCls}`} role="status"><span className="dd-live-dot" />{turnText}</div>
        <Timer />
      </div>
      {a.msg && <div className="dd-msg" role="alert">{a.msg}</div>}
    </section>
  );
}
