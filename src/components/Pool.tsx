import { useState } from 'react';
import { RARITIES, ROLES, useApp } from '../app/useDraftApp';
import { countersVs, matchupScore, metaOf } from '../engine/scoring';
import type { Role } from '../types';
import { BrawlerImg, norm, scoreClass } from './ui';

export function Pool() {
  const a = useApp();
  const [query, setQuery] = useState('');
  const [roleF, setRoleF] = useState<Role | 'Todos'>('Todos');
  const [rarityF, setRarityF] = useState('Todas');
  const grid = a.ALL.filter((b) => norm(b.name).includes(norm(query)) && (roleF === 'Todos' || b.roles.includes(roleF)) && (rarityF === 'Todas' || b.rarity === rarityF));
  const actionLabel = a.action === 'pickBlue' ? 'Pick Azul' : a.action === 'pickRed' ? 'Pick Rojo' : a.action === 'banBlue' ? 'Ban Azul' : a.action === 'banRed' ? 'Ban Rojo' : a.action === 'globalBlue' ? '🌍 Global Azul' : '🌍 Global Rojo';
  return (
    <div className="dd-panel dd-pool">
      <h3 className="dd-h3">Brawlers</h3>
      <p className="dd-subtitle">👆 Un toque: se aplica al instante en <b>{actionLabel}</b> y avanza solo al siguiente paso.</p>
      <div className="dd-filters">
        <div className="dd-input-wrap grow">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filtrar brawlers..." className="dd-input" aria-label="Filtrar brawlers por nombre" />
          <span className="dd-input-icon" aria-hidden="true">🔍</span>
        </div>
        <select value={roleF} onChange={(e) => setRoleF(e.target.value as Role | 'Todos')} className="dd-input dd-select-sm" aria-label="Filtrar por clase">
          {['Todos', ...ROLES].map((r) => <option key={r}>{r}</option>)}
        </select>
        <select value={rarityF} onChange={(e) => setRarityF(e.target.value)} className="dd-input dd-select-sm" aria-label="Filtrar por rareza">
          {RARITIES.map((r) => <option key={r}>{r}</option>)}
        </select>
        <span className="dd-muted">{grid.length}/{a.ALL.length}</span>
      </div>
      <div className="dd-brawler-grid scroll-thin">
        {grid.length === 0 && <p className="dd-empty">Ningún brawler coincide con la búsqueda.</p>}
        {grid.map((b) => {
          const out = a.unavailable(b.id);
          const rec = a.recs.find((r) => r.brawlerId === b.id);
          const mt = metaOf(b.id);
          const own = a.ownership[b.id] ?? 'ok';
          const cv = a.enemies.length > 0 ? countersVs(b.id, a.enemies).length : 0;
          const threatened = a.enemies.some((e) => matchupScore(e, b.id).score >= 75);
          const status = a.banned.includes(b.id) ? 'BANEADO' : a.picked.includes(b.id) ? 'ELEGIDO' : '';
          return (
            <button key={b.id} disabled={out} onClick={() => a.applyAction(b.id)} className={`dd-brawler ${out ? 'out' : ''}`}
              aria-label={`${b.name}${rec && !out ? `, ${rec.score} puntos` : ''}${out ? `, ${status.toLowerCase() || 'no disponible'}` : ''}`}
              title={out ? (status || 'No disponible') : `Tocar = ${actionLabel.toLowerCase()} instantáneo`}>
              <div className="dd-brawler-img"><BrawlerImg b={b} size="w-full h-full" />
                {rec && !out && <span className={`dd-score ${scoreClass(rec.score)}`}>{rec.score}</span>}
              </div>
              {a.enemies.length > 0 && (
                <div className="dd-tags">
                  {cv > 0 && <span className="dd-tag good">🎯x{cv}</span>}
                  {threatened && <span className="dd-tag bad">⚠️</span>}
                </div>
              )}
              <div className="dd-brawler-name">{b.name}{!b.curated && <span className="dd-muted" title="Perfil estimado por clase">~</span>}{own !== 'ok' && <span title={own === 'no' ? 'No lo tienes: fuera de tus recomendaciones' : 'Nivel bajo: -15 puntos'}>{own === 'no' ? '🚫' : '⚠️'}</span>}</div>
              <div className="dd-brawler-meta">{b.roles[0]} · {b.rarity}</div>
              {(mt.tier || mt.buffy) && <div className={`dd-tier ${mt.tier === 'S' ? 's' : mt.tier === 'W' ? 'w' : 'a'}`}>{mt.buffy ? '🔥' : ''}{mt.tier === 'S' ? 'META S' : mt.tier === 'A' ? 'A' : mt.tier === 'W' ? 'flojo' : ''}</div>}
              {out && status && <div className="dd-out-label">{status}</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
