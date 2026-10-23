import { useApp } from '../app/useDraftApp';
import { MAPS } from '../data/maps';
import { restoreDraft } from '../engine/draftMachine';
import { brawlerById, matchupScore } from '../engine/scoring';
import type { HistoryEntry } from '../types';
import { BrawlerImg } from './ui';

// Comparador lado a lado: puntuación, desglose y duelo contra cada pick rival; resalta el mejor de cada fila
export function Compare() {
  const a = useApp();
  if (a.compare.length === 0) {
    return (
      <div className="dd-panel dd-mini dd-compare">
        <h3>Comparador</h3>
        <p className="dd-muted">Marca hasta 3 brawlers con ☆ en Recomendaciones para compararlos aquí lado a lado.</p>
      </div>
    );
  }
  const cols = a.compare.map((id) => ({ id, b: brawlerById(id)!, r: a.recs.find((x) => x.brawlerId === id) }));
  type Row = { label: string; values: (number | null)[]; higherIsBetter?: boolean };
  const rows: Row[] = [
    { label: 'Puntuación', values: cols.map((c) => c.r?.score ?? null) },
    { label: 'Mapa y modo', values: cols.map((c) => c.r?.parts.mapMode ?? null) },
    { label: 'Matchups', values: cols.map((c) => c.r?.parts.matchup ?? null) },
    { label: 'Sinergia', values: cols.map((c) => c.r?.parts.synergy ?? null) },
    { label: 'Meta', values: cols.map((c) => c.r?.parts.competitive ?? null) },
    { label: 'Riesgo de counter', values: cols.map((c) => c.r?.counterRisk ?? null), higherIsBetter: false },
    ...a.enemies.map((e) => ({ label: `vs ${brawlerById(e)?.name}`, values: cols.map((c) => matchupScore(c.id, e).score) }))
  ];
  return (
    <div className="dd-panel dd-mini dd-compare">
      <h3>Comparador</h3>
      <div className="dd-compare-scroll">
        <table className="dd-compare-table">
          <thead>
            <tr>
              <th scope="col"><span className="sr-only">Dato</span></th>
              {cols.map((c) => (
                <th key={c.id} scope="col">
                  <div className="dd-compare-head"><span className="dd-compare-img"><BrawlerImg b={c.b} size="w-full h-full" /></span>{c.b.name}
                    <button className="dd-x" aria-label={`Quitar ${c.b.name} del comparador`} onClick={() => a.setCompare(a.compare.filter((x) => x !== c.id))}>✕</button></div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const nums = row.values.filter((v): v is number => v !== null);
              const best = nums.length > 1 ? (row.higherIsBetter === false ? Math.min(...nums) : Math.max(...nums)) : null;
              return (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {row.values.map((v, i) => <td key={i} className={v !== null && v === best ? 'best' : ''}>{v ?? '—'}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {cols.some((c) => !c.r) && <p className="dd-muted small">— = ya baneado o elegido: sin puntuación.</p>}
    </div>
  );
}

export function Favorites() {
  const a = useApp();
  return (
    <div className="dd-panel dd-mini">
      <h3>Composiciones favoritas</h3>
      <button className="dd-btn small gray" onClick={() => { if (a.allies.length === 3) a.setFavorites([a.allies, ...a.favorites].slice(0, 10)); else a.setMsg('Necesitas 3 picks azules para guardar.'); }}>💾 Guardar azul actual</button>
      {a.favorites.map((f, i) => (
        <div key={i} className="dd-mini-row">{f.map((x) => brawlerById(x)?.name).join(' + ')}
          <button className="dd-x" aria-label="Borrar favorita" onClick={() => a.setFavorites(a.favorites.filter((_, j) => j !== i))}>✕</button></div>
      ))}
      {a.favorites.length === 0 && <p className="dd-muted">Sin favoritas.</p>}
    </div>
  );
}

function entrySummary(e: HistoryEntry) {
  const mm = MAPS.find((m) => m.id === e.mapId);
  const d = mm ? restoreDraft(mm.mode, mm.id, e.formatId, e.coinWinner, e.history) : null;
  const names = (ids: (string | null)[]) => ids.filter(Boolean).map((x) => brawlerById(x)?.name).join(', ') || '—';
  return { map: mm?.name ?? e.mapId, blue: d ? names(d.picksBlue) : '—', red: d ? names([...d.picksRed].reverse()) : '—' };
}

export function History() {
  const a = useApp();
  return (
    <div className="dd-panel dd-mini">
      <h3>Historial de drafts</h3>
      <div className="dd-history scroll-thin">
        {a.history.map((h, i) => {
          if (typeof h === 'string') return <div key={i} className="dd-mini-row dd-muted">{h}</div>;
          const s = entrySummary(h);
          return (
            <div key={h.id} className="dd-mini-row dd-history-row">
              <div>
                <b>{s.map}</b> <span className="dd-muted">· {new Date(h.at).toLocaleDateString()}</span>
                {h.result && <span className={`dd-tag-inline ${h.result === 'win' ? 'win' : 'loss'}`}>{h.result === 'win' ? 'Victoria' : 'Derrota'}</span>}
                <div className="dd-muted">🔵 {s.blue} · 🔴 {s.red}</div>
              </div>
              <button className="dd-btn small gray" onClick={() => a.loadEntry(h)} aria-label={`Cargar draft de ${s.map}`}>Cargar</button>
            </div>
          );
        })}
        {a.history.length === 0 && <p className="dd-muted">Se guarda al completar 6 picks.</p>}
      </div>
    </div>
  );
}
