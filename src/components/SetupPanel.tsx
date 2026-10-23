import { useMemo, useState } from 'react';
import { MODES, useApp } from '../app/useDraftApp';
import { MAPS, POOL_INFO } from '../data/maps';
import { FORMATS } from '../data/meta';
import { Bar, MapImg, norm } from './ui';

export function SetupPanel() {
  const a = useApp();
  const [mapQuery, setMapQuery] = useState('');
  const mapsForMode = useMemo(() => MAPS.filter((m) => m.mode === a.mode && norm(m.name).includes(norm(mapQuery))), [a.mode, mapQuery]);
  const { map, format, draft } = a;
  const firstPicker = draft.coinWinner === 'red' ? 'Empiezan ellos' : draft.coinWinner === 'blue' || !format.coinFlip ? 'Empezamos nosotros' : 'Sorteo pendiente';
  const pickedStarted = a.picked.length > 0;

  if (!a.setupOpen) {
    return (
      <section className="dd-panel dd-setup-bar" aria-label="Resumen del draft">
        {map.photo && <MapImg src={map.photo} name={map.name} cls="dd-setup-bar-img" />}
        <div className="dd-setup-bar-text">
          <b>{map.name}</b>
          <span>{map.mode} · {format.id === 'live' ? 'Ranked' : 'Torneo BSC'} · {firstPicker}</span>
        </div>
        <button className="dd-btn small gray" onClick={() => a.setSetupOpen(true)} aria-expanded={false}>✏️ Cambiar</button>
      </section>
    );
  }

  return (
    <section className="dd-panel dd-setup">
      <div className="dd-setup-head">
        <h2 className="dd-h2">Draft Setup</h2>
        <button className="dd-btn small gray dd-setup-close" onClick={() => a.setSetupOpen(false)} aria-expanded={true}>▲ Plegar</button>
      </div>
      <div className="dd-setup-grid">
        <div className="dd-form-group">
          <label className="dd-label">Modo de juego:</label>
          <div className="dd-chips">
            {MODES.map((m) => <button key={m} onClick={() => a.changeMode(m)} aria-pressed={a.mode === m} className={`dd-chip ${a.mode === m ? 'active' : ''}`}>{m}</button>)}
          </div>
          <label className="dd-label" htmlFor="map-search">Selecciona mapa: <span className="dd-muted">({mapsForMode.length})</span></label>
          <div className="dd-input-wrap">
            <input id="map-search" value={mapQuery} onChange={(e) => setMapQuery(e.target.value)} placeholder="Busca un mapa..." className="dd-input" />
            <span className="dd-input-icon" aria-hidden="true">🔍</span>
          </div>
          <div className="dd-options">
            <div className="dd-options-head">{a.mode}</div>
            {mapsForMode.map((m) => (
              <button key={m.id} onClick={() => { a.changeMap(m.id); a.setSetupOpen(false); }} aria-pressed={a.mapId === m.id} className={`dd-option ${a.mapId === m.id ? 'selected' : ''}`}>
                {m.photo ? <MapImg src={m.photo} name={m.name} cls="dd-option-img" /> : <span className="text-xl">{m.image}</span>}
                <span>{m.name}</span>
                {m.apiDisabled && <span className="dd-flag" title="BrawlAPI lo marca desactivado: comprueba que siga en la rotación Ranked">⚠️</span>}
              </button>
            ))}
            {mapsForMode.length === 0 && <div className="dd-option dd-muted">Sin resultados</div>}
          </div>
        </div>

        <div className="dd-form-group">
          <label className="dd-label" htmlFor="format-select">Formato:</label>
          <select id="format-select" value={a.formatId} onChange={(e) => a.changeFormat(e.target.value)} className="dd-input">
            {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.name} — {f.description}</option>)}
          </select>
          {format.freeOrder && <>
            <label className="dd-label">¿Quién pickea primero?</label>
            <div className="dd-side-select">
              <button disabled={pickedStarted} aria-pressed={draft.coinWinner !== 'red'} title={pickedStarted ? 'Bloqueado: los picks ya empezaron' : 'Tecla B'} className={`dd-side blue ${draft.coinWinner !== 'red' ? 'active' : ''}`} onClick={() => a.setFirstPicker('blue')}><span>🔵</span>Nosotros</button>
              <button disabled={pickedStarted} aria-pressed={draft.coinWinner === 'red'} title={pickedStarted ? 'Bloqueado: los picks ya empezaron' : 'Tecla R'} className={`dd-side red ${draft.coinWinner === 'red' ? 'active' : ''}`} onClick={() => a.setFirstPicker('red')}><span>🔴</span>Ellos</button>
            </div>
            <p className="dd-hint">Pulsa <kbd>B</kbd> para azul o <kbd>R</kbd> para rojo</p>
          </>}
          <p className="dd-hint">🔴 {POOL_INFO}</p>
        </div>

        <div className="dd-form-group">
          <label className="dd-label">Mapa seleccionado:</label>
          <div className="dd-map-detail">
            {map.photo && <MapImg src={map.photo} name={map.name} cls="dd-map-detail-img" />}
            <div className="dd-map-detail-name">{map.image} {map.name}</div>
            <div className="dd-muted">{map.mode} · alcance {map.rangeBias}</div>
            {map.apiDisabled && <p className="dd-warn-text">⚠️ BrawlAPI marca este mapa como desactivado (oct-2026): comprueba en el juego que siga en la rotación Ranked.</p>}
            <p>{map.description}</p>
            <div className="dd-bars">
              <div>Muros <Bar v={map.walls * 20} c="#3498db" label="Muros" /></div>
              <div>Arbustos <Bar v={map.bushes * 20} c="#2ecc71" label="Arbustos" /></div>
              <div>Apertura <Bar v={map.openness * 20} c="#f1c40f" label="Apertura" /></div>
              <div>Zonas control <Bar v={map.controlZones * 20} c="#e84393" label="Zonas de control" /></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
