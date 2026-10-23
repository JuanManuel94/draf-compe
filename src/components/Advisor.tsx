import { useState } from 'react';
import { WEIGHT_LABELS, useApp } from '../app/useDraftApp';
import { DEFAULT_WEIGHTS, brawlerById, countersVs, matchupScore, metaLabel } from '../engine/scoring';
import type { Recommendation, Weights } from '../types';
import { Bar, BrawlerImg, scoreClass, scoreColor } from './ui';
import { REAL_META } from '../engine/realMeta';

const PARTS: [keyof Recommendation['parts'], string][] = [['mapMode', 'Mapa'], ['matchup', 'Matchup'], ['synergy', 'Sinergia'], ['competitive', 'Meta']];

function RealWR({ id }: { id: string }) {
  const { realStats, map } = useApp();
  const st = realStats[id];
  return st ? <span className={`dd-real ${st.reliability}`} title={`Ranked real en ${map.name}: ${Math.round(st.wr * 100)}% de victorias en ${st.games} partidas, aparece en el ${Math.round(st.pick * 100)}% (brawlbetter.com)`}>{Math.round(st.wr * 100)}% · {st.games}p</span> : null;
}

export function BestPick() {
  const a = useApp();
  const { vd, recs, enemies, ownership } = a;
  if (a.done && vd) {
    return (
      <div className="dd-engine verdict">
        <h3>🔒 Veredicto final (sin cambios)</h3>
        <div className="dd-verdict-grid">
          <div className="blue"><div className="dd-c-blue">NOSOTROS {vd.blue.grade}</div><div>Mapa {vd.blue.map} · Duelos {vd.blue.counter}</div></div>
          <div className="red"><div className="dd-c-red">ELLOS {vd.red.grade}</div><div>Mapa {vd.red.map} · Duelos {vd.red.counter}</div></div>
        </div>
        <p className="dd-strong">{vd.edge === 'blue' ? '✅ Ventaja nuestra: ejecuta tu plan.' : vd.edge === 'red' ? '⚠️ Ventaja rival: juega perfecto y evita sus counters.' : '➖ Draft parejo: lo decide la ejecución.'}</p>
        <p>💡 {vd.tip}</p>
      </div>
    );
  }
  const top = recs[0];
  const b = top ? brawlerById(top.brawlerId) : null;
  const st = top ? ownership[top.brawlerId] ?? 'ok' : 'ok';
  const blueTurn = a.exp.kind === 'pick' && a.exp.team === 'blue';
  return (
    <div className="dd-engine">
      <h3>🎯 Tu mejor pick ahora{enemies.length === 0 ? <span className="dd-muted"> (a ciegas: prioriza pick seguro 🛡️)</span> : ''}</h3>
      {top && b && (
        <button className="dd-best" title={blueTurn ? 'Tocar = pickearlo para el azul (o pulsa Enter)' : 'Se podrá pickear cuando sea el turno azul'} onClick={() => a.doPick('blue', top.brawlerId)}>
          <div className="dd-best-img"><BrawlerImg b={b} size="w-full h-full" /></div>
          <span className="dd-best-text"><span className="dd-best-name">{b.name} <span className="dd-c-green">{top.score}</span> <RealWR id={b.id} /></span>
            <span className="dd-best-expl">{top.explanation}</span>
            {!blueTurn && <span className="dd-best-wait">{a.picksLocked ? '🔒 Disponible al terminar los baneos' : '⏳ Espera al turno azul'}</span>}</span>
        </button>
      )}
      {top && (
        <div className="dd-own-row">
          {st === 'ok' ? <>
            <button className="dd-btn small gray" onClick={() => a.setOwn(top.brawlerId, 'no')}>❌ No lo tengo</button>
            <button className="dd-btn small gray" onClick={() => a.setOwn(top.brawlerId, 'low')}>⚠️ Nivel bajo</button>
          </> : <button className="dd-btn small green" onClick={() => a.setOwn(top.brawlerId, 'ok')}>↩ {st === 'no' ? 'Ya lo tengo' : 'Ya está maxeado'} — volver a incluir</button>}
        </div>
      )}
    </div>
  );
}

