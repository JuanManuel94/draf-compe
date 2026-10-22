import { useEffect, useMemo, useState } from 'react';
import { MAPS, POOL_INFO } from './data/maps';
import { FORMATS } from './data/meta';
import { scoreAll, suggestBans, DEFAULT_WEIGHTS, matchupScore, countersVs, threatsTo, verdict, metaLabel, metaOf, getAllBrawlers, brawlerById, DATA_SOURCE } from './engine/scoring';
import { initialDraft, expectedAction, applyPick, applyBan, applyGlobalBan, banBlocked, flipCoin, undo, redo, getFormat, bansComplete, pickOrderIssues, SLOT_LABELS, ourPickJob } from './engine/draftMachine';
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
    if ('error' in r) { setMsg(r.error); setAction(actionFor(draft)); return false; }
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

  const [menuOpen, setMenuOpen] = useState(false);
  // Pick bloqueado si aún hay baneos o si es el turno del otro equipo (snake 1-2-2-1)
  const pickChipLocked = (a: Action) => (a === 'pickBlue' || a === 'pickRed') && !draft.freeMode && (picksLocked || (exp.kind === 'pick' && exp.team !== (a === 'pickBlue' ? 'blue' : 'red')));
  // Bans simultáneos: un brawler baneado solo por el rival sigue disponible para el ban del otro equipo
  const unavailable = (id: string) => (action === 'banBlue' || action === 'banRed') && banPhase
    ? banBlocked(draft, action === 'banBlue' ? 'blue' : 'red', id)
    : banned.includes(id) || picked.includes(id);
  const actionLabel = action === 'pickBlue' ? 'Pick Azul' : action === 'pickRed' ? 'Pick Rojo' : action === 'banBlue' ? 'Ban Azul' : action === 'banRed' ? 'Ban Rojo' : action === 'globalBlue' ? '🌍 Global Azul' : '🌍 Global Rojo';
  const firstPicker = draft.coinWinner === 'red' ? 'Equipo Rojo' : draft.coinWinner === 'blue' || !format.coinFlip ? 'Equipo Azul' : 'por sortear 🪙';

  const renderTeam = (team: 'blue' | 'red') => {
    const picks = team === 'blue' ? draft.picksBlue : draft.picksRed;
    const teamBans = team === 'blue' ? draft.bansBlue : draft.bansRed;
    const teamGlobal = team === 'blue' ? draft.globalBansBlue : draft.globalBansRed;
    const isTurn = exp.kind !== 'done' && exp.kind !== 'coin' && exp.team === team;
    const hidden = maskRival && team === 'red';
    // Orden visual de arriba abajo: FP → MID → LAST (el rojo guarda su FP en el índice 2)
    const order = team === 'blue' ? [0, 1, 2] : [2, 1, 0];
    const nextPick = exp.kind === 'pick' && exp.team === team ? (team === 'blue' ? picks.indexOf(null) : picks.lastIndexOf(null)) : -1;
    const nextBan = exp.kind === 'ban' && exp.team === team ? teamBans.length : -1;
    const nextGlobal = exp.kind === 'globalban' && exp.team === team ? teamGlobal.length : -1;
    return (
      <div className={`dd-team ${team} ${isTurn ? 'is-turn' : ''}`}>
        <div className={`dd-team-header ${team}`}>{team === 'blue' ? 'Equipo Azul' : 'Equipo Rojo'}</div>
        <div className="dd-team-sub">{team === 'blue' ? 'nosotros' : 'ellos'}</div>
        {format.globalBansPerTeam > 0 && (
          <>
            <h4 className="dd-section-title">Globales ({teamGlobal.length}/{format.globalBansPerTeam})</h4>
            <div className="dd-ban-row">
              {Array.from({ length: format.globalBansPerTeam }).map((_, i) => {
                const b = brawlerById(teamGlobal[i] ?? null);
                return (
                  <button key={i} onClick={() => { if (!b) setAction(team === 'blue' ? 'globalBlue' : 'globalRed'); }}
                    className={`dd-slot dd-slot-ban global ${b ? 'filled' : ''} ${i === nextGlobal ? 'next-action' : ''}`}
                    title={b ? `Ban global: ${hidden ? '???' : b.name}` : 'Hueco de ban global — tócalo para banear aquí'}>
                    {b ? (hidden ? <span className="dd-slot-q">❓</span> : <div className="dd-banned"><BrawlerImg b={b} size="w-full h-full" /></div>)
                      : <span className="dd-slot-icon">🌍</span>}
                  </button>
                );
              })}
            </div>
          </>
        )}
        <h4 className={`dd-section-title ${banPhase ? 'hot' : ''}`}>Baneos ({teamBans.length}/{format.bansPerTeam}){format.blindBans ? ' · ciegos' : ''}</h4>
        <div className="dd-ban-row">
          {Array.from({ length: format.bansPerTeam }).map((_, i) => {
            const b = brawlerById(teamBans[i] ?? null);
            return (
              <button key={i} onClick={() => { if (!b) setAction(team === 'blue' ? 'banBlue' : 'banRed'); }}
                className={`dd-slot dd-slot-ban ${b ? 'filled' : ''} ${i === nextBan ? 'next-action' : ''}`}
                title={b ? `Baneado: ${hidden ? '???' : b.name}` : `Hueco de baneo J${i + 1} — tócalo para banear aquí`}>
                {b ? (hidden ? <span className="dd-slot-q">❓</span> : <div className="dd-banned"><BrawlerImg b={b} size="w-full h-full" /></div>)
                  : <span className="dd-slot-icon">🚫</span>}
              </button>
            );
          })}
        </div>
        <h4 className="dd-section-title">Picks ({picks.filter(Boolean).length}/3)</h4>
        <div className="dd-picks">
          {order.map((i) => {
            const pid = picks[i];
            const b = brawlerById(pid);
            return (
              <div key={i} className="dd-pick-wrapper">
                <div className="dd-pick-info">
                  <span className="dd-pick-label">{SLOT_LABELS[team][i]}</span>
                  {team === 'blue' && mySlot === i && <span className="dd-pick-me">🧍 TÚ</span>}
                  <span className="dd-pick-name">{b ? b.name : picksLocked ? '🔒' : '—'}</span>
                </div>
                <button onClick={() => {
                  if (b) {
                    const last = draft.history[draft.history.length - 1];
                    if (last?.kind === 'pick' && last.team === team && last.brawlerId === pid) { const r = undo(draft); setDraft(r); setAction(actionFor(r)); setMsg(''); }
                    else setMsg('Solo se puede quitar el último pick (usa ↩ Deshacer para volver atrás en orden).');
                  }
                  else setAction(team === 'blue' ? 'pickBlue' : 'pickRed');
                }}
                  className={`dd-slot dd-slot-pick ${b ? 'filled' : ''} ${i === nextPick ? 'next-action' : ''} ${!b && picksLocked ? 'locked' : ''}`}
                  title={b ? `${b.name} (${SLOT_LABELS[team][i]}, clic para quitarlo si es el último pick)` : picksLocked ? `🔒 Bloqueado: termina primero los baneos` : `Hueco ${SLOT_LABELS[team][i]} — tócalo para dirigir aquí la próxima acción`}>
                  {b ? <BrawlerImg b={b} size="w-full h-full" /> : <span className="dd-slot-icon">{picksLocked ? '🔒' : '+'}</span>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="dd-team-foot">{team === 'blue' ? '↓ orden: FP → MID → LAST' : '↓ orden: FP → MID → LAST'}</div>
      </div>
    );
  };

  return (
    <div className="dd-app">
      <div className="dd-container">
        <header className="dd-nav">
          <button className={`dd-burger ${menuOpen ? 'active' : ''}`} aria-label="Abrir menú" onClick={() => setMenuOpen(!menuOpen)}><span /><span /><span /></button>
          <div className="dd-nav-title">
            <h1>Brawl Draft Pro: Draft Assistant</h1>
            <span className="dd-credit">asistente de draft competitivo</span>
          </div>
          <div className="dd-nav-right">
            {format.blindBans && <label className="dd-pill" title="Ocultar bans rivales"><input type="checkbox" checked={blindHide} onChange={(e) => setBlindHide(e.target.checked)} /> Ocultar bans</label>}
            <button className="dd-round yellow" title="Mi colección" onClick={() => setShowCollection(true)}>🎒{ownCount('no') + ownCount('low') > 0 && <span className="dd-badge">{ownCount('no') + ownCount('low')}</span>}</button>
            <button className="dd-round purple" title="Exportar resumen" onClick={exportSummary}>⧉</button>
            <div className="dd-pill"><span>🇪🇸</span> ES</div>
          </div>
        </header>

        {menuOpen && <div className="dd-menu-backdrop" onClick={() => setMenuOpen(false)} />}
        <aside className={`dd-menu ${menuOpen ? 'open' : ''}`} aria-hidden={!menuOpen}>
          <div className="dd-menu-header">
            <div><h2>Brawl Draft Pro</h2><p>Acciones y ajustes</p></div>
            <button className="dd-menu-close" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú">✕</button>
          </div>
          <nav className="dd-menu-nav">
            <button onClick={() => { setShowCollection(true); setMenuOpen(false); }}>🎒 Mi colección{ownCount('no') + ownCount('low') > 0 ? ` (${ownCount('no') + ownCount('low')})` : ''}</button>
            <button onClick={() => { exportSummary(); setMenuOpen(false); }}>⧉ Exportar resumen</button>
            <button onClick={() => setDraft(undo(draft))}>↩ Deshacer</button>
            <button onClick={() => setDraft(redo(draft))}>↪ Rehacer</button>
            <button onClick={() => { reset(); setMenuOpen(false); }}>⟲ Reiniciar draft</button>
          </nav>
          <p className="dd-menu-foot">{POOL_INFO} · Catálogo e imágenes: {DATA_SOURCE} · Ratings: estimación propia.</p>
        </aside>

        <section className="dd-panel dd-setup">
          <h2 className="dd-h2">Draft Setup</h2>
          <div className="dd-setup-grid">
            <div className="dd-form-group">
              <label className="dd-label">Modo de juego:</label>
              <div className="dd-chips">
                {MODES.map((m) => <button key={m} onClick={() => changeMode(m)} className={`dd-chip ${mode === m ? 'active' : ''}`}>{m}</button>)}
              </div>
              <label className="dd-label">Selecciona mapa: <span className="dd-muted">({mapsForMode.length})</span></label>
              <div className="dd-input-wrap">
                <input value={mapQuery} onChange={(e) => setMapQuery(e.target.value)} placeholder="Busca un mapa..." className="dd-input" />
                <span className="dd-input-icon">🔍</span>
              </div>
              <div className="dd-options">
                <div className="dd-options-head">{mode}</div>
                {mapsForMode.map((m) => (
                  <button key={m.id} onClick={() => changeMap(m.id)} className={`dd-option ${mapId === m.id ? 'selected' : ''}`}>
                    {m.photo ? <MapImg src={m.photo} name={m.name} cls="dd-option-img" /> : <span className="text-xl">{m.image}</span>}
                    <span>{m.name}</span>
                  </button>
                ))}
                {mapsForMode.length === 0 && <div className="dd-option dd-muted">Sin resultados</div>}
              </div>
            </div>

            <div className="dd-form-group">
              <label className="dd-label">Formato:</label>
              <select value={formatId} onChange={(e) => changeFormat(e.target.value)} className="dd-input">
                {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.name} — {f.description}</option>)}
              </select>
              {format.freeOrder && <>
                <label className="dd-label">¿Quién pickea primero?</label>
                <div className="dd-side-select">
                  <button disabled={picked.length > 0} title={picked.length > 0 ? 'Bloqueado: los picks ya empezaron' : undefined} className={`dd-side blue ${draft.coinWinner !== 'red' ? 'active' : ''}`} onClick={() => setDraft((d) => ({ ...d, coinWinner: 'blue' }))}><span>🔵</span>Nosotros</button>
                  <button disabled={picked.length > 0} title={picked.length > 0 ? 'Bloqueado: los picks ya empezaron' : undefined} className={`dd-side red ${draft.coinWinner === 'red' ? 'active' : ''}`} onClick={() => setDraft((d) => ({ ...d, coinWinner: 'red' }))}><span>🔴</span>Ellos</button>
                </div>
              </>}
              <p className="dd-hint">🔴 {POOL_INFO}</p>
            </div>

            <div className="dd-form-group">
              <label className="dd-label">Mapa seleccionado:</label>
              <div className="dd-map-detail">
                {map.photo && <MapImg src={map.photo} name={map.name} cls="dd-map-detail-img" />}
                <div className="dd-map-detail-name">{map.image} {map.name}</div>
                <div className="dd-muted">{map.mode} · alcance {map.rangeBias}</div>
                <p>{map.description}</p>
                <div className="dd-bars">
                  <div>Muros <Bar v={map.walls * 20} c="#3498db" /></div>
                  <div>Arbustos <Bar v={map.bushes * 20} c="#2ecc71" /></div>
                  <div>Apertura <Bar v={map.openness * 20} c="#f1c40f" /></div>
                  <div>Zonas control <Bar v={map.controlZones * 20} c="#e84393" /></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="dd-panel dd-phase-panel">
          <h2>Mapa: {map.name}</h2>
          <h2>First Pick: {firstPicker}</h2>
          <div className={`dd-turn ${exp.kind === 'done' ? 'done' : exp.kind === 'coin' ? 'coin' : exp.team === 'blue' ? 'blue' : 'red'}`}><span className="dd-live-dot" />{turnText}</div>
          {msg && <div className="dd-msg">{msg}</div>}
        </section>

        <main className="dd-main">
          <section className="dd-draft-col">
            <div className="dd-board">
              {renderTeam('blue')}
              <div className="dd-map-panel">
                <div className="dd-phase-indicator">
                  <h2>{centerBadge}</h2>
                  <div className="dd-phase-sub">Picks {picked.length}/6 · Bans {draft.bansBlue.length + draft.bansRed.length}/{format.bansPerTeam * 2}{format.globalBansPerTeam > 0 && ` · Globales ${globalBanned.length}/${format.globalBansPerTeam * 2}`}</div>
                </div>
                <div className="dd-map-image">
                  {map.photo ? <MapImg src={map.photo} name={map.name} cls="dd-map-img" /> : <span className="dd-map-emoji">{map.image}</span>}
                </div>
                <div className="dd-map-caption">{map.mode} · Alcance {map.rangeBias}</div>
                {(() => { const iss = pickOrderIssues(draft); return iss.length > 0 ? (
                  <div className="dd-warn">
                    ⚠️ Orden de picks alterado (sorteo: {draft.coinWinner === 'red' ? 'empiezan ELLOS' : 'empezamos NOSOTROS'}): {iss.join(' ')} Toca el hueco correcto o usa deshacer.
                  </div>) : null; })()}
              </div>
              {renderTeam('red')}
            </div>

            <div className="dd-panel dd-pool">
              <h3 className="dd-h3">Brawlers</h3>
              <p className="dd-subtitle">👆 Un toque: se aplica al instante en <b>{actionLabel}</b> y avanza solo al siguiente paso.</p>
              <div className="dd-filters">
                <div className="dd-input-wrap grow">
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nombre del brawler..." className="dd-input" />
                  <span className="dd-input-icon">🔍</span>
                </div>
                <select value={roleF} onChange={(e) => setRoleF(e.target.value as Role | 'Todos')} className="dd-input dd-select-sm">
                  {['Todos', ...ROLES].map((r) => <option key={r}>{r}</option>)}
                </select>
                <select value={rarityF} onChange={(e) => setRarityF(e.target.value)} className="dd-input dd-select-sm">
                  {RARITIES.map((r) => <option key={r}>{r}</option>)}
                </select>
                <span className="dd-muted">{grid.length}/{ALL.length}</span>
              </div>
              <div className="dd-brawler-grid scroll-thin">
                {grid.map((b) => {
                  const out = unavailable(b.id);
                  const rec = recs.find((r) => r.brawlerId === b.id);
                  return (
                    <button key={b.id} disabled={out} onClick={() => applyAction(b.id)}
                      className={`dd-brawler ${out ? 'out' : ''}`} title={out ? (banned.includes(b.id) ? 'Baneado' : 'Elegido') : `Tocar = ${action === 'pickBlue' ? 'pick azul' : action === 'pickRed' ? 'pick rojo' : action === 'banBlue' ? 'ban azul' : action === 'banRed' ? 'ban rojo' : 'ban global'} instantáneo`}>
                      <div className="dd-brawler-img"><BrawlerImg b={b} size="w-full h-full" />
                        {rec && !out && <span className={`dd-score ${rec.score >= 70 ? 'good' : rec.score >= 50 ? 'mid' : 'bad'}`}>{rec.score}</span>}
                      </div>
                      {enemies.length > 0 && (
                        <div className="dd-tags">
                          {countersVs(b.id, enemies).length > 0 && <span className="dd-tag good">🎯x{countersVs(b.id, enemies).length}</span>}
                          {enemies.some((e) => matchupScore(e, b.id).score >= 75) && <span className="dd-tag bad">⚠️</span>}
                        </div>
                      )}
                      <div className="dd-brawler-name">{b.name}{!b.curated && <span className="dd-muted" title="Perfil estimado por clase">~</span>}{(ownership[b.id] ?? 'ok') !== 'ok' && <span title={ownership[b.id] === 'no' ? 'No lo tienes: fuera de tus recomendaciones' : 'Nivel bajo: -15 puntos'}>{ownership[b.id] === 'no' ? '🚫' : '⚠️'}</span>}</div>
                      <div className="dd-brawler-meta">{b.roles[0]} · {b.rarity}</div>
                      {(() => { const mt = metaOf(b.id); return (mt.tier || mt.buffy) ? <div className={`dd-tier ${mt.tier === 'S' ? 's' : mt.tier === 'W' ? 'w' : 'a'}`}>{mt.buffy ? '🔥' : ''}{mt.tier === 'S' ? 'META S' : mt.tier === 'A' ? 'A' : mt.tier === 'W' ? 'flojo' : ''}</div> : null; })()}
                      {out && <div className="dd-out-label">{banned.includes(b.id) ? 'BANEADO' : 'ELEGIDO'}</div>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="dd-mini-grid">
              <div className="dd-panel dd-mini">
                <h3>Comparar (⭐ en recs)</h3>
                {compare.length === 0 && <p className="dd-muted">Añade brawlers con ⭐ en recomendaciones.</p>}
                {compare.map((id) => { const b = brawlerById(id)!; return <div key={id} className="dd-mini-row"><BrawlerImg b={b} size="w-7 h-7" /> <span><b>{b.name}</b> · DMG {b.damage} MOV {b.mobility} UTI {b.utility}</span> <button className="dd-x" onClick={() => setCompare(compare.filter((c) => c !== id))}>✕</button></div>; })}
              </div>
              <div className="dd-panel dd-mini">
                <h3>Composiciones favoritas</h3>
                <button className="dd-btn small gray" onClick={() => { if (allies.length === 3) setFavorites([allies, ...favorites].slice(0, 10)); else setMsg('Necesitas 3 picks azules para guardar.'); }}>💾 Guardar azul actual</button>
                {favorites.map((f, i) => <div key={i} className="dd-mini-row">{f.map((x) => brawlerById(x)?.name).join(' + ')}</div>)}{favorites.length === 0 && <p className="dd-muted">Sin favoritas.</p>}
              </div>
              <div className="dd-panel dd-mini">
                <h3>Historial de drafts</h3>
                <div className="dd-history scroll-thin">{history.map((h, i) => <div key={i} className="dd-mini-row">{h}</div>)}{history.length === 0 && <p className="dd-muted">Se guarda al completar 6 picks.</p>}</div>
              </div>
            </div>
          </section>

          <aside className="dd-suggest-col">
            <div className="dd-panel dd-current">
              <div className="dd-prompt-line">
                <h2>{centerBadge}</h2>
                <div className="dd-toolbar">
                  <button className="dd-btn-icon gray" title="Reiniciar" onClick={reset}>⟲</button>
                  <button className="dd-btn-icon teal" title="Exportar resumen" onClick={exportSummary}>⧉</button>
                  <button className="dd-btn-icon blue" title="Rehacer" onClick={() => setDraft(redo(draft))}>↪</button>
                  <button className="dd-btn-icon blue" title="Deshacer" onClick={() => setDraft(undo(draft))}>↩</button>
                </div>
              </div>
              <p className="dd-instr">
                {banPhase ? <>🚫 <b>1º registra los {format.bansPerTeam} bans por equipo (1 por jugador)</b> tocando los huecos 🚫 de cada equipo. <b>Los picks están bloqueados 🔒</b> hasta terminar.</>
                  : <>🎮 <b>2º marca los picks:</b> toca los picks de ELLOS (rojo) y los vuestros (azul). Aquí te digo <b>qué pickear</b> al instante.</>}
              </p>
              <div className="dd-chips center">
                {(Object.entries({
                  pickBlue: `🎯 Pick Azul (${draft.picksBlue.filter(Boolean).length}/3)`,
                  pickRed: `🎯 Pick Rojo (${draft.picksRed.filter(Boolean).length}/3)`,
                  banBlue: `🚫 Ban Azul (${draft.bansBlue.length}/${format.bansPerTeam})`,
                  banRed: `🚫 Ban Rojo (${draft.bansRed.length}/${format.bansPerTeam})`
                }) as [Action, string][]).map(([a, label]) => (
                  <button key={a} onClick={() => setAction(a)} disabled={pickChipLocked(a)} title={pickChipLocked(a) ? (picksLocked ? '🔒 Primero termina los baneos' : `⏳ Está eligiendo el equipo ${exp.kind === 'pick' && exp.team === 'blue' ? 'AZUL' : 'ROJO'}`) : undefined} className={`dd-chip ${action === a ? (a === 'pickBlue' || a === 'banBlue' ? 'active-blue' : 'active-red') : ''}`}>{label}</button>
                ))}
                {format.globalBansPerTeam > 0 && (['globalBlue', 'globalRed'] as Action[]).map((a) => (
                  <button key={a} onClick={() => setAction(a)} className={`dd-chip ${action === a ? 'active-purple' : ''}`}>{a === 'globalBlue' ? '🌍 Global Azul' : '🌍 Global Rojo'}</button>
                ))}
              </div>

              {format.coinFlip && (exp.kind === 'coin' || draft.coinWinner) && (
                <div className="dd-coin">
                  {!draft.coinWinner ? (
                    <>
                      <div className="dd-coin-face">{flipping ? (coinFace === 'blue' ? '🔵' : '🔴') : '🪙'}</div>
                      <p>{flipping ? 'Girando…' : 'Si sale azul, comenzamos pickeando nosotros; si sale roja, comienzan ellos.'}</p>
                      <div className="dd-coin-actions">
                        <button onClick={runCoinFlip} disabled={flipping} className="dd-btn yellow">{flipping ? 'Girando…' : '🪙 Lanzar moneda'}</button>
                        <button onClick={() => setDraft((d) => flipCoin(d, 'blue'))} className="dd-btn small blue">Empezamos nosotros</button>
                        <button onClick={() => setDraft((d) => flipCoin(d, 'red'))} className="dd-btn small red">Empiezan ellos</button>
                      </div>
                    </>
                  ) : (
                    <p>🪙 Sorteo: <b className={draft.coinWinner === 'blue' ? 'dd-c-blue' : 'dd-c-red'}>{draft.coinWinner === 'blue' ? 'AZUL — comenzamos nosotros' : 'ROJO — comienzan ellos'}</b>
                      <button className="dd-btn small gray ml-2" onClick={() => setDraft((d) => { const n = structuredClone(d); n.coinWinner = null; n.history = n.history.filter((h) => h.kind !== 'coin'); n.phase = 'coin'; return n; })}>Repetir sorteo</button></p>
                  )}
                </div>
              )}

              {(() => {
                const job = ourPickJob(draft.picksBlue);
                const myTurn = !done && mySlot !== null && allies.length === mySlot;
                return (
                  <div className={`dd-myslot ${myTurn ? 'hot' : ''}`}>
                    {!done && job !== 'DONE' && (
                      <div>📌 Nuestro pick Nº {allies.length + 1} — {job === 'FP' ? <><b>🛡️ FIRST PICK:</b> asegura poder de mapa difícil de counterear (nada de especialistas).</> : job === 'MID' ? <><b>🧩 MID:</b> completa roles y sinergia con tu {allies.map((a) => brawlerById(a)?.name).join(' + ') || 'FP'}.</> : <><b>🎯 LAST PICK:</b> counter duro a lo suyo, es tu asiento de counter.</>}</div>
                    )}
                    <div className="dd-myslot-row">
                      <span>¿Qué pick eres tú?</span>
                      {(['FP', 'MID', 'LAST'] as const).map((j, idx) => (
                        <button key={j} onClick={() => setMySlot(mySlot === idx ? null : idx)} className={`dd-chip small ${mySlot === idx ? 'active' : ''}`}>{j}</button>
                      ))}
                      {mySlot !== null && <span className="dd-c-yellow">🧍 Eres el {(['FP', 'MID', 'LAST'] as const)[mySlot]}{myTurn && recs[0] ? ` — ¡TE TOCA A TI! Elige ${brawlerById(recs[0].brawlerId)?.name} (${recs[0].score})` : myTurn ? ' — ¡TE TOCA A TI!' : ''}</span>}
                    </div>
                  </div>
                );
              })()}
            </div>

            {done && vd ? (
              <div className="dd-engine verdict">
                <h3>🔒 Veredicto final (sin cambios)</h3>
                <div className="dd-verdict-grid">
                  <div className="blue"><div className="dd-c-blue">NOSOTROS {vd.blue.grade}</div><div>Mapa {vd.blue.map} · Duelos {vd.blue.counter}</div></div>
                  <div className="red"><div className="dd-c-red">ELLOS {vd.red.grade}</div><div>Mapa {vd.red.map} · Duelos {vd.red.counter}</div></div>
                </div>
                <p className="dd-strong">{vd.edge === 'blue' ? '✅ Ventaja nuestra: ejecuta tu plan.' : vd.edge === 'red' ? '⚠️ Ventaja rival: juega perfecto y evita sus counters.' : '➖ Draft parejo: lo decide la ejecución.'}</p>
                <p>💡 {vd.tip}</p>
              </div>
            ) : (
              <div className="dd-engine">
                <h3>🎯 Tu mejor pick ahora{enemies.length === 0 ? <span className="dd-muted"> (a ciegas: prioriza pick seguro 🛡️)</span> : ''}</h3>
                {recs[0] && (() => { const b = brawlerById(recs[0].brawlerId)!; return (
                  <button className="dd-best" title="Tocar = pickearlo para el azul al instante" onClick={() => doPick('blue', recs[0].brawlerId)}>
                    <div className="dd-best-img"><BrawlerImg b={b} size="w-full h-full" /></div>
                    <span className="dd-best-text"><span className="dd-best-name">{b.name} <span className="dd-c-green">{recs[0].score}</span></span>
                      <span className="dd-best-expl">{recs[0].explanation}</span></span>
                  </button>); })()}
                {recs[0] && (() => { const id = recs[0].brawlerId; const st = ownership[id] ?? 'ok'; return (
                  <div className="dd-own-row">
                    {st === 'ok' ? <>
                      <button className="dd-btn small gray" onClick={() => setOwn(id, 'no')}>❌ No lo tengo</button>
                      <button className="dd-btn small gray" onClick={() => setOwn(id, 'low')}>⚠️ Nivel bajo</button>
                    </> : <button className="dd-btn small green" onClick={() => setOwn(id, 'ok')}>↩ {st === 'no' ? 'Ya lo tengo' : 'Ya está maxeado'} — volver a incluir</button>}
                  </div>); })()}
              </div>
            )}

            {threats.length > 0 && (
              <div className="dd-panel dd-threats">
                <h3 className="dd-h3 red">⚠️ Nos counterean — responde ya</h3>
                {threats.slice(0, 3).map((t, i) => {
                  const resp = recs.find((r) => countersVs(r.brawlerId, [t.enemy]).length > 0);
                  const rb = resp ? brawlerById(resp.brawlerId) : null;
                  return (
                    <div key={i} className="dd-threat">
                      <b>{brawlerById(t.enemy)?.name}</b> counterea a tu <b>{brawlerById(t.ally)?.name}</b> ({t.score}).
                      <div className="dd-muted">{t.note}</div>
                      {rb && resp && !done && <button className="dd-link" onClick={() => doPick('blue', resp.brawlerId)}>↩ Responde con {rb.name} ({resp.score}) — tócalo para pickearlo</button>}
                      {done && <div className="dd-muted">🔒 Draft cerrado: ya no puedes responder. Evita ese duelo en partida.</div>}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="dd-panel dd-recs">
              <h3 className="dd-h3">Recomendaciones</h3>
              <p className="dd-subtitle">Auto-actualizado · estimación estratégica</p>
              <div className="dd-rec-grid">
                {recs.slice(0, 9).map((r, i) => {
                  const b = brawlerById(r.brawlerId)!;
                  const open = expanded === r.brawlerId;
                  return (
                    <div key={r.brawlerId} className={`dd-rec-card ${i === 0 ? 'top' : ''} ${open ? 'open' : ''}`} onClick={() => setExpanded(open ? null : r.brawlerId)}>
                      <div className="dd-rec-head">
                        <div className="dd-rec-img"><BrawlerImg b={b} size="w-full h-full" /></div>
                        <div className="min-w-0">
                          <h4>#{i + 1} {b.name}</h4>
                          <div className={`dd-rec-score ${r.score >= 70 ? 'good' : r.score >= 50 ? 'mid' : 'bad'}`}>{r.score}</div>
                        </div>
                        <button className="dd-star" title="Comparar" onClick={(e) => { e.stopPropagation(); setCompare([...new Set([...compare, r.brawlerId])].slice(0, 3)); }}>⭐</button>
                      </div>
                      <div className="dd-rec-stats">{b.roles.join(' · ')}{r.safeBlind && enemies.length < 3 ? ' · 🛡️ seguro' : ''}{r.multiCounter >= 1 ? ` · 🎯 x${r.multiCounter}` : ''}<br /><small>riesgo {r.counterRisk}</small></div>
                      <Bar v={r.score} c={r.score >= 70 ? '#2ecc71' : r.score >= 50 ? '#f1c40f' : '#e74c3c'} />
                      {open && (
                        <div className="dd-rec-detail" onClick={(e) => e.stopPropagation()}>
                          <p>💡 {r.explanation}</p>
                          {metaLabel(r.brawlerId) && <p>📊 Meta actual: <b>{metaLabel(r.brawlerId)}</b></p>}
                          {(() => { const cs = countersVs(r.brawlerId, enemies); return cs.length > 0 ? <p>🎯 Countera a: <b>{cs.map((c) => brawlerById(c)?.name).join(', ')}</b></p> : null; })()}
                          <div className="dd-rec-parts">
                            <span>🗺 Mapa/modo {r.parts.mapMode}</span><span>⚔ Matchup {r.parts.matchup}</span>
                            <span>🤝 Sinergia {r.parts.synergy}</span><span>🏆 Comp. {r.parts.competitive}</span>
                          </div>
                          <p>⚠ Debilidades: {r.weaknesses.join('; ')}</p>
                          <p>🔁 Alternativas: {r.alternatives.map((a) => brawlerById(a)?.name).join(', ') || '—'}</p>
                          {(() => { const st = ownership[r.brawlerId] ?? 'ok'; return (
                            <p className="dd-own-row">🎒 Mío: <b>{st === 'ok' ? 'listo ✅' : st === 'low' ? 'nivel bajo ⚠️' : 'no lo tengo 🚫'}</b>
                              {st === 'ok' ? <><button className="dd-btn small gray" onClick={() => setOwn(r.brawlerId, 'no')}>No lo tengo</button><button className="dd-btn small gray" onClick={() => setOwn(r.brawlerId, 'low')}>Nivel bajo</button></>
                              : <button className="dd-btn small green" onClick={() => setOwn(r.brawlerId, 'ok')}>↩ Incluir</button>}</p>); })()}
                          {enemies.map((e) => { const m = matchupScore(r.brawlerId, e); return <p key={e}>vs {brawlerById(e)?.name}: <b>{m.score}</b> — {m.note} (conf. {m.confidence}{m.mapDependent ? ', depende del mapa' : ''})</p>; })}
                          <button className="dd-btn small blue" onClick={() => doPick('blue', r.brawlerId)}>Pick azul</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="dd-panel dd-avoid">
              <h3 className="dd-h3 red">⛔ Evitar ahora</h3>
              {avoid.map((r) => <div key={r.brawlerId} className="dd-mini-row"><b>{brawlerById(r.brawlerId)?.name}</b> ({r.score}) — mal matchup o anti-sinergia. Riesgo {r.counterRisk}.</div>)}
            </div>

            <div className="dd-two">
              <div className="dd-panel">
                <div className="dd-panel-head">
                  <h3 className="dd-h3">Baneos sugeridos</h3>
                  <select value={banCount} onChange={(e) => setBanCount(Number(e.target.value))} className="dd-input dd-select-xs">
                    {[3, 4, 5].map((n) => <option key={n} value={n}>Top {n}</option>)}
                  </select>
                </div>
                <div className="dd-ban-sugs">
                  {bans.map((b, i) => {
                    const bb = brawlerById(b.brawlerId);
                    return (
                      <button key={b.brawlerId} onClick={() => { const e = expectedAction(draft); if (e.kind === 'ban') doBan(e.team, b.brawlerId); else if (e.kind === 'globalban') doGlobalBan(e.team, b.brawlerId); else doBan(draft.bansBlue.length <= draft.bansRed.length ? 'blue' : 'red', b.brawlerId); }} title="Tocar = banearlo al instante" className="dd-ban-sug">
                        {bb && <div className="dd-ban-sug-img"><BrawlerImg b={bb} size="w-full h-full" /></div>}
                        <span><span className="dd-c-red">#{i + 1} {bb?.name}</span> <span className="dd-muted">({b.score})</span>
                          <span className="dd-ban-sug-reason">{b.reason}</span></span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="dd-panel">
                <h3 className="dd-h3">Ponderación</h3>
                {(Object.keys(weights) as (keyof Weights)[]).map((k) => (
                  <label key={k} className="dd-weight">
                    <span className="dd-weight-name">{k}</span>
                    <input type="range" min={0} max={0.6} step={0.05} value={weights[k]} onChange={(e) => setWeights({ ...weights, [k]: Number(e.target.value) })} />
                    <span className="dd-weight-val">{Math.round(weights[k] * 100)}%</span>
                  </label>
                ))}
                <p className="dd-muted small">Pesos de demostración, no oficiales. Normalizado 0–100.</p>
              </div>
            </div>
          </aside>
        </main>

        <footer className="dd-footer">
          Brawl Draft Pro · {POOL_INFO} · Formatos: en vivo/Ranked (3 bans visibles, libre) y Torneo BSC stage (sorteo + 2 globales + 3 ciegos, rulebook v1.6) · Catálogo, rarezas, clases e imágenes: BrawlAPI/Brawlify (comunidad; imágenes © Supercell; Buzz Lightyear fuera: colaboración eliminada) · Ratings: estimación propia, no oficial.
        </footer>
      </div>

      {showCollection && (
        <div className="dd-modal-backdrop" onClick={() => setShowCollection(false)}>
          <div className="dd-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dd-modal-head">
              <h2>🎒 Mi colección</h2>
              <span className="dd-muted">{ALL.length - ownCount('no') - ownCount('low')} listos · {ownCount('low')} nivel bajo · {ownCount('no')} sin tener</span>
              <input value={collQuery} onChange={(e) => setCollQuery(e.target.value)} placeholder="Buscar..." className="dd-input dd-modal-search" />
              <button className="dd-btn small gray" onClick={() => setOwnership({})}>↩ Todos listos</button>
              <button className="dd-btn small gray" onClick={() => setShowCollection(false)}>✕ Cerrar</button>
            </div>
            <p className="dd-modal-hint">Toca cada brawler para cambiar: ✅ listo → ⚠️ nivel bajo (−15 pts) → 🚫 no lo tengo (fuera de tus recomendaciones). Los rivales pueden llevar cualquiera.</p>
            <div className="dd-modal-grid scroll-thin">
              {ALL.filter((b) => b.name.toLowerCase().includes(collQuery.toLowerCase())).map((b) => {
                const st = ownership[b.id] ?? 'ok';
                return (
                  <button key={b.id} onClick={() => cycleOwnership(b.id)} className={`dd-coll ${st}`}>
                    <div className="dd-coll-img"><BrawlerImg b={b} size="w-full h-full" /></div>
                    <div className="dd-brawler-name">{b.name}</div>
                    <div>{st === 'ok' ? '✅' : st === 'low' ? '⚠️ bajo' : '🚫 no'}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
