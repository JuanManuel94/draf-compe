import { useEffect, useRef, useState } from 'react';
import { AppContext, useDraftApp } from './app/useDraftApp';
import { POOL_INFO } from './data/maps';
import { Avoid, BanSuggestions, BestPick, Recommendations, Threats, WeightsPanel } from './components/Advisor';
import { Board } from './components/Board';
import { CollectionModal } from './components/CollectionModal';
import { Compare, Favorites, History } from './components/Extras';
import { Header } from './components/Header';
import { PhasePanel } from './components/PhasePanel';
import { Pool } from './components/Pool';
import { SetupPanel } from './components/SetupPanel';
import { TurnPanel } from './components/TurnPanel';

export default function App() {
  const app = useDraftApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showCollection, setShowCollection] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Atajos: B/R primer pick · Enter sugerencia · / buscar · Ctrl+Z / Ctrl+Y · Esc cerrar
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setMenuOpen(false); setShowCollection(false); return; }
      const el = e.target as HTMLElement;
      const typing = el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
      if (typing || showCollection) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); app.doUndo(); }
      else if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); app.doRedo(); }
      else if (mod || e.altKey) return;
      else if (k === 'b') app.setFirstPicker('blue');
      else if (k === 'r') app.setFirstPicker('red');
      else if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
      // Enter sobre un botón enfocado lo pulsa; solo se usa como atajo si el foco no está en un control
      else if (e.key === 'Enter' && el.tagName !== 'BUTTON' && el.tagName !== 'A') { e.preventDefault(); app.applySuggestion(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [app, showCollection]);

  return (
    <AppContext.Provider value={app}>
      <div className="dd-app">
        <div className="dd-container">
          <Header menuOpen={menuOpen} setMenuOpen={setMenuOpen} openCollection={() => setShowCollection(true)} />
          <SetupPanel />
          <PhasePanel />
          <main className="dd-main">
            <section className="dd-draft-col" aria-label="Draft">
              <Board />
              <Pool />
              <div className="dd-mini-grid">
                <Compare />
                <Favorites />
                <History />
              </div>
            </section>
            <aside className="dd-suggest-col" aria-label="Asistente">
              <TurnPanel ref={searchRef} />
              <BestPick />
              <Threats />
              <Recommendations />
              <Avoid />
              <div className="dd-two">
                <BanSuggestions />
                <WeightsPanel />
              </div>
            </aside>
          </main>
          <footer className="dd-footer">
            Brawl Draft Pro · {POOL_INFO} · Formatos: Ranked (3 bans simultáneos por equipo + picks 1-2-2-1) y Torneo BSC stage (sorteo + 2 globales + 3 ciegos, rulebook v1.6) · Catálogo, rarezas, clases e imágenes: BrawlAPI/Brawlify (comunidad; imágenes © Supercell) · Ratings: estimación propia, no oficial.
          </footer>
        </div>
        {showCollection && <CollectionModal onClose={() => setShowCollection(false)} />}
      </div>
    </AppContext.Provider>
  );
}
