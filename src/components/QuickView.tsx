import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../app/useDraftApp';
import { useSpeech } from '../app/useSpeech';
import { MAPS } from '../data/maps';
import { modeInfo } from '../data/modes';
import { REAL_META } from '../engine/realMeta';
import { brawlerById, predictRivalPicks } from '../engine/scoring';
import { store } from '../engine/storage';
import { parseVoiceList, type VoiceCommand } from '../engine/voice';
import type { Brawler, Team } from '../types';
import { Timer } from './PhasePanel';
import { BrawlerImg, MapImg, ModeIcon, norm, scoreClass } from './ui';

// Vista rápida: pensada para la ventana flotante del teléfono encima de Brawl Stars.
// Todo cabe en una pantalla sin desplazarse: estado + sugerencias de un toque + tablero mini + brawlers.

export type QuickPref = 'auto' | 'on' | 'off';
// Automática en ventanas pequeñas de pantalla táctil (ventana flotante, pantalla dividida o el teléfono en horizontal)
const SMALL = '(pointer: coarse) and (max-height: 620px), (pointer: coarse) and (max-width: 330px)';

export function useQuickView() {
  const [pref, setPrefState] = useState<QuickPref>(() => store.load('quickView', 'auto'));
  const [small, setSmall] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(SMALL).matches);
  useEffect(() => {
    const mq = matchMedia(SMALL);
    const on = () => setSmall(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const setPref = (p: QuickPref) => { setPrefState(p); store.save('quickView', p); };
  return { quick: pref === 'on' || (pref === 'auto' && small), small, setPref };
}

const Mini = ({ id, ban }: { id?: string; ban?: boolean }) => {
  const b = id ? brawlerById(id) : null;
  return <span className={`qv-mini ${ban ? 'ban' : ''} ${b ? 'filled' : ''}`}>{b && <BrawlerImg b={b} size="w-full h-full" />}</span>;
};

export function QuickView({ onFull }: { onFull: () => void }) {
  const a = useApp();
  const [q, setQ] = useState('');
  const { draft, format, exp } = a;
  const step = a.flowStep;
  const ourTurn = exp.kind === 'pick' && exp.team === 'blue';
  const choosingFirst = exp.kind === 'coin' || (step === 'picks' && a.picked.length === 0 && format.freeOrder);
  const banTeam = a.action === 'banRed' ? 'red' : 'blue';

  const status = step === 'map' ? '🗺️ Elige el mapa'
    : step === 'done' ? '✅ Draft completo'
    : exp.kind === 'ban' || exp.kind === 'globalban' ? `🚫 Bans ${a.setBansDone}/${a.setBansTotal}`
    : ourTurn ? '🎯 ¡Os toca elegir!'
    : '⏳ Elige el rival';

  const pool = useMemo(() => {
    const t = norm(q.trim());
    return a.ALL.filter((b) => !t || norm(b.name).includes(t));
  }, [a.ALL, q]);
  const tap = (id: string) => { if (a.applyAction(id)) setQ(''); };
  // Lo que probablemente elige el rival: primera fila de un toque en su turno
  const rivalPred = useMemo(() => predictRivalPicks(a.map.id, a.enemies, a.allies, a.banned, a.picked),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [a.map.id, a.draft]);
  const rivalPickTurn = exp.kind === 'pick' && exp.team === 'red';
  const voice = useQuickVoice();

  return (
    <div className={`qv ${step === 'map' ? 'is-map' : ''}`}>
      <div className="qv-info">
      <header className="qv-top">
        {step !== 'map' && (
          <button className="qv-map" onClick={a.editMap} disabled={draft.history.length > 0} title={a.map.name} aria-label={`Mapa: ${a.map.name}`}>
            {a.map.photo && <MapImg src={a.map.photo} name={a.map.name} cls="qv-map-img" />}
            <ModeIcon mode={a.map.mode} size={16} cls="qv-map-mode" />
          </button>
        )}
        <b className={`qv-status ${ourTurn ? 'hot' : ''}`} role="status">{status}</b>
        <Timer compact />
        <button className="qv-icon" onClick={a.doUndo} aria-label="Deshacer" title="Deshacer">↩</button>
        <button className="qv-icon" onClick={() => a.reset(!a.done)} aria-label="Nuevo draft" title="Nuevo draft">🔄</button>
        <button className="qv-icon" onClick={onFull} aria-label="Vista completa" title="Vista completa">⤢</button>
      </header>

      {a.msg && <div className="qv-msg" role="alert">{a.msg}</div>}

      {step !== 'map' && <>
          {choosingFirst && (
            <div className="qv-row qv-first">
              <span>¿Quién elige 1º?</span>
              <button className={`qv-pill blue ${draft.coinWinner !== 'red' ? 'on' : ''}`} onClick={() => a.setFirstPicker('blue')}>🔵 Nosotros</button>
              <button className={`qv-pill red ${draft.coinWinner === 'red' ? 'on' : ''}`} onClick={() => a.setFirstPicker('red')}>🔴 Ellos</button>
            </div>
          )}

          {step === 'bans' && (
            <>
              <div className="qv-row">
                <button className={`qv-pill blue ${banTeam === 'blue' ? 'on' : ''}`} onClick={() => a.setAction('banBlue')}>Nuestro ban {draft.bansBlue.length}/{format.bansPerTeam}</button>
                <button className={`qv-pill red ${banTeam === 'red' ? 'on' : ''}`} onClick={() => a.setAction('banRed')}>Ban rival {draft.bansRed.length}/{format.bansPerTeam}</button>
              </div>
              <Strip label={banTeam === 'red' ? 'Probable:' : 'Banea:'} items={a.suggestedBans(8).map((s) => ({ id: s.brawlerId, score: s.score }))} cls="ban" onTap={(id) => a.banSuggested(id)} disabled={(id) => a.unavailable(id)} />
            </>
          )}

          {step === 'picks' && (ourTurn
            ? <Strip label="Elige:" items={a.recs.slice(0, 8).map((r) => ({ id: r.brawlerId, score: r.score }))} cls="pick" onTap={(id) => a.doPick('blue', id)} />
            : rivalPickTurn ? <>
                <Strip label="Probable:" items={rivalPred.map((r) => ({ id: r.brawlerId, score: r.score }))}cls="rival" onTap={(id) => a.doPick('red', id)} />
                {a.threats[0] && <div className="qv-hint">⚠️ <b>{brawlerById(a.threats[0].enemy)?.name}</b> counterea a tu {brawlerById(a.threats[0].ally)?.name}</div>}
              </> : null)}

          {step === 'done' && <QuickResult onFull={onFull} />}

          <div className="qv-board" aria-label="Tablero">
            <div className="qv-side blue">
              {Array.from({ length: format.bansPerTeam }, (_, i) => <Mini key={`b${i}`} id={draft.bansBlue[i]} ban />)}
              <i />
              {[0, 1, 2].map((i) => <Mini key={i} id={draft.picksBlue[i] ?? undefined} />)}
            </div>
            <div className="qv-side red">
              {[0, 1, 2].map((i) => <Mini key={i} id={draft.picksRed[i] ?? undefined} />)}
              <i />
              {Array.from({ length: format.bansPerTeam }, (_, i) => <Mini key={`r${i}`} id={draft.bansRed[i]} ban />)}
            </div>
          </div>
      </>}
      </div>

      {step === 'map' ? <div className="qv-list"><QuickMaps /></div> : step !== 'done' && (
            <div className="qv-list">
              <div className="qv-searchrow">
                <input className="qv-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`🔍 Buscar · toca = ${a.action === 'pickRed' ? 'pick rival' : a.action === 'pickBlue' ? 'nuestro pick' : banTeam === 'red' ? 'ban rival' : 'nuestro ban'}`} aria-label="Buscar brawler" />
                {voice.supported && (
                  <button className={`qv-mic ${voice.listening ? 'on' : ''}`} aria-label={voice.listening ? 'Escuchando: suelta para terminar' : 'Mantén pulsado y di el brawler'}
                    onPointerDown={voice.down} onPointerUp={voice.up} onPointerCancel={voice.up} onContextMenu={(e) => e.preventDefault()}>🎤</button>
                )}
              </div>
              {voice.line && <div className={`qv-voice ${voice.line.ok === false ? 'err' : voice.line.ok ? 'ok' : ''}`} aria-live="polite">{voice.line.text}</div>}
              <div className="qv-pool">
                {pool.map((b) => <PoolBtn key={b.id} b={b} onTap={tap} />)}
                {pool.length === 0 && <p className="qv-empty">Ninguno coincide.</p>}
              </div>
            </div>
      )}
    </div>
  );
}

function PoolBtn({ b, onTap }: { b: Brawler; onTap: (id: string) => void }) {
  const a = useApp();
  const out = a.unavailable(b.id);
  const rec = !out ? a.recs.find((r) => r.brawlerId === b.id) : undefined;
  return (
    <button className={`qv-b ${out ? 'out' : ''}`} disabled={out} onClick={() => onTap(b.id)} aria-label={b.name}>
      <span className="qv-b-img"><BrawlerImg b={b} size="w-full h-full" />{rec && <span className={`qv-score ${scoreClass(rec.score)}`}>{rec.score}</span>}</span>
      <span className="qv-b-name">{b.name}</span>
    </button>
  );
}

function Strip({ label, items, cls, onTap, disabled }: { label: string; items: { id: string; score: number }[]; cls: string; onTap: (id: string) => void; disabled?: (id: string) => boolean }) {
  const list = items.filter((x) => !disabled?.(x.id));
  return (
    <div className={`qv-strip ${cls}`}>
      <span className="qv-strip-label">{label}</span>
      {list.map((x, i) => {
        const b = brawlerById(x.id);
        if (!b) return null;
        return (
          <button key={x.id} className={`qv-sug ${i === 0 ? 'best' : ''}`} onClick={() => onTap(x.id)} aria-label={`${b.name}, ${x.score}`}>
            <span className="qv-b-img"><BrawlerImg b={b} size="w-full h-full" /><span className={`qv-score ${scoreClass(x.score)}`}>{x.score}</span></span>
            <span className="qv-b-name">{b.name}</span>
          </button>
        );
      })}
    </div>
  );
}

function QuickResult({ onFull }: { onFull: () => void }) {
  const a = useApp();
  const vd = a.vd;
  return (
    <div className="qv-result">
      {vd && (
        <div className="qv-win">
          <span className="dd-c-blue">{vd.winChance}%</span>
          <div className="dd-win-bar"><div style={{ width: `${vd.winChance}%` }} /></div>
          <span className="dd-c-red">{100 - vd.winChance}%</span>
        </div>
      )}
      {vd && <p className="qv-tip">💡 {vd.tip}</p>}
      <div className="qv-row">
        {!a.gameRecorded && !a.seriesOver && <>
          <button className="qv-pill green on" onClick={() => a.recordResult('win')}>🏆 Ganamos</button>
          <button className="qv-pill red on" onClick={() => a.recordResult('loss')}>💀 Perdimos</button>
        </>}
        {a.gameRecorded && !a.seriesOver && <button className="qv-pill blue on" onClick={a.nextGame}>▶ Siguiente</button>}
        {a.seriesOver && <button className="qv-pill green on" onClick={a.newSeries}>🏁 Nueva serie</button>}
        <button className="qv-pill" onClick={onFull}>Ver detalles</button>
      </div>
    </div>
  );
}

function QuickMaps() {
  const a = useApp();
  const [q, setQ] = useState('');
  const maps = useMemo(() => {
    const rot = MAPS.filter((m) => REAL_META.maps[m.id]);
    const t = norm(q.trim());
    return (rot.length ? rot : MAPS).filter((m) => !t || [m.name, m.en ?? '', m.mode].some((x) => norm(x).includes(t)))
      .sort((x, y) => x.mode.localeCompare(y.mode) || x.name.localeCompare(y.name));
  }, [q]);
  return (
    <>
      <input className="qv-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Buscar mapa o modo" aria-label="Buscar mapa" />
      <div className="qv-maps">
        {maps.map((m) => (
          <button key={m.id} className={`qv-mapcard ${m.id === a.mapId ? 'sel' : ''}`} style={{ '--mode': modeInfo(m.mode).color } as React.CSSProperties} onClick={() => a.confirmMap(m.id)} aria-label={`${m.name}, ${m.mode}`}>
            {m.photo ? <MapImg src={m.photo} name={m.name} cls="qv-mapcard-img" /> : <span className="qv-mapcard-img" />}
            <ModeIcon mode={m.mode} size={16} cls="qv-mapcard-mode" />
            <span>{m.name}</span>
          </button>
        ))}
      </div>
    </>
  );
}

// Voz en la vista rápida: mantén pulsado 🎤, di uno o varios brawlers («Colt, Piper y Bull», «rival Mortis») y suelta.
// Cada nombre se aplica al paso que toca, uno detrás de otro, con vibración de confirmación.
type VoiceItem = { id: string; team: Team | null };
function useQuickVoice() {
  const a = useApp();
  const [queue, setQueue] = useState<VoiceItem[]>([]);
  const [line, setLine] = useState<{ text: string; ok: boolean | null } | null>(null);
  const results = useRef<string[]>([]);
  const failed = useRef(false);
  const pressAt = useRef(0);
  const hideT = useRef<number | undefined>(undefined);

  const show = (text: string, ok: boolean | null, hide = true) => {
    setLine({ text, ok });
    window.clearTimeout(hideT.current);
    if (hide) hideT.current = window.setTimeout(() => setLine(null), 4000);
  };
  const buzz = (ok: boolean) => { try { navigator.vibrate?.(ok ? 35 : [70, 50, 70]); } catch { /* sin vibración */ } };

  function onFinal(alts: string[]) {
    // Solo se buscan brawlers que aún se pueden elegir: menos candidatos = menos confusiones
    const roster = a.ALL.filter((b) => !a.picked.includes(b.id) && (a.banPhase || !a.banned.includes(b.id))).map((b) => ({ id: b.id, name: b.name }));
    const lists = alts.map((t) => parseVoiceList(t, roster));
    const cmds: VoiceCommand[] = lists.find((l) => l.some((c) => c.type === 'apply')) ?? lists[0] ?? [];
    const heard = alts[0] ?? '';
    if (cmds.some((c) => c.type === 'undo')) { a.doUndo(); buzz(true); show(`«${heard}» → ↩ deshecho`, true); return; }
    if (cmds.some((c) => c.type === 'redo')) { a.doRedo(); buzz(true); show(`«${heard}» → ↪ rehecho`, true); return; }
    const items = cmds.flatMap((c) => (c.type === 'apply' ? [{ id: c.brawlerId, team: c.team }] : []));
    if (items.length === 0) {
      if (cmds.some((c) => c.type === 'suggest')) { a.applySuggestion(); buzz(true); show(`«${heard}» → sugerido`, true); return; }
      buzz(false); show(`«${heard}»: no reconozco ningún brawler`, false); return;
    }
    results.current = []; failed.current = false;
    setQueue(items);
  }
  const sp = useSpeech(onFinal);

  // Se aplica un nombre por render: cada paso parte del draft ya actualizado por el anterior
  useEffect(() => {
    if (queue.length === 0) return;
    const [c, ...rest] = queue;
    const banStep = a.exp.kind === 'ban';
    const ok = c.team
      ? (a.exp.kind === 'globalban' ? a.doGlobalBan(c.team, c.id) : banStep ? a.doBan(c.team, c.id) : a.doPick(c.team, c.id))
      : !!a.applyAction(c.id);
    results.current.push(`${ok ? '✓' : '✗'} ${brawlerById(c.id)?.name ?? c.id}`);
    if (!ok) failed.current = true;
    if (rest.length === 0) { buzz(!failed.current); show(results.current.join(' · '), !failed.current); }
    setQueue(rest);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue]);

  useEffect(() => {
    if (sp.listening) show(sp.interim ? `«${sp.interim}»` : '🎙️ Escuchando… di el brawler y suelta', null, false);
    else if (sp.error) show(sp.error, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp.listening, sp.interim, sp.error]);

  return {
    supported: sp.supported,
    listening: sp.listening,
    line,
    // Pulsar = empieza a escuchar. Soltar tras mantener = termina y aplica. Un toque corto escucha hasta que te callas.
    down: (e: React.PointerEvent) => { e.preventDefault(); pressAt.current = Date.now(); if (!sp.listening) sp.start(); else sp.stop(); },
    up: () => { if (Date.now() - pressAt.current > 400) sp.finish(); }
  };
}
