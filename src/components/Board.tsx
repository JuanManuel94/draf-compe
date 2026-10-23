import { useApp } from '../app/useDraftApp';
import { pickOrderIssues, SLOT_LABELS } from '../engine/draftMachine';
import { brawlerById } from '../engine/scoring';
import type { Team } from '../types';
import { useTurnTexts } from './PhasePanel';
import { BrawlerImg, MapImg } from './ui';

function TeamPanel({ team }: { team: Team }) {
  const a = useApp();
  const { draft, exp, format } = a;
  const picks = team === 'blue' ? draft.picksBlue : draft.picksRed;
  const teamBans = team === 'blue' ? draft.bansBlue : draft.bansRed;
  const teamGlobal = team === 'blue' ? draft.globalBansBlue : draft.globalBansRed;
  const isTurn = exp.kind !== 'done' && exp.kind !== 'coin' && exp.team === team;
  const hidden = a.maskRival && team === 'red';
  // Orden visual de arriba abajo: FP → MID → LAST (el rojo guarda su FP en el índice 2)
  const order = team === 'blue' ? [0, 1, 2] : [2, 1, 0];
  const nextPick = exp.kind === 'pick' && exp.team === team ? (team === 'blue' ? picks.indexOf(null) : picks.lastIndexOf(null)) : -1;
  // En Ranked los bans son simultáneos: se resalta el siguiente hueco del equipo seleccionado
  const banTeam = format.freeOrder && exp.kind === 'ban' ? (a.action === 'banRed' ? 'red' : a.action === 'banBlue' ? 'blue' : exp.team) : exp.kind === 'ban' ? exp.team : null;
  const nextBan = banTeam === team ? teamBans.length : -1;
  const nextGlobal = exp.kind === 'globalban' && exp.team === team ? teamGlobal.length : -1;
  const teamLabel = team === 'blue' ? 'azul' : 'rojo';
  return (
    <div className={`dd-team ${team} ${isTurn ? 'is-turn' : ''}`}>
      <div className={`dd-team-header ${team}`}>{team === 'blue' ? 'Equipo Azul' : 'Equipo Rojo'}</div>
      <div className="dd-team-sub">{team === 'blue' ? 'nosotros' : 'ellos'}</div>
      {format.globalBansPerTeam > 0 && (
        <>
          <h4 className="dd-section-title">Globales ({teamGlobal.length}/{format.globalBansPerTeam})</h4>
          <div className="dd-ban-row">
            {Array.from({ length: format.globalBansPerTeam }).map((_, i) => {
              const b = brawlerById(teamGlobal[i] ?? null);
              return (
                <button key={i} onClick={() => { if (!b) a.setAction(team === 'blue' ? 'globalBlue' : 'globalRed'); }}
                  className={`dd-slot dd-slot-ban global ${b ? 'filled' : ''} ${i === nextGlobal ? 'next-action' : ''}`}
                  aria-label={b ? `Ban global ${teamLabel}: ${hidden ? 'oculto' : b.name}` : `Hueco de ban global ${teamLabel} ${i + 1}`}
                  title={b ? `Ban global: ${hidden ? '???' : b.name}` : 'Hueco de ban global — tócalo para banear aquí'}>
                  {b ? (hidden ? <span className="dd-slot-q">❓</span> : <div className="dd-banned"><BrawlerImg b={b} size="w-full h-full" /></div>)
                    : <span className="dd-slot-icon">🌍</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
      <h4 className={`dd-section-title ${a.banPhase ? 'hot' : ''}`}>Baneos ({teamBans.length}/{format.bansPerTeam}){format.blindBans ? ' · ciegos' : ''}</h4>
      <div className="dd-ban-row">
        {Array.from({ length: format.bansPerTeam }).map((_, i) => {
          const id = teamBans[i] ?? null;
          const b = brawlerById(id);
          const dbl = !!id && a.doubleBans.includes(id) && !hidden;
          return (
            <button key={i} onClick={() => { if (!b) a.setAction(team === 'blue' ? 'banBlue' : 'banRed'); }}
              className={`dd-slot dd-slot-ban ${b ? 'filled' : ''} ${i === nextBan ? 'next-action' : ''}`}
              aria-label={b ? `Ban ${teamLabel}: ${hidden ? 'oculto' : b.name}${dbl ? ', baneado por ambos equipos' : ''}` : `Hueco de ban ${teamLabel} jugador ${i + 1}`}
              title={b ? `Baneado: ${hidden ? '???' : b.name}${dbl ? ' (ambos equipos lo banearon)' : ''}` : `Hueco de baneo J${i + 1} — tócalo para banear aquí`}>
              {b ? (hidden ? <span className="dd-slot-q">❓</span> : <div className="dd-banned"><BrawlerImg b={b} size="w-full h-full" /></div>)
                : <span className="dd-slot-icon">🚫</span>}
              {dbl && <span className="dd-dbl">x2</span>}
            </button>
          );
        })}
      </div>
      <h4 className="dd-section-title">Picks ({picks.filter(Boolean).length}/3)</h4>
      <div className="dd-picks">
        {order.map((i) => {
          const pid = picks[i];
          const b = brawlerById(pid);
          return (
            <div key={i} className="dd-pick-wrapper">
              <div className="dd-pick-info">
                <span className="dd-pick-label">{SLOT_LABELS[team][i]}</span>
                {team === 'blue' && a.mySlot === i && <span className="dd-pick-me">🧍 TÚ</span>}
                <span className="dd-pick-name">{b ? b.name : a.picksLocked ? '🔒' : '—'}</span>
              </div>
              <button onClick={() => { if (b && pid) a.removePick(team, pid); else a.setAction(team === 'blue' ? 'pickBlue' : 'pickRed'); }}
                className={`dd-slot dd-slot-pick ${b ? 'filled' : ''} ${i === nextPick ? 'next-action' : ''} ${!b && a.picksLocked ? 'locked' : ''}`}
                aria-label={b ? `${SLOT_LABELS[team][i]} ${teamLabel}: ${b.name}` : `Hueco ${SLOT_LABELS[team][i]} ${teamLabel}${a.picksLocked ? ', bloqueado' : ''}`}
                title={b ? `${b.name} (${SLOT_LABELS[team][i]}, clic para quitarlo si es el último pick)` : a.picksLocked ? '🔒 Bloqueado: termina primero los baneos' : `Hueco ${SLOT_LABELS[team][i]} — tócalo para dirigir aquí la próxima acción`}>
                {b ? <BrawlerImg b={b} size="w-full h-full" /> : <span className="dd-slot-icon">{a.picksLocked ? '🔒' : '+'}</span>}
              </button>
            </div>
          );
        })}
      </div>
      <div className="dd-team-foot">↓ orden: FP → MID → LAST</div>
    </div>
  );
}

export function Board() {
  const a = useApp();
  const { centerBadge } = useTurnTexts();
  const issues = pickOrderIssues(a.draft);
  return (
    <div className="dd-board">
      <TeamPanel team="blue" />
      <div className="dd-map-panel">
        <div className="dd-phase-indicator">
          <h2>{centerBadge}</h2>
          <div className="dd-phase-sub">Picks {a.picked.length}/6 · Bans {a.setBansDone}/{a.setBansTotal}{a.format.globalBansPerTeam > 0 && ` · Globales ${a.globalBanned.length}/${a.format.globalBansPerTeam * 2}`}</div>
        </div>
        <div className="dd-map-image">
          {a.map.photo ? <MapImg src={a.map.photo} name={a.map.name} cls="dd-map-img" /> : <span className="dd-map-emoji">{a.map.image}</span>}
        </div>
        <div className="dd-map-caption">{a.map.mode} · Alcance {a.map.rangeBias}</div>
        {issues.length > 0 && (
          <div className="dd-warn">
            ⚠️ Orden de picks alterado (sorteo: {a.draft.coinWinner === 'red' ? 'empiezan ELLOS' : 'empezamos NOSOTROS'}): {issues.join(' ')} Toca el hueco correcto o usa deshacer.
          </div>
        )}
      </div>
      <TeamPanel team="red" />
    </div>
  );
}
