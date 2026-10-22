import { useEffect, useMemo, useState } from 'react';
import { MAPS, POOL_INFO } from './data/maps';
import { FORMATS } from './data/meta';
import { scoreAll, suggestBans, DEFAULT_WEIGHTS, matchupScore, countersVs, threatsTo, verdict, metaLabel, metaOf, getAllBrawlers, brawlerById, DATA_SOURCE } from './engine/scoring';
import { initialDraft, expectedAction, applyPick, applyBan, applyGlobalBan, flipCoin, undo, redo, getFormat, bansComplete, pickOrderIssues, SLOT_LABELS, ourPickJob } from './engine/draftMachine';
import { store } from './engine/storage';
import type { Brawler, DraftState, GameMode, Ownership, Role, Team, Weights } from './types';

const MODES: GameMode[] = ['Atrapagemas', 'Balón Brawl', 'Recompensa', 'Noqueo', 'Atraco', 'Zona Restringida'];
const ROLES: Role[] = ['Control', 'Daño', 'Apoyo', 'Tanque', 'Asesino', 'Francotirador', 'Artillería'];
const RARITIES = ['Todas', 'Inicial', 'Especial', 'Superespecial', 'Épica', 'Mítica', 'Legendaria', 'Ultralegendaria'];
const DEFAULT_MODE: GameMode = 'Balón Brawl';
const DEFAULT_MAP = 'bb-triple-dribble';

function validFormat(id: string) { return FORMATS.some((f) => f.id === id) ? id : 'live'; }
function validMap(id: string) { return MAPS.some((m) => m.id === id) ? id : DEFAULT_MAP; }

function Bar({ v, c }: { v: number; c: string }) {
  return <div className="h-1.5 rounded bg-gray-800 overflow-hidden"><div className="h-full rounded" style={{ width: `${v}%`, background: c }} /></div>;
}

function BrawlerImg({ b, size }: { b: Brawler; size: string }) {
  const [err, setErr] = useState(false);
  if (!b.image || err) return <span className={size}>{b.emoji}</span>;
  return <img src={b.image} alt={b.name} loading="lazy" onError={() => setErr(true)} className={`${size} object-contain mx-auto`} draggable={false} />;
}

function MapImg({ src, name, cls }: { src?: string; name: string; cls: string }) {
  const [err, setErr] = useState(false);
  if (!src || err) return null;
  return <img src={src} alt={name} loading="lazy" onError={() => setErr(true)} className={cls} draggable={false} />;
}

