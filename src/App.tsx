import { useEffect, useRef, useState } from 'react';
import { AppContext, useDraftApp } from './app/useDraftApp';
import { POOL_INFO } from './data/maps';
import { Avoid, BanSuggestions, BestPick, MapCounters, Recommendations, Threats, WeightsPanel } from './components/Advisor';
import { Board } from './components/Board';
import { CollectionModal } from './components/CollectionModal';
import { Compare, Favorites, History } from './components/Extras';
import { Header } from './components/Header';
import { FlowBar, MapStep } from './components/Flow';
import { PhonePanel } from './components/PhonePanel';
import { STANDALONE } from './app/env';
import { Pool } from './components/Pool';
import { QuickView, useQuickView } from './components/QuickView';
import { TurnPanel } from './components/TurnPanel';
import type { VoiceHandle } from './components/VoiceMic';

export default function App() {
  const app = useDraftApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showCollection, setShowCollection] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const voiceRef = useRef<VoiceHandle>(null);
  const qv = useQuickView();

  // Atajos: B/R primer pick · V voz · Enter sugerencia · / buscar · Ctrl+Z / Ctrl+Y · Esc cerrar
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setMenuOpen(false); setShowCollection(false); setShowPhone(false); return; }
      const el = e.target as HTMLElement;
      const typing = el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
      if (typing || showCollection || showPhone) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); app.doUndo(); }
      else if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); app.doRedo(); }
      else if (mod || e.altKey) return;
      else if (k === 'b') app.setFirstPicker('blue');
      else if (k === 'r') app.setFirstPicker('red');
      else if (k === 'v') voiceRef.current?.toggle();
      else if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
      // Enter sobre un botón enfocado lo pulsa; solo se usa como atajo si el foco no está en un control
      else if (e.key === 'Enter' && el.tagName !== 'BUTTON' && el.tagName !== 'A') { e.preventDefault(); app.applySuggestion(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [app, showCollection, showPhone]);

  // Ventana flotante / pantalla pequeña: vista rápida de una sola pantalla
  if (qv.quick) {
    return (
      <AppContext.Provider value={app}>
        <QuickView onFull={() => qv.setPref(qv.small ? 'off' : 'auto')} />
      </AppContext.Provider>
    );
  }

  return (
    <AppContext.Provider value={app}>
      <div className="dd-app">
        <div className="dd-container">
          <Header openQuick={() => qv.setPref(qv.small ? 'auto' : 'on')} menuOpen={menuOpen} setMenuOpen={setMenuOpen} openCollection={() => setShowCollection(true)} openPhone={STANDALONE ? undefined : () => setShowPhone(true)} />
          <FlowBar />
          {app.flowStep === 'map' ? <MapStep /> : (
            <main className="dd-main">
              <section className="dd-draft-col" aria-label="Draft">
                <Board />
                {app.flowStep !== 'done' && <Pool />}
              </section>
              <aside className="dd-suggest-col" aria-label="Asistente">
                {app.flowStep !== 'done' && <TurnPanel ref={searchRef} voiceRef={voiceRef} />}
                {app.flowStep === 'bans' ? <BanSuggestions /> : <>
                  <BestPick />
                  <Threats />
                  {app.flowStep === 'picks' && <><MapCounters /><Recommendations /></>}
                </>}
              </aside>
            </main>
          )}
          <details className="dd-panel dd-tools">
            <summary>🧰 Más herramientas <span className="dd-muted small">(comparar, favoritos, historial, evitar, pesos del motor)</span></summary>
            <div className="dd-mini-grid">
              <Compare />
              <Favorites />
              <History />
            </div>
            <div className="dd-two">
              <Avoid />
              <WeightsPanel />
            </div>
          </details>
          <footer className="dd-footer">
            Brawl Draft Pro · {POOL_INFO} · Formatos: Ranked Mítico+ (3 bans por equipo + picks 1-2-2-1, capitán último) y Torneo BSC stage (sorteo + 2 globales + 3 ciegos, rulebook v1.6) · Meta: brawlbetter.com · Counters: brawlcalculator.com (SpenLC) · Catálogo e imágenes: BrawlAPI/Brawlify (comunidad; imágenes © Supercell) · Ratings: estimación, no oficial.
          </footer>
        </div>
        {showCollection && <CollectionModal onClose={() => setShowCollection(false)} />}
        {!STANDALONE && <PhonePanel open={showPhone} onClose={() => setShowPhone(false)} />}
      </div>
    </AppContext.Provider>
  );
}
