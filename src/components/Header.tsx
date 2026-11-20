import { useApp } from '../app/useDraftApp';
import { POOL_INFO } from '../data/maps';
import { DATA_SOURCE } from '../engine/scoring';

export function Header({ menuOpen, setMenuOpen, openCollection, openPhone }: { menuOpen: boolean; setMenuOpen: (v: boolean) => void; openCollection: () => void; openPhone?: () => void }) {
  const a = useApp();
  const pending = a.ownCount('no') + a.ownCount('low');
  const close = () => setMenuOpen(false);
  return (
    <>
      <header className="dd-nav">
        <button className={`dd-burger ${menuOpen ? 'active' : ''}`} aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><span /><span /><span /></button>
        <div className="dd-nav-title">
          <h1>Brawl Draft Pro<span className="dd-h1-extra">: Draft Assistant</span></h1>
          <span className="dd-credit">asistente de draft competitivo</span>
        </div>
        <div className="dd-nav-right">
          {a.format.blindBans && <label className="dd-pill" title="Ocultar bans rivales"><input type="checkbox" checked={a.blindHide} onChange={(e) => a.setBlindHide(e.target.checked)} /> Ocultar bans</label>}
          <button className="dd-round yellow" title="Mi colección" aria-label={`Mi colección${pending ? `, ${pending} brawlers marcados` : ''}`} onClick={openCollection}>🎒{pending > 0 && <span className="dd-badge">{pending}</span>}</button>
          {openPhone && <button className="dd-round purple" title="Conectar el teléfono y detección automática" aria-label={`Conectar el teléfono${a.autoDetect ? ', detección automática activa' : ''}${a.phoneViewers ? `, ${a.phoneViewers} conectado(s)` : ''}`} onClick={openPhone}>📱{(a.autoDetect || a.phoneViewers > 0) && <span className="dd-badge">{a.autoDetect ? '●' : a.phoneViewers}</span>}</button>}
          <button className="dd-round purple" title="Compartir enlace del draft" aria-label="Compartir enlace del draft" onClick={a.shareDraft}>🔗</button>
        </div>
      </header>

      {menuOpen && <div className="dd-menu-backdrop" onClick={close} />}
      <aside className={`dd-menu ${menuOpen ? 'open' : ''}`} aria-hidden={!menuOpen}>
        <div className="dd-menu-header">
          <div><h2>Brawl Draft Pro</h2><p>Acciones y ajustes</p></div>
          <button className="dd-menu-close" onClick={close} aria-label="Cerrar menú">✕</button>
        </div>
        <nav className="dd-menu-nav">
          <button onClick={() => { openCollection(); close(); }}>🎒 Mi colección{pending > 0 ? ` (${pending})` : ''}</button>
          {openPhone && <button onClick={() => { openPhone(); close(); }}>📱 Teléfono y detección automática</button>}
          <button onClick={() => { a.shareDraft(); close(); }}>🔗 Compartir enlace del draft</button>
          <button onClick={() => { a.exportSummary(); close(); }}>📋 Copiar resumen en texto</button>
          <button onClick={a.doUndo}>↩ Deshacer <kbd>Ctrl+Z</kbd></button>
          <button onClick={a.doRedo}>↪ Rehacer <kbd>Ctrl+Y</kbd></button>
          <button onClick={() => { a.reset(); close(); }}>⟲ Reiniciar draft</button>
          <button onClick={() => { a.newSeries(); close(); }}>🏁 Nueva serie (Bo3)</button>
          <label className="dd-menu-toggle"><input type="checkbox" checked={a.timerOn} onChange={(e) => a.setTimerOn(e.target.checked)} /> ⏱ Temporizador de turno</label>
          <label className="dd-menu-toggle"><input type="checkbox" checked={a.voiceFeedback} onChange={(e) => a.setVoiceFeedback(e.target.checked)} /> 🔊 Confirmar en voz alta</label>
        </nav>
        <div className="dd-menu-keys">
          <b>Atajos de teclado</b>
          <span><kbd>B</kbd>/<kbd>R</kbd> quién pickea primero</span>
          <span><kbd>V</kbd> dictar por voz: «banea Piper», «pick rojo Mortis», «deshacer»</span>
          <span><kbd>Enter</kbd> aplicar la sugerencia</span>
          <span><kbd>/</kbd> buscar brawler</span>
          <span><kbd>Ctrl+Z</kbd> deshacer · <kbd>Ctrl+Y</kbd> rehacer</span>
          <span><kbd>Esc</kbd> cerrar ventanas</span>
        </div>
        <p className="dd-menu-foot">{POOL_INFO} · Catálogo e imágenes: {DATA_SOURCE} · Ratings: estimación propia.</p>
      </aside>
    </>
  );
}