export default function App() {
  const ALL = useMemo(() => getAllBrawlers(), []);
  const [mode, setMode] = useState<GameMode>(() => store.load('mode', DEFAULT_MODE));
  const [mapId, setMapId] = useState(() => validMap(store.load('mapId', DEFAULT_MAP)));
  const [formatId, setFormatId] = useState(() => validFormat(store.load('formatId', 'live')));
  const [mapQuery, setMapQuery] = useState('');
  const [draft, setDraft] = useState(() => initialDraft(store.load('mode', DEFAULT_MODE), validMap(store.load('mapId', DEFAULT_MAP)), validFormat(store.load('formatId', 'live'))));
  const [weights, setWeights] = useState<Weights>(() => store.load('weights', DEFAULT_WEIGHTS));
  const [query, setQuery] = useState('');
  const [roleF, setRoleF] = useState<Role | 'Todos'>('Todos');
  const [rarityF, setRarityF] = useState('Todas');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [banCount, setBanCount] = useState(3);
  const [compare, setCompare] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[][]>(() => store.load('favorites', []));
  const [history, setHistory] = useState<string[]>(() => store.load('history', []));
  const [msg, setMsg] = useState('');
  const [flipping, setFlipping] = useState(false);
  const [coinFace, setCoinFace] = useState<'blue' | 'red'>('blue');
  const [blindHide, setBlindHide] = useState(() => store.load('blindHide', true));
  const [mySlot, setMySlot] = useState<number | null>(() => store.load('mySlot', null));
  const [ownership, setOwnership] = useState<Record<string, Ownership>>(() => store.load('ownership', {}));
  type Action = 'pickBlue' | 'pickRed' | 'banBlue' | 'banRed' | 'globalBlue' | 'globalRed';
  const [action, setAction] = useState<Action>(() => store.load('action', 'banBlue'));
  const [showCollection, setShowCollection] = useState(false);
  const [collQuery, setCollQuery] = useState('');

  useEffect(() => { store.save('mode', mode); store.save('mapId', mapId); store.save('formatId', formatId); store.save('weights', weights); store.save('blindHide', blindHide); store.save('ownership', ownership); store.save('mySlot', mySlot); store.save('action', action); }, [mode, mapId, formatId, weights, blindHide, ownership, mySlot, action]);
  useEffect(() => { store.save('favorites', favorites); store.save('history', history); }, [favorites, history]);

  const mapsForMode = useMemo(() => MAPS.filter((m) => m.mode === mode && m.name.toLowerCase().includes(mapQuery.toLowerCase())), [mode, mapQuery]);
  const map = MAPS.find((m) => m.id === mapId) ?? MAPS.find((m) => m.mode === mode) ?? MAPS[0];
  const format = getFormat(formatId);
  const exp = expectedAction(draft);
  const globalBanned = [...draft.globalBansBlue, ...draft.globalBansRed];
  const banned = [...globalBanned, ...draft.bansBlue, ...draft.bansRed];
  const picked = [...draft.picksBlue, ...draft.picksRed].filter(Boolean) as string[];
  const allies = draft.picksBlue.filter(Boolean) as string[];
  const enemies = draft.picksRed.filter(Boolean) as string[];
  // Fase 1: baneos (3 por equipo) — Fase 2: picks. En vivo es sugerencia visual, no bloqueo.
  const setBansDone = draft.bansBlue.length + draft.bansRed.length;
  const setBansTotal = format.bansPerTeam * 2;
  const banPhase = format.bansPerTeam > 0 && setBansDone < setBansTotal;
  // Picks bloqueados mientras se banea (salvo modo manual externo)
  const picksLocked = !bansComplete(draft) && !draft.freeMode;

  const recs = useMemo(() => scoreAll({ mapId: map.id, allies, enemies, weights, banned, picked, ownership }), [map.id, allies, enemies, weights, banned, picked, ownership]);
  const threats = useMemo(() => threatsTo(allies, enemies), [allies, enemies]);
  const vd = useMemo(() => (draft.phase === 'done' ? verdict(map.id, allies, enemies) : null), [draft.phase, map.id, allies, enemies]);
  const done = draft.phase === 'done';
  const bans = useMemo(() => suggestBans(map.id, banCount, banned), [map.id, banCount, banned]);
  const avoid = useMemo(() => [...recs].slice(-3).reverse(), [recs]);

  useEffect(() => {
    if (draft.phase === 'done' && picked.length === 6) {
      const summary = `${new Date().toLocaleString()} | ${map.name} | AZUL: ${allies.map((a) => brawlerById(a)?.name).join(',')} vs ROJO: ${enemies.map((a) => brawlerById(a)?.name).join(',')}`;
      setHistory((h) => (h.includes(summary) ? h : [summary, ...h].slice(0, 20)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.phase]);

  function changeMode(m: GameMode) {
    setMode(m); setMapQuery('');
    const first = MAPS.find((x) => x.mode === m)!;
    setMapId(first.id);
    setDraft((d) => ({ ...d, mode: m, mapId: first.id }));
  }
  function changeMap(id: string) {
    setMapId(id);
    const mm = MAPS.find((x) => x.id === id)!;
    setMode(mm.mode);
    setDraft((d) => ({ ...d, mapId: id, mode: mm.mode }));
  }
  function changeFormat(id: string) {
    setFormatId(id);
    setDraft((d) => ({ ...d, formatId: id, strict: !getFormat(id).freeOrder }));
    setAction('banBlue');
  }
  function actionFor(d: DraftState): Action {
    const e = expectedAction(d);
    if (e.kind === 'globalban') return e.team === 'blue' ? 'globalBlue' : 'globalRed';
    if (e.kind === 'ban') return e.team === 'blue' ? 'banBlue' : 'banRed';
    if (e.kind === 'pick') return e.team === 'blue' ? 'pickBlue' : 'pickRed';
    return action;
  }
  function doPick(team: 'blue' | 'red', pre?: string, slot?: number): boolean {
    const id = pre;
    if (!id) { setMsg('Toca un brawler para aplicarlo.'); return false; }
    const r = applyPick(draft, team, id, slot);
    if ('error' in r) { setMsg(r.error); return false; }
    setDraft(r); setAction(actionFor(r));
    const st = ownership[id] ?? 'ok';
    setMsg(team === 'blue' && st !== 'ok' ? `Ojo: ${brawlerById(id)?.name} lo tienes ${st === 'no' ? 'SIN TENER' : 'A BAJO NIVEL'}: rinde menos. Mira las alternativas.` : '');
    return true;
  }
  const cycleOwnership = (id: string) => setOwnership((o) => {
    const cur = o[id] ?? 'ok';
    const next = cur === 'ok' ? 'low' : cur === 'low' ? 'no' : 'ok';
    const n = { ...o };
    if (next === 'ok') delete n[id]; else n[id] = next;
    return n;
  });
  const ownCount = (s: Ownership) => Object.values(ownership).filter((v) => v === s).length;
  const setOwn = (id: string, st: Ownership) => setOwnership((o) => { const n = { ...o }; if (st === 'ok') delete n[id]; else n[id] = st; return n; });
  function doBan(team: 'blue' | 'red', pre?: string): boolean {
    const id = pre;
    if (!id) { setMsg('Toca un brawler para banearlo.'); return false; }
    const r = applyBan(draft, team, id);
    if ('error' in r) { setMsg(r.error); return false; }
    setDraft(r); setAction(actionFor(r)); setMsg('');
    return true;
  }
  function doGlobalBan(team: 'blue' | 'red', pre?: string): boolean {
    const id = pre;
    if (!id) { setMsg('Toca un brawler para el ban global.'); return false; }
    const r = applyGlobalBan(draft, team, id);
    if ('error' in r) { setMsg(r.error); return false; }
    setDraft(r); setAction(actionFor(r)); setMsg('');
    return true;
  }
  // 👆 Un toque: aplica la acción actual al brawler y avanza sola al siguiente paso
  function applyAction(id: string) {
    if (action === 'pickBlue') doPick('blue', id);
    else if (action === 'pickRed') doPick('red', id);
    else if (action === 'banBlue') doBan('blue', id);
    else if (action === 'banRed') doBan('red', id);
    else if (action === 'globalBlue') doGlobalBan('blue', id);
    else doGlobalBan('red', id);
  }
  function runCoinFlip() {
    if (flipping) return;
    setFlipping(true);
    const t0 = Date.now();
    const iv = setInterval(() => {
      setCoinFace((c) => (c === 'blue' ? 'red' : 'blue'));
      if (Date.now() - t0 > 1100) {
        clearInterval(iv);
        const winner: Team = Math.random() < 0.5 ? 'blue' : 'red';
        setDraft((d) => flipCoin(d, winner));
        setFlipping(false);
        setMsg('');
      }
    }, 120);
  }
  function reset() {
    setDraft(initialDraft(mode, mapId, formatId));
    setAction('banBlue'); setMsg('');
  }
  function exportSummary() {
    const txt = `BRAWL DRAFT PRO (catálogo BrawlAPI/Brawlify, ratings de estimación)\nFormato: ${format.name}\nMapa: ${map.name} (${map.mode})\nAzul (FP→LAST): ${draft.picksBlue.map((a) => brawlerById(a)?.name ?? '—').join(' → ')}\nRojo (FP→LAST): ${[...draft.picksRed].reverse().map((a) => brawlerById(a)?.name ?? '—').join(' → ')}\nBans azul: ${draft.bansBlue.map((b) => brawlerById(b)?.name).join(', ') || '-'}\nBans rojo: ${draft.bansRed.map((b) => brawlerById(b)?.name).join(', ') || '-'}\nMi mejor pick: ${brawlerById(recs[0]?.brawlerId)?.name} (${recs[0]?.score}) — ${recs[0]?.explanation}`;
    navigator.clipboard?.writeText(txt).then(() => setMsg('Resumen copiado al portapapeles.')).catch(() => setMsg(txt));
  }

  const grid = ALL.filter((b) =>
    b.name.toLowerCase().includes(query.toLowerCase()) &&
    (roleF === 'Todos' || b.roles.includes(roleF)) &&
    (rarityF === 'Todas' || b.rarity === rarityF)
  );

  const teamName = (t: Team) => (t === 'blue' ? 'azul 🔵' : 'rojo 🔴');
  const baseTurn = exp.kind === 'done' ? '✅ Draft completo'
    : exp.kind === 'coin' ? '🪙 Sorteo inicial: lanza la moneda'
    : exp.kind === 'globalban' ? `🌍 Baneo GLOBAL: ${teamName(exp.team)}`
    : exp.kind === 'ban' ? `🚫 Banea (set${format.blindBans ? ', ciego' : ''}): ${teamName(exp.team)}`
    : `👉 Elige: ${teamName(exp.team)}`;
  const turnText = exp.kind === 'done' ? '✅ Draft completo'
    : banPhase && exp.kind !== 'coin' ? `🚫 1º Baneos (${setBansDone}/${setBansTotal}) — completa las casillas 🚫 · luego 2º picks`
    : `${baseTurn.replace(/^👉 /, '👉 2º ')}`;
  const centerBadge = exp.kind === 'done' ? '✅ Draft completo'
    : banPhase && exp.kind !== 'coin' && exp.kind !== 'globalban' ? `🚫 1º Banea: ${exp.team === 'blue' ? 'AZUL' : 'ROJO'} (${setBansDone}/${setBansTotal})`
    : exp.kind === 'coin' ? '🪙 Sorteo'
    : exp.kind === 'globalban' ? `🌍 Global: ${exp.team === 'blue' ? 'AZUL' : 'ROJO'}`
    : exp.kind === 'ban' ? `🚫 Banea: ${exp.team === 'blue' ? 'AZUL' : 'ROJO'}`
    : `👉 Elige: ${exp.team === 'blue' ? 'AZUL' : 'ROJO'}`;

  const maskRival = format.blindBans && blindHide;

  const renderTeam = (team: 'blue' | 'red') => {
    const picks = team === 'blue' ? draft.picksBlue : draft.picksRed;
    const teamBans = team === 'blue' ? draft.bansBlue : draft.bansRed;
    const teamGlobal = team === 'blue' ? draft.globalBansBlue : draft.globalBansRed;
    const isTurn = exp.kind !== 'done' && exp.kind !== 'coin' && exp.team === team;
    const hidden = maskRival && team === 'red';
    return (
      <div className={`rounded-xl p-2 border-2 ${team === 'blue' ? 'border-blue-600/70 bg-blue-950/30' : 'border-red-600/70 bg-red-950/30'} ${isTurn ? (team === 'blue' ? 'ring-2 ring-blue-400' : 'ring-2 ring-red-400') : ''}`}>
        <div className="text-xs font-black mb-2" style={{ color: team === 'blue' ? '#60a5fa' : '#f87171' }}>
          {team === 'blue' ? '🔵 EQUIPO AZUL (nosotros)' : '🔴 EQUIPO ROJO (ellos)'}
        </div>
        {format.globalBansPerTeam > 0 && (
          <div className="mb-2">
            <div className="text-[11px] font-bold text-gray-400 mb-1">🌍 GLOBALES ({teamGlobal.length}/{format.globalBansPerTeam})</div>
            <div className="flex gap-1.5">
              {Array.from({ length: format.globalBansPerTeam }).map((_, i) => {
                const b = brawlerById(teamGlobal[i] ?? null);
                return (
                  <button key={i} onClick={() => { if (!b) setAction(team === 'blue' ? 'globalBlue' : 'globalRed'); }}
                    className={`w-12 h-14 rounded-lg border flex flex-col items-center justify-center overflow-hidden ${b ? 'border-purple-500 bg-purple-950/50' : 'border-dashed border-gray-600 hover:border-purple-400'}`}
                    title={b ? `Ban global: ${hidden ? '???' : b.name}` : 'Hueco de ban global — tócalo para banear aquí'}>
                    {b ? (hidden ? <span className="text-lg">❓</span> : <><div className="grayscale opacity-80"><BrawlerImg b={b} size="text-xl w-9 h-9" /></div><span className="text-[9px] font-bold leading-tight">{b.name}</span></>)
                      : <span className="text-gray-600 text-lg">🌍</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className={`grid grid-cols-3 gap-2 rounded-lg p-1 ${!banPhase && exp.kind !== 'done' ? 'ring-2 ring-blue-400/60 bg-blue-950/10' : ''}`}>
          {picks.map((pid, i) => {
            const b = brawlerById(pid);
            return (
              <button key={i} onClick={() => {
                if (b) { if (draft.freeMode || !draft.strict) { setDraft((d) => { const n = structuredClone(d); (team === 'blue' ? n.picksBlue : n.picksRed)[i] = null; return n; }); } }
                else setAction(team === 'blue' ? 'pickBlue' : 'pickRed');
              }}
                className="aspect-[3/4] rounded-lg border border-gray-700 bg-gray-900 flex flex-col items-center justify-center p-1 hover:border-white/50 overflow-hidden" title={b ? `${b.name} (${SLOT_LABELS[team][i]}, clic para quitar en modo libre)` : picksLocked ? `🔒 Bloqueado: termina primero los baneos` : `Hueco ${SLOT_LABELS[team][i]} — tócalo para dirigir aquí la próxima acción`}>
                <span className={`text-[9px] font-black ${b ? 'text-gray-300' : 'text-gray-500'}`}>{SLOT_LABELS[team][i]}</span>
                {team === 'blue' && mySlot === i && <span className="text-[9px] font-black text-yellow-300">🧍 TÚ</span>}
                {b ? <><BrawlerImg b={b} size="text-3xl w-12 h-12" /><span className="text-xs font-bold leading-tight">{b.name}</span><span className="text-[10px] text-gray-400">{b.rarity}</span></>
                  : picksLocked ? <span className="text-gray-600 text-2xl" title="Bloqueado hasta terminar baneos">🔒</span> : <span className="text-gray-500 text-2xl font-bold">+</span>}
              </button>
            );
          })}
        </div>
        <div className="text-[10px] text-gray-500 mt-1">{team === 'blue' ? '→ orden de pick: izq FP → der LAST' : '← orden de pick: der FP → izq LAST'}</div>
        <div className={`mt-2 rounded-lg p-1 ${banPhase ? 'ring-2 ring-red-400/70 bg-red-950/20' : ''}`}>
          <div className={`text-[11px] font-bold mb-1 ${banPhase ? 'text-red-300' : 'text-gray-400'}`}>🚫 BANEOS {team === 'blue' ? 'AZULES' : 'ROJOS'} ({teamBans.length}/{format.bansPerTeam}){format.blindBans ? ' · ciegos' : ''}{banPhase ? ' — ¡toca un hueco! 👇' : ' ✓'}</div>
          <div className="flex gap-1.5 flex-wrap">
            {Array.from({ length: format.bansPerTeam }).map((_, i) => {
              const b = brawlerById(teamBans[i] ?? null);
              return (
                <button key={i} onClick={() => { if (!b) setAction(team === 'blue' ? 'banBlue' : 'banRed'); }}
                  className={`w-14 h-[4.5rem] rounded-lg border-2 flex flex-col items-center justify-center overflow-hidden ${b ? 'border-red-500 bg-red-950/50' : banPhase ? 'border-dashed border-red-400 animate-pulse hover:border-red-300' : 'border-dashed border-gray-600 hover:border-red-400'}`}
                  title={b ? `Baneado: ${hidden ? '???' : b.name}` : 'Hueco de baneo — tócalo para banear aquí'}>
                  {b ? (hidden ? <span className="text-lg">❓</span> : <><div className="grayscale opacity-90"><BrawlerImg b={b} size="text-xl w-10 h-10" /></div><span className="text-[10px] font-bold leading-tight px-0.5">{b.name}</span><span className="text-[9px] text-gray-500">J{i + 1}</span></>)
                    : <><span className="text-red-400/80 text-xl font-black">🚫</span><span className="text-[9px] text-gray-500">J{i + 1}</span></>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-arena">
      <header className="border-b border-gray-800 bg-panel/80 sticky top-0 z-10">
        <div className="max-w-[1500px] mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="text-2xl">🏆</div>
          <div>
            <h1 className="font-black text-lg leading-none">BRAWL DRAFT PRO</h1>
            <p className="text-[11px] text-amber-300/90">Partida en vivo · Pool BSC Summer 2026 (18 mapas) · Catálogo e imágenes: {DATA_SOURCE} · Ratings: estimación propia.</p>
          </div>
          <div className="ml-auto flex flex-wrap gap-2 text-xs">
            {format.blindBans && <label className="flex items-center gap-1 bg-gray-800 rounded px-2 py-1"><input type="checkbox" checked={blindHide} onChange={(e) => setBlindHide(e.target.checked)} /> Ocultar bans rivales</label>}
            <button className="bg-gray-800 rounded px-2 py-1" onClick={() => setShowCollection(true)}>🎒 Colección{ownCount('no') + ownCount('low') > 0 ? ` (${ownCount('no') + ownCount('low')})` : ''}</button>
            <button className="bg-gray-800 rounded px-2 py-1" onClick={() => setDraft(undo(draft))}>↩ Deshacer</button>
            <button className="bg-gray-800 rounded px-2 py-1" onClick={() => setDraft(redo(draft))}>↪ Rehacer</button>
            <button className="bg-gray-800 rounded px-2 py-1" onClick={reset}>⟲ Reiniciar</button>
            <button className="bg-blue-600 rounded px-2 py-1 font-bold" onClick={exportSummary}>⧉ Exportar</button>
          </div>
        </div>
        <div className={`max-w-[1500px] mx-auto px-4 pb-2 text-sm font-bold ${exp.kind === 'done' ? 'text-green-300' : exp.kind === 'coin' ? 'text-yellow-300' : exp.team === 'blue' ? 'text-blue-300' : 'text-red-300'}`}>{turnText}</div>
        {msg && <div className="max-w-[1500px] mx-auto px-4 pb-2 text-xs text-red-300">{msg}</div>}
      </header>

      <main className="max-w-[1500px] mx-auto px-4 py-4 grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)_360px]">
        <section className="space-y-3">
          <div className="bg-panel rounded-xl p-3 border border-gray-800">
            <h2 className="text-xs font-bold text-gray-400 uppercase mb-2">Mapa competitivo</h2>
            <p className="text-[11px] text-green-400 mb-2">🔴 {POOL_INFO}</p>
            <label className="text-xs text-gray-400">Modo de juego</label>
            <div className="flex flex-wrap gap-1 my-1">
              {MODES.map((m) => <button key={m} onClick={() => changeMode(m)} className={`text-xs px-2 py-1 rounded ${mode === m ? 'bg-blue-600 font-bold' : 'bg-gray-800'}`}>{m}</button>)}
            </div>
            <label className="text-xs text-gray-400">Mapa ({mapsForMode.length})</label>
            <input value={mapQuery} onChange={(e) => setMapQuery(e.target.value)} placeholder="🔍 Filtrar mapa…" className="w-full mt-1 mb-1 text-sm bg-gray-800 rounded px-2 py-1" />
            <div className="grid gap-1">
              {mapsForMode.map((m) => (
                <button key={m.id} onClick={() => changeMap(m.id)} className={`text-left text-sm px-2 py-1.5 rounded flex items-center gap-2 ${mapId === m.id ? 'bg-blue-600/30 border border-blue-500' : 'bg-gray-800/60'}`}>
                  {m.photo ? <MapImg src={m.photo} name={m.name} cls="w-12 h-8 object-cover rounded" /> : <span className="text-xl">{m.image}</span>}
                  <span className="font-bold">{m.name}</span>
                </button>
              ))}
            </div>
            <div className="mt-2 text-xs bg-gray-900 rounded p-2">
              {map.photo && <MapImg src={map.photo} name={map.name} cls="w-full h-28 object-cover rounded mb-2" />}
              <div className="font-bold">{map.image} {map.name} <span className="text-gray-400">· {map.mode} · alcance {map.rangeBias}</span></div>
              <p className="text-gray-300 mt-1">{map.description}</p>
              <div className="mt-2 space-y-1">
                <div>Muros <Bar v={map.walls * 20} c="#60a5fa" /></div>
                <div>Arbustos <Bar v={map.bushes * 20} c="#4ade80" /></div>
                <div>Apertura <Bar v={map.openness * 20} c="#fbbf24" /></div>
                <div>Zonas control <Bar v={map.controlZones * 20} c="#f472b6" /></div>
              </div>
            </div>
            <label className="text-xs text-gray-400 mt-2 block">Formato</label>
            <select value={formatId} onChange={(e) => changeFormat(e.target.value)} className="w-full text-sm bg-gray-800 rounded px-2 py-1 mt-1">
              {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.name} — {f.description}</option>)}
            </select>
          </div>

          <div className="bg-panel rounded-xl p-3 border border-gray-800">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xs font-bold text-gray-400 uppercase">Baneos sugeridos</h2>
              <select value={banCount} onChange={(e) => setBanCount(Number(e.target.value))} className="ml-auto text-xs bg-gray-800 rounded px-1 py-0.5">
                {[3, 4, 5].map((n) => <option key={n} value={n}>Top {n}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              {bans.map((b, i) => {
                const bb = brawlerById(b.brawlerId);
                return (
                  <button key={b.brawlerId} onClick={() => { const e = expectedAction(draft); if (e.kind === 'ban') doBan(e.team, b.brawlerId); else if (e.kind === 'globalban') doGlobalBan(e.team, b.brawlerId); else doBan(draft.bansBlue.length <= draft.bansRed.length ? 'blue' : 'red', b.brawlerId); }} title="Tocar = banearlo al instante" className="w-full text-left text-xs bg-gray-900 rounded p-2 border border-gray-800 hover:border-red-500 flex gap-2 items-center">
                    {bb && <BrawlerImg b={bb} size="text-xl w-10 h-10" />}
                    <span><span className="font-bold text-red-300">#{i + 1} {bb?.name}</span> <span className="text-gray-400">({b.score})</span>
                      <div className="text-gray-300 mt-0.5">{b.reason}</div></span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-panel rounded-xl p-3 border border-gray-800">
            <h2 className="text-xs font-bold text-gray-400 uppercase mb-1">Ponderación (ajustable)</h2>
            {(Object.keys(weights) as (keyof Weights)[]).map((k) => (
              <label key={k} className="flex items-center gap-2 text-xs py-0.5">
                <span className="w-24 text-gray-300">{k}</span>
                <input type="range" min={0} max={0.6} step={0.05} value={weights[k]} onChange={(e) => setWeights({ ...weights, [k]: Number(e.target.value) })} className="flex-1" />
                <span className="w-10 text-right">{Math.round(weights[k] * 100)}%</span>
              </label>
            ))}
            <p className="text-[11px] text-gray-500 mt-1">Pesos de demostración, no oficiales. Normalizado 0–100.</p>
          </div>
        </section>

        <section className="space-y-3">
          <div className="bg-panel rounded-xl p-3 border border-gray-800">
            <div className="bg-blue-950/40 border border-blue-700/50 rounded-lg p-2 mb-2 text-xs text-blue-100">
              {banPhase ? <>🚫 <b>1º registra los {format.bansPerTeam} bans por equipo (1 por jugador)</b> tocando los huecos 🚫 de cada equipo. <b>Los picks están bloqueados 🔒</b> hasta terminar.</>
                : <>🎮 <b>2º marca los picks:</b> toca los picks de ELLOS (rojo) y los vuestros (azul). A la derecha te digo <b>qué pickear</b> al instante.</>}
              {format.freeOrder && <span className="ml-2 text-gray-300">¿Quién pickea primero? <button className={`rounded px-1.5 py-0.5 ml-1 ${draft.coinWinner !== 'red' ? 'bg-blue-600 font-bold' : 'bg-gray-700'}`} onClick={() => setDraft((d) => ({ ...d, coinWinner: 'blue' }))}>Nosotros</button><button className={`rounded px-1.5 py-0.5 ml-1 ${draft.coinWinner === 'red' ? 'bg-red-600 font-bold' : 'bg-gray-700'}`} onClick={() => setDraft((d) => ({ ...d, coinWinner: 'red' }))}>Ellos</button></span>}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className={`px-2 py-1 rounded font-bold ${exp.kind === 'done' ? 'bg-green-700' : exp.kind === 'coin' ? 'bg-yellow-700' : exp.kind === 'globalban' ? 'bg-purple-700' : exp.kind === 'ban' ? 'bg-yellow-700' : 'bg-blue-700'}`}>
                {centerBadge}
              </span>
              <span className="text-gray-400 text-xs">Picks {picked.length}/6 (AZUL {allies.length} – ROJO {enemies.length}) · Bans {draft.bansBlue.length + draft.bansRed.length}/{format.bansPerTeam * 2}{format.globalBansPerTeam > 0 && ` · Globales ${globalBanned.length}/${format.globalBansPerTeam * 2}`}</span>
              <span className="text-gray-400 text-xs ml-auto">{map.name} · {mode}</span>
            </div>
            {(() => { const iss = pickOrderIssues(draft); return iss.length > 0 ? (
              <div className="mt-2 text-xs bg-red-950/50 border border-red-600 rounded-lg px-2 py-1.5 text-red-200">
                ⚠️ Orden de picks alterado (sorteo: {draft.coinWinner === 'red' ? 'empiezan ELLOS' : 'empezamos NOSOTROS'}): {iss.join(' ')} Toca el hueco correcto o usa deshacer.
              </div>) : null; })()}

            {format.coinFlip && (exp.kind === 'coin' || draft.coinWinner) && (
              <div className="mt-3 bg-gray-900 rounded-lg p-3 text-center border border-yellow-700/50">
                {!draft.coinWinner ? (
                  <>
                    <div className="text-4xl mb-1">{flipping ? (coinFace === 'blue' ? '🔵' : '🔴') : '🪙'}</div>
                    <p className="text-sm font-bold mb-2">{flipping ? 'Girando…' : 'Si sale azul, comenzamos pickeando nosotros; si sale roja, comienzan ellos.'}</p>
                    <div className="flex justify-center gap-2">
                      <button onClick={runCoinFlip} disabled={flipping} className="bg-yellow-600 rounded px-4 py-1.5 font-bold text-sm disabled:opacity-50">{flipping ? 'Girando…' : '🪙 Lanzar moneda'}</button>
                      <button onClick={() => setDraft((d) => flipCoin(d, 'blue'))} className="bg-blue-600 rounded px-2 py-1.5 text-xs">Empezamos nosotros</button>
                      <button onClick={() => setDraft((d) => flipCoin(d, 'red'))} className="bg-red-600 rounded px-2 py-1.5 text-xs">Empiezan ellos</button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm">🪙 Sorteo: <b className={draft.coinWinner === 'blue' ? 'text-blue-300' : 'text-red-300'}>{draft.coinWinner === 'blue' ? 'AZUL — comenzamos nosotros' : 'ROJO — comienzan ellos'}</b>
                    <button className="ml-2 text-xs bg-gray-700 rounded px-2 py-0.5" onClick={() => setDraft((d) => { const n = structuredClone(d); n.coinWinner = null; n.history = n.history.filter((h) => h.kind !== 'coin'); n.phase = 'coin'; return n; })}>Repetir sorteo</button></p>
                )}
              </div>
            )}

            {(() => {
              const job = ourPickJob(draft.picksBlue);
              const myTurn = !done && mySlot !== null && allies.length === mySlot;
              return (
                <div className={`mt-2 text-xs rounded-lg px-2 py-1.5 border ${myTurn ? 'bg-yellow-500/15 border-yellow-400' : 'bg-gray-900 border-gray-700'}`}>
                  {!done && job !== 'DONE' && (
                    <div>📌 Nuestro pick Nº {allies.length + 1} — {job === 'FP' ? <><b>🛡️ FIRST PICK:</b> asegura poder de mapa difícil de counterear (nada de especialistas).</> : job === 'MID' ? <><b>🧩 MID:</b> completa roles y sinergia con tu {allies.map((a) => brawlerById(a)?.name).join(' + ') || 'FP'}.</> : <><b>🎯 LAST PICK:</b> counter duro a lo suyo, es tu asiento de counter.</>}</div>
                  )}
                  <div className="mt-1 flex items-center gap-1 flex-wrap">
                    <span className="text-gray-300">¿Qué pick eres tú?</span>
                    {(['FP', 'MID', 'LAST'] as const).map((j, idx) => (
                      <button key={j} onClick={() => setMySlot(mySlot === idx ? null : idx)} className={`rounded px-1.5 py-0.5 font-bold ${mySlot === idx ? 'bg-yellow-500 text-black' : 'bg-gray-700'}`}>{j}</button>
                    ))}
                    {mySlot !== null && <span className="text-yellow-300 font-bold">🧍 Eres el {(['FP', 'MID', 'LAST'] as const)[mySlot]}{myTurn && recs[0] ? ` — ¡TE TOCA A TI! Elige ${brawlerById(recs[0].brawlerId)?.name} (${recs[0].score})` : myTurn ? ' — ¡TE TOCA A TI!' : ''}</span>}
                  </div>
                </div>
              );
            })()}
            <div className="grid md:grid-cols-2 gap-3 mt-3">
              {renderTeam('blue')}
              {renderTeam('red')}
            </div>            <div className="mt-3 bg-gray-900 rounded-lg p-2">
              <div className="text-[11px] text-gray-400 mb-1">👆 <b>Un toque:</b> toca un brawler y se aplica al instante en <b>{action === 'pickBlue' ? 'Pick Azul' : action === 'pickRed' ? 'Pick Rojo' : action === 'banBlue' ? 'Ban Azul' : action === 'banRed' ? 'Ban Rojo' : action === 'globalBlue' ? '🌍 Global Azul' : '🌍 Global Rojo'}</b> (avanza solo al siguiente paso).</div>
              <div className="flex flex-wrap gap-1">
                {(Object.entries({
                  pickBlue: `🎯 Pick Azul (${draft.picksBlue.filter(Boolean).length}/3)`,
                  pickRed: `🎯 Pick Rojo (${draft.picksRed.filter(Boolean).length}/3)`,
                  banBlue: `🚫 Ban Azul (${draft.bansBlue.length}/${format.bansPerTeam})`,
                  banRed: `🚫 Ban Rojo (${draft.bansRed.length}/${format.bansPerTeam})`
                }) as [Action, string][]).map(([a, label]) => (
                  <button key={a} onClick={() => setAction(a)} className={`text-xs rounded px-2 py-1 font-bold ${action === a ? (a.startsWith('pick') ? (a === 'pickBlue' ? 'bg-blue-500' : 'bg-red-500') : 'bg-yellow-600') : 'bg-gray-700 opacity-70'}`}>{label}</button>
                ))}
                {format.globalBansPerTeam > 0 && (['globalBlue', 'globalRed'] as Action[]).map((a) => (
                  <button key={a} onClick={() => setAction(a)} className={`text-xs rounded px-2 py-1 font-bold ${action === a ? 'bg-purple-500' : 'bg-gray-700 opacity-70'}`}>{a === 'globalBlue' ? '🌍 Global Azul' : '🌍 Global Rojo'}</button>
                ))}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="🔍 Buscar brawler…" className="bg-gray-800 rounded px-2 py-1 flex-1 min-w-[140px]" />
              <select value={roleF} onChange={(e) => setRoleF(e.target.value as Role | 'Todos')} className="bg-gray-800 rounded px-2 py-1">
                {['Todos', ...ROLES].map((r) => <option key={r}>{r}</option>)}
              </select>
              <select value={rarityF} onChange={(e) => setRarityF(e.target.value)} className="bg-gray-800 rounded px-2 py-1">
                {RARITIES.map((r) => <option key={r}>{r}</option>)}
              </select>
              <span className="text-gray-400 self-center">{grid.length}/{ALL.length} brawlers</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 mt-2 max-h-[420px] overflow-y-auto scroll-thin pr-1">
              {grid.map((b) => {
                const out = banned.includes(b.id) || picked.includes(b.id);
                const rec = recs.find((r) => r.brawlerId === b.id);
                return (
                  <button key={b.id} disabled={out} onClick={() => applyAction(b.id)}
                    className={`rounded-lg p-1.5 border text-center border-gray-700 bg-gray-900 ${out ? 'opacity-30' : 'hover:border-white/40 active:scale-95'}`} title={out ? (banned.includes(b.id) ? 'Baneado' : 'Elegido') : `Tocar = ${action === 'pickBlue' ? 'pick azul' : action === 'pickRed' ? 'pick rojo' : action === 'banBlue' ? 'ban azul' : action === 'banRed' ? 'ban rojo' : 'ban global'} instantáneo`}>
                    <BrawlerImg b={b} size="text-2xl w-12 h-12" />
                    {enemies.length > 0 && (
                      <div className="flex justify-center gap-1 h-4">
                        {countersVs(b.id, enemies).length > 0 && <span className="text-[10px] bg-green-700 rounded px-1 font-bold">🎯x{countersVs(b.id, enemies).length}</span>}
                        {enemies.some((e) => matchupScore(e, b.id).score >= 75) && <span className="text-[10px] bg-red-700 rounded px-1 font-bold">⚠️</span>}
                      </div>
                    )}
                    <div className="text-xs font-bold leading-tight flex items-center justify-center gap-1">{b.name}{!b.curated && <span className="text-[9px] text-gray-500" title="Perfil estimado por clase">~</span>}{(ownership[b.id] ?? 'ok') !== 'ok' && <span className="text-[10px]" title={ownership[b.id] === 'no' ? 'No lo tienes: fuera de tus recomendaciones' : 'Nivel bajo: -15 puntos'}>{ownership[b.id] === 'no' ? '🚫' : '⚠️'}</span>}</div>
                    <div className="text-[10px] text-gray-400">{b.roles[0]} · {b.rarity}</div>
                    {(() => { const mt = metaOf(b.id); return (mt.tier || mt.buffy) ? <div className={`text-[10px] font-black ${mt.tier === 'S' ? 'text-amber-300' : mt.tier === 'W' ? 'text-gray-500' : 'text-violet-300'}`}>{mt.buffy ? '🔥' : ''}{mt.tier === 'S' ? 'META S' : mt.tier === 'A' ? 'A' : mt.tier === 'W' ? 'flojo' : ''}</div> : null; })()}
                    {rec && !out && <div className={`text-[11px] font-black ${rec.score >= 70 ? 'text-green-400' : rec.score >= 50 ? 'text-yellow-300' : 'text-red-400'}`}>{rec.score}</div>}
                    {out && <div className="text-[10px] text-gray-500">{banned.includes(b.id) ? 'BANEADO' : 'ELEGIDO'}</div>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <div className="bg-panel rounded-xl p-3 border border-gray-800">
              <h3 className="text-xs font-bold text-gray-400 uppercase">Comparar (clic en recs ⭐)</h3>
              {compare.length === 0 && <p className="text-xs text-gray-500 mt-1">Añade brawlers con ⭐ en recomendaciones.</p>}
              {compare.map((id) => { const b = brawlerById(id)!; return <div key={id} className="text-xs mt-1 bg-gray-900 rounded p-1.5 flex items-center gap-1"><BrawlerImg b={b} size="w-7 h-7" /> <span><b>{b.name}</b> · DMG {b.damage} MOV {b.mobility} UTI {b.utility}</span> <button className="ml-auto text-red-400" onClick={() => setCompare(compare.filter((c) => c !== id))}>✕</button></div>; })}
            </div>
            <div className="bg-panel rounded-xl p-3 border border-gray-800">
              <h3 className="text-xs font-bold text-gray-400 uppercase">Composiciones favoritas</h3>
              <button className="text-xs bg-gray-800 rounded px-2 py-1 mt-1" onClick={() => { if (allies.length === 3) setFavorites([allies, ...favorites].slice(0, 10)); else setMsg('Necesitas 3 picks azules para guardar.'); }}>💾 Guardar azul actual</button>
              <div className="mt-1 space-y-1">{favorites.map((f, i) => <div key={i} className="text-xs bg-gray-900 rounded p-1.5">{f.map((x) => brawlerById(x)?.name).join(' + ')}</div>)}{favorites.length === 0 && <p className="text-xs text-gray-500">Sin favoritas.</p>}</div>
            </div>
            <div className="bg-panel rounded-xl p-3 border border-gray-800">
              <h3 className="text-xs font-bold text-gray-400 uppercase">Historial de drafts</h3>
              <div className="mt-1 space-y-1 max-h-[120px] overflow-y-auto scroll-thin">{history.map((h, i) => <div key={i} className="text-[11px] bg-gray-900 rounded p-1.5 text-gray-300">{h}</div>)}{history.length === 0 && <p className="text-xs text-gray-500">Se guarda al completar 6 picks.</p>}</div>
            </div>
          </div>
        </section>

        <aside className="space-y-3">
          {done && vd ? (
            <div className="bg-panel rounded-xl p-3 border border-yellow-500/70">
              <h2 className="text-xs font-bold text-yellow-300 uppercase">🔒 Veredicto final (sin cambios)</h2>
              <div className="grid grid-cols-2 gap-2 mt-1 text-center">
                <div className="bg-blue-950/50 rounded p-1.5"><div className="text-[11px] text-blue-300 font-bold">NOSOTROS {vd.blue.grade}</div><div className="text-[11px] text-gray-300">Mapa {vd.blue.map} · Duelos {vd.blue.counter}</div></div>
                <div className="bg-red-950/50 rounded p-1.5"><div className="text-[11px] text-red-300 font-bold">ELLOS {vd.red.grade}</div><div className="text-[11px] text-gray-300">Mapa {vd.red.map} · Duelos {vd.red.counter}</div></div>
              </div>
              <p className="text-[11px] mt-1.5 font-bold text-white">{vd.edge === 'blue' ? '✅ Ventaja nuestra: ejecuta tu plan.' : vd.edge === 'red' ? '⚠️ Ventaja rival: juega perfecto y evita sus counters.' : '➖ Draft parejo: lo decide la ejecución.'}</p>
              <p className="text-[11px] mt-1 text-gray-300">💡 {vd.tip}</p>
            </div>
          ) : (
          <div className="bg-panel rounded-xl p-3 border border-green-700/60">
            <h2 className="text-xs font-bold text-green-300 uppercase">🎯 Tu mejor pick ahora{enemies.length === 0 ? ' (a ciegas: prioriza pick seguro 🛡️)' : ''}</h2>
            {recs[0] && (() => { const b = brawlerById(recs[0].brawlerId)!; return (
              <button className="w-full mt-1 rounded-lg border border-green-500 bg-green-500/10 p-2 flex items-center gap-2" title="Tocar = pickearlo para el azul al instante" onClick={() => doPick('blue', recs[0].brawlerId)}>
                <BrawlerImg b={b} size="text-3xl w-14 h-14" />
                <span className="text-left"><span className="text-lg font-black">{b.name} <span className="text-green-400">{recs[0].score}</span></span>
                <span className="block text-[11px] text-gray-300">{recs[0].explanation}</span></span>
              </button>); })()}
              {recs[0] && (() => { const id = recs[0].brawlerId; const st = ownership[id] ?? 'ok'; return (
                <div className="flex gap-1 mt-1.5">
                  {st === 'ok' ? <>
                    <button className="flex-1 text-[11px] bg-gray-800 rounded px-2 py-1" onClick={() => setOwn(id, 'no')}>❌ No lo tengo</button>
                    <button className="flex-1 text-[11px] bg-gray-800 rounded px-2 py-1" onClick={() => setOwn(id, 'low')}>⚠️ Nivel bajo</button>
                  </> : <button className="flex-1 text-[11px] bg-green-900 rounded px-2 py-1" onClick={() => setOwn(id, 'ok')}>↩ {st === 'no' ? 'Ya lo tengo' : 'Ya está maxeado'} — volver a incluir</button>}
                </div>); })()}
          </div>
          )}
          {threats.length > 0 && (
            <div className="bg-panel rounded-xl p-3 border border-red-600/70">
              <h2 className="text-xs font-bold text-red-300 uppercase">⚠️ Nos counterean — responde ya</h2>
              <div className="space-y-1.5 mt-1">
                {threats.slice(0, 3).map((t, i) => {
                  const resp = recs.find((r) => countersVs(r.brawlerId, [t.enemy]).length > 0);
                  const rb = resp ? brawlerById(resp.brawlerId) : null;
                  return (
                    <div key={i} className="text-[11px] bg-red-950/40 rounded p-1.5 text-gray-200">
                      <b>{brawlerById(t.enemy)?.name}</b> counterea a tu <b>{brawlerById(t.ally)?.name}</b> ({t.score}).
                      <div className="text-gray-400">{t.note}</div>
                      {rb && resp && !done && <button className="mt-1 text-green-300 font-bold" onClick={() => doPick('blue', resp.brawlerId)}>↩ Responde con {rb.name} ({resp.score}) — tócalo para pickearlo</button>}
                      {done && <div className="mt-1 text-gray-400">🔒 Draft cerrado: ya no puedes responder. Evita ese duelo en partida.</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="bg-panel rounded-xl p-3 border border-gray-800">
            <h2 className="text-xs font-bold text-gray-400 uppercase">Recomendaciones inteligentes</h2>
            <p className="text-[11px] text-gray-500">Auto-actualizado · estimación estratégica</p>
            <div className="space-y-2 mt-2 max-h-[560px] overflow-y-auto scroll-thin pr-1">
              {recs.slice(0, 8).map((r, i) => {
                const b = brawlerById(r.brawlerId)!;
                const open = expanded === r.brawlerId;
                return (
                  <div key={r.brawlerId} className={`rounded-lg border p-2 ${i === 0 ? 'border-green-500 bg-green-500/5' : 'border-gray-700 bg-gray-900'}`}>
                    <div className="flex items-center gap-2">
                      <BrawlerImg b={b} size="text-2xl w-11 h-11" />
                      <div className="flex-1">
                        <div className="text-sm font-bold">#{i + 1} {b.name} <span className={`ml-1 ${r.score >= 70 ? 'text-green-400' : r.score >= 50 ? 'text-yellow-300' : 'text-red-400'}`}>{r.score}</span></div>
                        <div className="text-[11px] text-gray-400">{b.roles.join(' · ')} {r.safeBlind && enemies.length < 3 ? '· 🛡️ seguro' : ''}{r.multiCounter >= 1 ? ` · 🎯 counter x${r.multiCounter}` : ''} · riesgo {r.counterRisk}</div>
                      </div>
                      <button className="text-xs" title="Comparar" onClick={() => setCompare([...new Set([...compare, r.brawlerId])].slice(0, 3))}>⭐</button>
                      <button className="text-xs bg-gray-800 rounded px-1.5 py-0.5" onClick={() => setExpanded(open ? null : r.brawlerId)}>{open ? '▲' : '▼'}</button>
                    </div>
                    <Bar v={r.score} c={r.score >= 70 ? '#22c55e' : r.score >= 50 ? '#eab308' : '#ef4444'} />
                    {open && (
                      <div className="text-[11px] mt-1.5 space-y-1 text-gray-300">
                        <p>💡 {r.explanation}</p>
                        {metaLabel(r.brawlerId) && <p>📊 Meta actual: <b>{metaLabel(r.brawlerId)}</b></p>}
                        {(() => { const cs = countersVs(r.brawlerId, enemies); return cs.length > 0 ? <p>🎯 Countera a: <b>{cs.map((c) => brawlerById(c)?.name).join(', ')}</b></p> : null; })()}
                        <div className="grid grid-cols-2 gap-1">
                          <span>🗺 Mapa/modo {r.parts.mapMode}</span><span>⚔ Matchup {r.parts.matchup}</span>
                          <span>🤝 Sinergia {r.parts.synergy}</span><span>🏆 Comp. {r.parts.competitive}</span>
                        </div>
                        <p>⚠ Debilidades: {r.weaknesses.join('; ')}</p>
                        <p>🔁 Alternativas: {r.alternatives.map((a) => brawlerById(a)?.name).join(', ') || '—'}</p>
                        {(() => { const st = ownership[r.brawlerId] ?? 'ok'; return (
                          <p className="flex gap-1 items-center">🎒 Mío: <b>{st === 'ok' ? 'listo ✅' : st === 'low' ? 'nivel bajo ⚠️' : 'no lo tengo 🚫'}</b>
                            {st === 'ok' ? <><button className="bg-gray-700 rounded px-1.5 py-0.5" onClick={() => setOwn(r.brawlerId, 'no')}>No lo tengo</button><button className="bg-gray-700 rounded px-1.5 py-0.5" onClick={() => setOwn(r.brawlerId, 'low')}>Nivel bajo</button></>
                            : <button className="bg-green-900 rounded px-1.5 py-0.5" onClick={() => setOwn(r.brawlerId, 'ok')}>↩ Incluir</button>}</p>); })()}
                        {enemies.map((e) => { const m = matchupScore(r.brawlerId, e); return <p key={e}>vs {brawlerById(e)?.name}: <b>{m.score}</b> — {m.note} (conf. {m.confidence}{m.mapDependent ? ', depende del mapa' : ''})</p>; })}
                        <div className="flex gap-1 pt-1">
                          <button className="bg-blue-600 rounded px-2 py-0.5 font-bold" onClick={() => doPick('blue', r.brawlerId)}>Pick azul</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="bg-panel rounded-xl p-3 border border-red-900/60">
            <h2 className="text-xs font-bold text-red-300 uppercase">⛔ Evitar ahora</h2>
            {avoid.map((r) => <div key={r.brawlerId} className="text-xs mt-1 text-gray-300"><b>{brawlerById(r.brawlerId)?.name}</b> ({r.score}) — mal matchup o anti-sinergia. Riesgo {r.counterRisk}.</div>)}
          </div>
        </aside>
      </main>

      {showCollection && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setShowCollection(false)}>
          <div className="bg-panel border border-gray-700 rounded-xl max-w-3xl w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-3 border-b border-gray-800 flex flex-wrap items-center gap-2">
              <h2 className="font-black">🎒 Mi colección</h2>
              <span className="text-xs text-gray-400">{ALL.length - ownCount('no') - ownCount('low')} listos · {ownCount('low')} nivel bajo · {ownCount('no')} sin tener</span>
              <input value={collQuery} onChange={(e) => setCollQuery(e.target.value)} placeholder="🔍 Buscar…" className="ml-auto text-sm bg-gray-800 rounded px-2 py-1" />
              <button className="text-xs bg-gray-800 rounded px-2 py-1" onClick={() => setOwnership({})}>↩ Todos listos</button>
              <button className="text-xs bg-gray-800 rounded px-2 py-1" onClick={() => setShowCollection(false)}>✕ Cerrar</button>
            </div>
            <p className="px-3 pt-2 text-[11px] text-gray-400">Toca cada brawler para cambiar: ✅ listo → ⚠️ nivel bajo (−15 pts) → 🚫 no lo tengo (fuera de tus recomendaciones). Los rivales pueden llevar cualquiera.</p>
            <div className="p-3 grid grid-cols-4 sm:grid-cols-6 gap-2 overflow-y-auto scroll-thin">
              {ALL.filter((b) => b.name.toLowerCase().includes(collQuery.toLowerCase())).map((b) => {
                const st = ownership[b.id] ?? 'ok';
                return (
                  <button key={b.id} onClick={() => cycleOwnership(b.id)} className={`rounded-lg p-1 border text-center ${st === 'ok' ? 'border-gray-700 bg-gray-900' : st === 'low' ? 'border-yellow-500 bg-yellow-500/10' : 'border-red-600 bg-red-950/40 opacity-70'}`}>
                    <BrawlerImg b={b} size="w-10 h-10" />
                    <div className="text-[11px] font-bold leading-tight">{b.name}</div>
                    <div className="text-[11px]">{st === 'ok' ? '✅' : st === 'low' ? '⚠️ bajo' : '🚫 no'}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <footer className="max-w-[1500px] mx-auto px-4 pb-8 text-[11px] text-gray-500">
        Brawl Draft Pro · {POOL_INFO} · Formatos: en vivo/Ranked (3 bans visibles, libre) y Torneo BSC stage (sorteo + 2 globales + 3 ciegos, rulebook v1.6) · Catálogo, rarezas, clases e imágenes: BrawlAPI/Brawlify (comunidad; imágenes © Supercell; Buzz Lightyear fuera: colaboración eliminada) · Ratings: estimación propia, no oficial.
      </footer>
    </div>
  );
}
