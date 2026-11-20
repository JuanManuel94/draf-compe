import { useMemo, useState } from 'react';
import { useApp } from '../app/useDraftApp';
import { MAPS } from '../data/maps';
import { FORMATS } from '../data/meta';
import { REAL_META } from '../engine/realMeta';
import { Timer, useTurnTexts } from './PhasePanel';
import { MapImg, norm } from './ui';

// Flujo guiado del draft: 1 Mapa → 2 Bans → 3 Picks → 4 Resultado.
// Solo se muestra lo que hace falta en cada paso; la detección automática lo avanza sola.
const STEPS = [
  { key: 'map', label: 'Mapa' },
  { key: 'bans', label: 'Bans' },
  { key: 'picks', label: 'Picks' },
  { key: 'done', label: 'Resultado' }
] as const;

export function FlowBar() {
  const a = useApp();
  const { turnText } = useTurnTexts();
  const cur = STEPS.findIndex((s) => s.key === a.flowStep);
  const turnCls = a.exp.kind === 'done' ? 'done' : a.exp.kind === 'coin' ? 'coin' : a.exp.team === 'blue' ? 'blue' : 'red';
  const choosingFirst = a.exp.kind === 'coin' || (a.flowStep === 'picks' && a.picked.length === 0 && a.format.freeOrder);
  return (
    <section className="dd-panel dd-flow" aria-label="Pasos del draft">
      <ol className="dd-flow-steps">
        {STEPS.map((s, i) => (
          <li key={s.key} className={i < cur ? 'done' : i === cur ? 'active' : ''} aria-current={i === cur ? 'step' : undefined}>
            <span className="dd-flow-n">{i < cur ? '✓' : i + 1}</span>{s.label}
          </li>
        ))}
      </ol>
      {a.flowStep !== 'map' && (
        <div className="dd-flow-row">
          <button className="dd-flow-map" onClick={a.editMap} disabled={a.draft.history.length > 0} title={a.draft.history.length > 0 ? 'El draft ya empezó: usa «Nuevo draft» para cambiar de mapa' : 'Cambiar el mapa'}>
            {a.map.photo && <MapImg src={a.map.photo} name={a.map.name} cls="dd-flow-map-img" />}
            <span><b>{a.map.name}</b><small>{a.map.mode}</small></span>
          </button>
          <div className={`dd-turn ${turnCls}`} role="status"><span className="dd-live-dot" />{turnText}</div>
          <Timer />
          {a.autoDetect && <span className="dd-flow-auto" title="La detección automática está leyendo la pantalla del juego">🤖 Auto</span>}
          <span className="dd-flow-series" title="Serie al mejor de 3"><b className="dd-c-blue">{a.wins}</b>–<b className="dd-c-red">{a.losses}</b></span>
          <button className="dd-btn small gray" onClick={() => a.reset()}>🔄 Nuevo draft</button>
        </div>
      )}
      {choosingFirst && (
        <div className="dd-flow-first">
          <span>¿Quién elige primero?{a.autoDetect && <small className="dd-muted"> (la detección lo pone sola al ver el primer pick)</small>}</span>
          <div className="dd-side-select">
            <button aria-pressed={a.draft.coinWinner !== 'red'} className={`dd-side blue ${a.draft.coinWinner !== 'red' ? 'active' : ''}`} onClick={() => a.setFirstPicker('blue')}><span>🔵</span>Nosotros</button>
            <button aria-pressed={a.draft.coinWinner === 'red'} className={`dd-side red ${a.draft.coinWinner === 'red' ? 'active' : ''}`} onClick={() => a.setFirstPicker('red')}><span>🔴</span>Ellos</button>
          </div>
        </div>
      )}
      {a.msg && <div className="dd-msg" role="alert">{a.msg}</div>}
    </section>
  );
}

// Paso 1: elegir el mapa. Solo los mapas de la rotación Ranked actual, agrupados por modo.
export function MapStep() {
  const a = useApp();
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const inRotation = MAPS.filter((m) => REAL_META.maps[m.id]);
    const list = (inRotation.length ? inRotation : MAPS).filter((m) => !q || norm(m.name).includes(norm(q)) || norm(m.mode).includes(norm(q)));
    const by = new Map<string, typeof list>();
    for (const m of list) by.set(m.mode, [...(by.get(m.mode) ?? []), m]);
    return [...by.entries()];
  }, [q]);
  return (
    <section className="dd-panel dd-mapstep" aria-label="Elige el mapa">
      <div className="dd-mapstep-head">
        <div>
          <h2 className="dd-h2">1 · ¿En qué mapa juegas?</h2>
          <p className="dd-muted small">
            {a.autoDetect ? '🤖 La detección automática lo reconocerá en cuanto aparezca en pantalla. ' : ''}
            Toca el mapa y pasas directo a los bans.
          </p>
        </div>
        <div className="dd-mapstep-tools">
          <button className="dd-btn small green" onClick={() => a.confirmMap()}>▶ Seguir en {a.map.name}</button>
          <input className="dd-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar mapa o modo…" aria-label="Buscar mapa" />
          <select className="dd-input dd-select-xs" value={a.formatId} onChange={(e) => a.changeFormat(e.target.value)} aria-label="Formato">
            {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.id === 'live' ? 'Ranked' : f.name}</option>)}
          </select>
        </div>
      </div>
      {groups.map(([mode, maps]) => (
        <div key={mode} className="dd-mapstep-group">
          <h3 className="dd-h3">{mode}</h3>
          <div className="dd-mapgrid">
            {maps.map((m) => (
              <button key={m.id} className={`dd-mapcard ${m.id === a.mapId ? 'selected' : ''}`} onClick={() => a.confirmMap(m.id)}>
                {m.photo ? <MapImg src={m.photo} name={m.name} cls="dd-mapcard-img" /> : <span className="dd-mapcard-img">{m.image}</span>}
                <span>{m.name}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
      {groups.length === 0 && <p className="dd-muted">Sin resultados.</p>}
    </section>
  );
}
