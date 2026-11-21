import { useEffect, useRef, useState } from 'react';
import { useApp } from '../app/useDraftApp';
import { BrawlerImg, norm } from './ui';
import { VoiceFill } from './VoiceMic';
import { resolveBrawlerName } from '../app/voiceResolve';

export function CollectionModal({ onClose }: { onClose: () => void }) {
  const a = useApp();
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  return (
    <div className="dd-modal-backdrop" onClick={onClose}>
      <div className="dd-modal" role="dialog" aria-modal="true" aria-labelledby="coll-title" onClick={(e) => e.stopPropagation()}>
        <div className="dd-modal-head">
          <h2 id="coll-title">🎒 Mi colección</h2>
          <span className="dd-muted">{a.ALL.length - a.ownCount('no') - a.ownCount('low')} listos · {a.ownCount('low')} nivel bajo · {a.ownCount('no')} sin tener</span>
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar..." className="dd-input dd-modal-search" aria-label="Buscar en mi colección" />
          <VoiceFill onText={setQ} resolve={resolveBrawlerName} label="Buscar por voz" />
          <button className="dd-btn small gray" onClick={a.resetOwnership}>↩ Todos listos</button>
          <button className="dd-btn small gray" onClick={onClose}>✕ Cerrar</button>
        </div>
        <p className="dd-modal-hint">Toca cada brawler para cambiar: ✅ listo → ⚠️ nivel bajo (−15 pts) → 🚫 no lo tengo (fuera de tus recomendaciones). Los rivales pueden llevar cualquiera.</p>
        <div className="dd-modal-grid scroll-thin">
          {a.ALL.filter((b) => norm(b.name).includes(norm(q))).map((b) => {
            const st = a.ownership[b.id] ?? 'ok';
            return (
              <button key={b.id} onClick={() => a.cycleOwnership(b.id)} className={`dd-coll ${st}`} aria-label={`${b.name}: ${st === 'ok' ? 'listo' : st === 'low' ? 'nivel bajo' : 'no lo tengo'}`}>
                <div className="dd-coll-img"><BrawlerImg b={b} size="w-full h-full" /></div>
                <div className="dd-brawler-name">{b.name}</div>
                <div>{st === 'ok' ? '✅' : st === 'low' ? '⚠️ bajo' : '🚫 no'}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
