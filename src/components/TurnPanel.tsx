import { forwardRef, useMemo, useState } from 'react';
import { type Action, useApp } from '../app/useDraftApp';
import { flipCoin, ourPickJob } from '../engine/draftMachine';
import { brawlerById } from '../engine/scoring';
import type { Team } from '../types';
import { useTurnTexts } from './PhasePanel';
import { BrawlerImg, norm } from './ui';
import { VoiceButton, type VoiceHandle } from './VoiceButton';

// Buscador con autocompletado: escribe, elige con ↑/↓ y Enter aplica la acción actual
export const QuickSearch = forwardRef<HTMLInputElement>(function QuickSearch(_, ref) {
  const a = useApp();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const matches = useMemo(() => (q.trim() ? a.ALL.filter((b) => norm(b.name).includes(norm(q.trim())) && !a.unavailable(b.id)).slice(0, 6) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q, a.ALL, a.draft, a.action]);
  const apply = (id: string) => { if (a.applyAction(id)) { setQ(''); setSel(0); } };
  return (
    <div className="dd-input-wrap dd-quick">
      <input ref={ref} value={q} placeholder="Nombre del brawler... (/)" className="dd-input" aria-label="Buscar brawler y aplicar la acción actual"
        role="combobox" aria-expanded={matches.length > 0} aria-controls="dd-quick-list" aria-autocomplete="list"
        onChange={(e) => { setQ(e.target.value); setSel(0); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, matches.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
          else if (e.key === 'Enter' && matches[sel]) { e.preventDefault(); apply(matches[sel].id); }
          else if (e.key === 'Escape') { setQ(''); (e.target as HTMLInputElement).blur(); }
        }} />
      <span className="dd-input-icon" aria-hidden="true">🔍</span>
      {matches.length > 0 && (
        <div className="dd-suggestions" id="dd-quick-list" role="listbox">
          {matches.map((b, i) => (
            <button key={b.id} role="option" aria-selected={i === sel} className={`dd-suggestion ${i === sel ? 'selected' : ''}`} onMouseEnter={() => setSel(i)} onClick={() => apply(b.id)}>
              <span className="dd-suggestion-img"><BrawlerImg b={b} size="w-full h-full" /></span>
              <span>{b.name}</span>
              <span className="dd-muted">{b.roles[0]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

export const TurnPanel = forwardRef<HTMLInputElement, { voiceRef?: React.Ref<VoiceHandle> }>(function TurnPanel({ voiceRef }, searchRef) {
  const a = useApp();
  const { centerBadge } = useTurnTexts();
  const { draft, format, exp, done } = a;
  const [flipping, setFlipping] = useState(false);
  const [coinFace, setCoinFace] = useState<Team>('blue');
  const sg = a.suggestion();

  function runCoinFlip() {
    if (flipping) return;
    setFlipping(true);
    const t0 = Date.now();
    const iv = setInterval(() => {
      setCoinFace((c) => (c === 'blue' ? 'red' : 'blue'));
      if (Date.now() - t0 > 1100) {
        clearInterval(iv);
        const winner: Team = Math.random() < 0.5 ? 'blue' : 'red';
        a.setDraft((d) => flipCoin(d, winner));
        setFlipping(false);
        a.setMsg('');
      }
    }, 120);
  }

  const chips: [Action, string][] = [
    ['pickBlue', `🎯 Pick Azul (${draft.picksBlue.filter(Boolean).length}/3)`],
    ['pickRed', `🎯 Pick Rojo (${draft.picksRed.filter(Boolean).length}/3)`],
    ['banBlue', `🚫 Ban Azul (${draft.bansBlue.length}/${format.bansPerTeam})`],
    ['banRed', `🚫 Ban Rojo (${draft.bansRed.length}/${format.bansPerTeam})`]
  ];
  const job = ourPickJob(draft.picksBlue);
  const myTurn = !done && a.mySlot !== null && a.allies.length === a.mySlot;

  return (
    <div className="dd-panel dd-current">
      <div className="dd-prompt-line">
        <h2>{centerBadge}</h2>
        <div className="dd-toolbar">
          <button className="dd-btn-icon gray" title="Reiniciar" aria-label="Reiniciar draft" onClick={() => a.reset()}>⟲</button>
          <button className="dd-btn-icon teal" title="Compartir enlace" aria-label="Compartir enlace del draft" onClick={a.shareDraft}>🔗</button>
          <button className="dd-btn-icon blue" title="Rehacer (Ctrl+Y)" aria-label="Rehacer" onClick={a.doRedo}>↪</button>
          <button className="dd-btn-icon blue" title="Deshacer (Ctrl+Z)" aria-label="Deshacer" onClick={a.doUndo}>↩</button>
        </div>
      </div>

      {done ? (
        <div className="dd-result">
          {a.seriesOver ? (
            <>
              <p className="dd-strong">{a.wins > a.losses ? `🏆 ¡Serie ganada ${a.wins}–${a.losses}!` : `💀 Serie perdida ${a.wins}–${a.losses}.`}</p>
              <button className="dd-btn green" onClick={a.newSeries}>🏁 Nueva serie</button>
            </>
          ) : a.gameRecorded ? (
            <>
              <p>Resultado guardado · Serie <b>{a.wins} – {a.losses}</b></p>
              <button className="dd-btn blue" onClick={a.nextGame}>▶ Siguiente partida</button>
            </>
          ) : (
            <>
              <p>¿Cómo terminó la partida? <span className="dd-muted">(serie al mejor de 3)</span></p>
              <div className="dd-coin-actions">
                <button className="dd-btn green" onClick={() => a.recordResult('win')}>🏆 Ganamos</button>
                <button className="dd-btn red" onClick={() => a.recordResult('loss')}>💀 Perdimos</button>
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          <p className="dd-instr">
            {a.banPhase ? <>🚫 <b>1º registra los {format.bansPerTeam} bans por equipo (1 por jugador)</b>.{format.freeOrder && <> Son simultáneos: los dos equipos pueden banear al mismo brawler.</>} <b>Los picks están bloqueados 🔒</b> hasta terminar.</>
              : <>🎮 <b>2º marca los picks</b> por turnos: mientras un equipo elige, el otro espera. Aquí te digo <b>qué pickear</b> al instante.</>}
          </p>
          <div className="dd-quick-row">
            <QuickSearch ref={searchRef} />
            {sg && <button className="dd-btn small green" onClick={a.applySuggestion} title="Tecla Enter">⏎ {brawlerById(sg.id)?.name} <span className="dd-muted-dark">({sg.label})</span></button>}
          </div>
          <div className="dd-chips center">
            {chips.map(([act, label]) => {
              const locked = a.pickChipLocked(act);
              return (
                <button key={act} onClick={() => a.setAction(act)} disabled={locked} aria-pressed={a.action === act}
                  title={locked ? (a.picksLocked ? '🔒 Primero termina los baneos' : `⏳ Está eligiendo el equipo ${exp.kind === 'pick' && exp.team === 'blue' ? 'AZUL' : 'ROJO'}`) : undefined}
                  className={`dd-chip ${a.action === act ? (act === 'pickBlue' || act === 'banBlue' ? 'active-blue' : 'active-red') : ''}`}>{label}</button>
              );
            })}
            {format.globalBansPerTeam > 0 && (['globalBlue', 'globalRed'] as Action[]).map((act) => (
              <button key={act} onClick={() => a.setAction(act)} aria-pressed={a.action === act} className={`dd-chip ${a.action === act ? 'active-purple' : ''}`}>{act === 'globalBlue' ? '🌍 Global Azul' : '🌍 Global Rojo'}</button>
            ))}
          </div>
        </>
      )}

      <VoiceButton ref={voiceRef} />

      {format.coinFlip && (exp.kind === 'coin' || draft.coinWinner) && (
        <div className="dd-coin">
          {!draft.coinWinner ? (
            <>
              <div className="dd-coin-face" aria-hidden="true">{flipping ? (coinFace === 'blue' ? '🔵' : '🔴') : '🪙'}</div>
              <p>{flipping ? 'Girando…' : 'Si sale azul, comenzamos pickeando nosotros; si sale roja, comienzan ellos.'}</p>
              <div className="dd-coin-actions">
                <button onClick={runCoinFlip} disabled={flipping} className="dd-btn yellow">{flipping ? 'Girando…' : '🪙 Lanzar moneda'}</button>
                <button onClick={() => a.setFirstPicker('blue')} className="dd-btn small blue">Empezamos nosotros (B)</button>
                <button onClick={() => a.setFirstPicker('red')} className="dd-btn small red">Empiezan ellos (R)</button>
              </div>
            </>
          ) : (
            <p>🪙 Sorteo: <b className={draft.coinWinner === 'blue' ? 'dd-c-blue' : 'dd-c-red'}>{draft.coinWinner === 'blue' ? 'AZUL — comenzamos nosotros' : 'ROJO — comienzan ellos'}</b>
              {draft.history.length <= 1 && <button className="dd-btn small gray ml-2" onClick={() => a.setDraft((d) => { const n = structuredClone(d); n.coinWinner = null; n.history = n.history.filter((h) => h.kind !== 'coin'); n.phase = 'coin'; return n; })}>Repetir sorteo</button>}</p>
          )}
        </div>
      )}

      {!done && (
        <div className={`dd-myslot ${myTurn ? 'hot' : ''}`}>
          {job !== 'DONE' && (
            <div>📌 Nuestro pick Nº {a.allies.length + 1} — {job === 'FP' ? <><b>🛡️ FIRST PICK:</b> asegura poder de mapa difícil de counterear (nada de especialistas).</> : job === 'MID' ? <><b>🧩 MID:</b> completa roles y sinergia con tu {a.allies.map((x) => brawlerById(x)?.name).join(' + ') || 'FP'}.</> : <><b>🎯 LAST PICK:</b> counter duro a lo suyo, es tu asiento de counter.</>}</div>
          )}
          <div className="dd-myslot-row">
            <span>¿Qué pick eres tú?</span>
            {(['FP', 'MID', 'LAST'] as const).map((j, idx) => (
              <button key={j} onClick={() => a.setMySlot(a.mySlot === idx ? null : idx)} aria-pressed={a.mySlot === idx} className={`dd-chip small ${a.mySlot === idx ? 'active' : ''}`}>{j}</button>
            ))}
            {a.mySlot !== null && <span className="dd-c-yellow">🧍 Eres el {(['FP', 'MID', 'LAST'] as const)[a.mySlot]}{a.mySlot === 2 ? ' 👑 (capitán)' : ''}{myTurn && a.recs[0] ? ` — ¡TE TOCA A TI! Elige ${brawlerById(a.recs[0].brawlerId)?.name} (${a.recs[0].score})` : myTurn ? ' — ¡TE TOCA A TI!' : ''}</span>}
          </div>
          <p className="dd-muted small">👑 El capitán (el de más Elo) pickea último. 🔁 Si en el juego aceptas un <b>intercambio de orden</b>, toca aquí tu nuevo turno y la app te avisará cuando te toque.</p>
        </div>
      )}
    </div>
  );
});