export function Threats() {
  const a = useApp();
  if (a.threats.length === 0) return null;
  return (
    <div className="dd-panel dd-threats">
      <h3 className="dd-h3 red">⚠️ Nos counterean — responde ya</h3>
      {a.threats.slice(0, 3).map((t, i) => {
        const resp = a.recs.find((r) => countersVs(r.brawlerId, [t.enemy]).length > 0);
        const rb = resp ? brawlerById(resp.brawlerId) : null;
        return (
          <div key={i} className="dd-threat">
            <b>{brawlerById(t.enemy)?.name}</b> counterea a tu <b>{brawlerById(t.ally)?.name}</b> ({t.score}).
            <div className="dd-muted">{t.note}</div>
            {rb && resp && !a.done && <button className="dd-link" onClick={() => a.doPick('blue', resp.brawlerId)}>↩ Responde con {rb.name} ({resp.score}) — tócalo para pickearlo</button>}
            {a.done && <div className="dd-muted">🔒 Draft cerrado: ya no puedes responder. Evita ese duelo en partida.</div>}
          </div>
        );
      })}
    </div>
  );
}

export function Recommendations() {
  const a = useApp();
  const [expanded, setExpanded] = useState<string | null>(null);
  const realNote = a.realMap ? `meta Ranked real de ${a.map.name}: ${a.realMap.battles} partidas de jugadores top (${REAL_META.windowDays} días, ${REAL_META.updatedAt})` : 'sin datos Ranked de este mapa: estimación propia';
  return (
    <div className="dd-panel dd-recs">
      <h3 className="dd-h3">Recomendaciones</h3>
      <p className="dd-subtitle">Auto-actualizado · {realNote}</p>
      <div className="dd-rec-grid">
        {a.recs.slice(0, 9).map((r, i) => {
          const b = brawlerById(r.brawlerId)!;
          const open = expanded === r.brawlerId;
          const starred = a.compare.includes(r.brawlerId);
          return (
            <div key={r.brawlerId} className={`dd-rec-card ${i === 0 ? 'top' : ''} ${open ? 'open' : ''}`}>
              <button className="dd-rec-toggle" aria-expanded={open} aria-label={`${b.name}, ${r.score} puntos. ${open ? 'Ocultar' : 'Ver'} detalle`} onClick={() => setExpanded(open ? null : r.brawlerId)} />
              <div className="dd-rec-head">
                <div className="dd-rec-img"><BrawlerImg b={b} size="w-full h-full" /></div>
                <div className="min-w-0">
                  <h4>#{i + 1} {b.name}</h4>
                  <div className={`dd-rec-score ${scoreClass(r.score)}`}>{r.score} <RealWR id={b.id} /></div>
                </div>
                <button className={`dd-star ${starred ? 'on' : ''}`} aria-pressed={starred} aria-label={starred ? `Quitar ${b.name} del comparador` : `Añadir ${b.name} al comparador`} title="Comparar"
                  onClick={() => a.setCompare(starred ? a.compare.filter((c) => c !== r.brawlerId) : [...a.compare, r.brawlerId].slice(-3))}>{starred ? '★' : '☆'}</button>
              </div>
              <div className="dd-rec-stats">{b.roles.join(' · ')}{r.safeBlind && a.enemies.length < 3 ? ' · 🛡️ seguro' : ''}{r.multiCounter >= 1 ? ` · 🎯 x${r.multiCounter}` : ''}<br /><small>riesgo {r.counterRisk}</small></div>
              <div className="dd-parts" aria-label="Desglose de la puntuación">
                {PARTS.map(([k, label]) => (
                  <div key={k} className="dd-part"><span>{label}</span><Bar v={r.parts[k]} c={scoreColor(r.parts[k])} label={`${label} ${r.parts[k]}`} /><b>{r.parts[k]}</b></div>
                ))}
              </div>
              {open && (
                <div className="dd-rec-detail">
                  <p>💡 {r.explanation}</p>
                  {metaLabel(r.brawlerId) && <p>📊 Meta actual: <b>{metaLabel(r.brawlerId)}</b></p>}
                  {(() => { const cs = countersVs(r.brawlerId, a.enemies); return cs.length > 0 ? <p>🎯 Countera a: <b>{cs.map((c) => brawlerById(c)?.name).join(', ')}</b></p> : null; })()}
                  <p>⚠ Debilidades: {r.weaknesses.join('; ')}</p>
                  <p>🔁 Alternativas: {r.alternatives.map((x) => brawlerById(x)?.name).join(', ') || '—'}</p>
                  {(() => { const st = a.ownership[r.brawlerId] ?? 'ok'; return (
                    <p className="dd-own-row">🎒 Mío: <b>{st === 'ok' ? 'listo ✅' : st === 'low' ? 'nivel bajo ⚠️' : 'no lo tengo 🚫'}</b>
                      {st === 'ok' ? <><button className="dd-btn small gray" onClick={() => a.setOwn(r.brawlerId, 'no')}>No lo tengo</button><button className="dd-btn small gray" onClick={() => a.setOwn(r.brawlerId, 'low')}>Nivel bajo</button></>
                        : <button className="dd-btn small green" onClick={() => a.setOwn(r.brawlerId, 'ok')}>↩ Incluir</button>}</p>); })()}
                  {a.enemies.map((e) => { const m = matchupScore(r.brawlerId, e); return <p key={e}>vs {brawlerById(e)?.name}: <b>{m.score}</b> — {m.note} (conf. {m.confidence}{m.mapDependent ? ', depende del mapa' : ''})</p>; })}
                  <button className="dd-btn small blue" onClick={() => a.doPick('blue', r.brawlerId)}>Pick azul</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Avoid() {
  const a = useApp();
  return (
    <div className="dd-panel dd-avoid">
      <h3 className="dd-h3 red">⛔ Evitar ahora</h3>
      {a.avoid.map((r) => <div key={r.brawlerId} className="dd-mini-row"><b>{brawlerById(r.brawlerId)?.name}</b> ({r.score}) — mal matchup o anti-sinergia. Riesgo {r.counterRisk}.</div>)}
    </div>
  );
}

export function BanSuggestions() {
  const a = useApp();
  const [banCount, setBanCount] = useState(3);
  // En Ranked los bans son simultáneos: el rival suele banear lo mismo (los mejores del mapa).
  const simultaneous = a.format.freeOrder;
  const list = a.suggestedBans(simultaneous ? banCount + 3 : banCount);
  return (
    <div className="dd-panel">
      <div className="dd-panel-head">
        <h3 className="dd-h3">Baneos sugeridos</h3>
        <select value={banCount} onChange={(e) => setBanCount(Number(e.target.value))} className="dd-input dd-select-xs" aria-label="Número de baneos sugeridos">
          {[3, 4, 5].map((n) => <option key={n} value={n}>Top {n}</option>)}
        </select>
      </div>
      {simultaneous && <p className="dd-muted small dd-center">🔁 Los 3 primeros son los que más probablemente banea también el rival: si confías en que lo hará, usa tus bans en las alternativas para no duplicar.</p>}
      <div className="dd-ban-sugs">
        {list.map((b, i) => {
          const bb = brawlerById(b.brawlerId);
          const rivalLikely = simultaneous && i < 3;
          const alt = simultaneous && i >= 3;
          return (
            <button key={b.brawlerId} onClick={() => a.banSuggested(b.brawlerId)} title="Tocar = banearlo al instante" className={`dd-ban-sug ${alt ? 'alt' : ''}`}>
              {bb && <div className="dd-ban-sug-img"><BrawlerImg b={bb} size="w-full h-full" /></div>}
              <span><span className="dd-c-red">#{i + 1} {bb?.name}</span> <span className="dd-muted">({b.score})</span>
                {rivalLikely && <span className="dd-tag-inline rival">probable ban rival</span>}
                {alt && <span className="dd-tag-inline alt">alternativa sin duplicar</span>}
                <span className="dd-ban-sug-reason">{b.reason}</span></span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function WeightsPanel() {
  const a = useApp();
  const changed = (Object.keys(DEFAULT_WEIGHTS) as (keyof Weights)[]).some((k) => a.weights[k] !== DEFAULT_WEIGHTS[k]);
  return (
    <div className="dd-panel">
      <h3 className="dd-h3">Ponderación</h3>
      {(Object.keys(a.weights) as (keyof Weights)[]).map((k) => (
        <label key={k} className="dd-weight">
          <span className="dd-weight-name">{WEIGHT_LABELS[k]}</span>
          <input type="range" min={0} max={0.6} step={0.05} value={a.weights[k]} aria-label={WEIGHT_LABELS[k]} onChange={(e) => a.setWeights({ ...a.weights, [k]: Number(e.target.value) })} />
          <span className="dd-weight-val">{Math.round(a.weights[k] * 100)}%</span>
        </label>
      ))}
      <div className="dd-weight-foot">
        <p className="dd-muted small">Pesos de demostración, no oficiales. Normalizado 0–100.</p>
        <button className="dd-btn small gray" disabled={!changed} onClick={() => a.setWeights(DEFAULT_WEIGHTS)}>↺ Restablecer</button>
      </div>
    </div>
  );
}
