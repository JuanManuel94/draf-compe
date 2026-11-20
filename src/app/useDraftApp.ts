import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { MAPS } from '../data/maps';
import { FORMATS } from '../data/meta';
import { REAL_META } from '../engine/realMeta';
import { scoreAll, suggestBans, DEFAULT_WEIGHTS, threatsTo, verdict, getAllBrawlers, brawlerById, countersOnMap } from '../engine/scoring';
import type { LiveBrawler, LiveSnapshot } from './live';
import { initialDraft, expectedAction, applyPick, applyBan, applyGlobalBan, banBlocked, flipCoin, undo, redo, getFormat, bansComplete, restoreDraft } from '../engine/draftMachine';
import { store } from '../engine/storage';
import { parseVoice } from '../engine/voice';
import { speak } from './useSpeech';
import type { DraftAction, DraftState, GameMode, GameResult, HistoryEntry, Ownership, Role, Team, Weights } from '../types';

export const MODES: GameMode[] = ['Atrapagemas', 'Balón Brawl', 'Recompensa', 'Noqueo', 'Atraco', 'Zona Restringida'];
export const ROLES: Role[] = ['Control', 'Daño', 'Apoyo', 'Tanque', 'Asesino', 'Francotirador', 'Artillería'];
export const RARITIES = ['Todas', 'Inicial', 'Especial', 'Superespecial', 'Épica', 'Mítica', 'Legendaria', 'Ultralegendaria'];
export const WEIGHT_LABELS: Record<keyof Weights, string> = {
  mapMode: 'Mapa y modo', matchup: 'Matchups', synergy: 'Sinergia', competitive: 'Meta competitivo', flex: 'Flexibilidad'
};
// Tiempos del draft de Ranked (Trophycoach, oct-2026): 22,5 s para banear y 22 s por pick
export const BAN_SECONDS = 22.5;
export const PICK_SECONDS = 22;
const DEFAULT_MODE: GameMode = 'Balón Brawl';
const DEFAULT_MAP = 'bb-triple-dribble';

export type Action = 'pickBlue' | 'pickRed' | 'banBlue' | 'banRed' | 'globalBlue' | 'globalRed';

const validFormat = (id: string) => (FORMATS.some((f) => f.id === id) ? id : 'live');
const validMap = (id: string) => (MAPS.some((m) => m.id === id) ? id : DEFAULT_MAP);

// Recupera el draft en curso tras recargar (útil en móvil); se descarta si no encaja con el formato/mapa guardados.
function loadDraft(mode: GameMode, mapId: string, formatId: string): DraftState {
  const saved = store.load<DraftState | null>('draft', null);
  const ok = saved && Array.isArray(saved.history) && Array.isArray(saved.picksBlue) && saved.picksBlue.length === 3
    && Array.isArray(saved.picksRed) && saved.picksRed.length === 3 && saved.formatId === formatId && MAPS.some((m) => m.id === saved.mapId);
  return ok ? { ...saved, mode, mapId } : initialDraft(mode, mapId, formatId);
}

// --- Enlace compartible: el draft viaja en el hash (#d=...) como JSON en base64url ---
type Shared = { f: string; m: string; c: Team | null; h: [DraftAction['kind'], Team | null, string | null, number | null | undefined][] };
const toB64 = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64 = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
export function encodeDraft(d: DraftState): string {
  const data: Shared = { f: d.formatId, m: d.mapId, c: d.coinWinner, h: d.history.map((h) => [h.kind, h.team, h.brawlerId, h.slot]) };
  return toB64(JSON.stringify(data));
}
function decodeDraft(code: string): DraftState | null {
  try {
    const data = JSON.parse(fromB64(code)) as Shared;
    const map = MAPS.find((m) => m.id === data.m);
    if (!map || !FORMATS.some((f) => f.id === data.f) || !Array.isArray(data.h)) return null;
    const history: DraftAction[] = data.h.map(([kind, team, brawlerId, slot]) => ({ kind, team, brawlerId, slot, at: 0 }));
    return restoreDraft(map.mode, map.id, data.f, data.c, history);
  } catch { return null; }
}
const sharedFromUrl = (): DraftState | null => {
  const m = typeof location !== 'undefined' ? location.hash.match(/^#d=(.+)$/) : null;
  return m ? decodeDraft(m[1]) : null;
};

// Firma de un draft (formato, mapa, primer pick y acciones) para no duplicarlo en historial/serie
const sigOf = (e: { formatId: string; mapId: string; coinWinner: Team | null; history: DraftAction[] }) =>
  JSON.stringify([e.formatId, e.mapId, e.coinWinner, e.history.map((h) => [h.kind, h.team, h.brawlerId, h.slot ?? null])]);


export function useDraftApp() {
  const ALL = useMemo(() => getAllBrawlers(), []);
  const shared = useMemo(sharedFromUrl, []);
  const [mode, setMode] = useState<GameMode>(() => shared?.mode ?? store.load('mode', DEFAULT_MODE));
  const [mapId, setMapId] = useState(() => shared?.mapId ?? validMap(store.load('mapId', DEFAULT_MAP)));
  const [formatId, setFormatId] = useState(() => shared?.formatId ?? validFormat(store.load('formatId', 'live')));
  const [draft, setDraft] = useState<DraftState>(() => shared ?? loadDraft(store.load('mode', DEFAULT_MODE), validMap(store.load('mapId', DEFAULT_MAP)), validFormat(store.load('formatId', 'live'))));
  const [weights, setWeights] = useState<Weights>(() => store.load('weights', DEFAULT_WEIGHTS));
  const [compare, setCompare] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[][]>(() => store.load('favorites', []));
  // Entradas antiguas eran texto plano: se conservan y se muestran tal cual
  const [history, setHistory] = useState<(HistoryEntry | string)[]>(() => store.load('history', []));
  const [series, setSeries] = useState<HistoryEntry[]>(() => store.load('series', []));
  const [msg, setMsg] = useState(shared ? '🔗 Draft cargado desde un enlace compartido.' : '');
  const [blindHide, setBlindHide] = useState(() => store.load('blindHide', true));
  const [mySlot, setMySlot] = useState<number | null>(() => store.load('mySlot', null));
  const [ownership, setOwnership] = useState<Record<string, Ownership>>(() => store.load('ownership', {}));
  const [action, setAction] = useState<Action>(() => store.load('action', 'banBlue'));
  const [timerOn, setTimerOn] = useState<boolean>(() => store.load('timerOn', true));
  const [voiceFeedback, setVoiceFeedback] = useState<boolean>(() => store.load('voiceFeedback', true));
  const [lastVoice, setLastVoice] = useState<{ heard: string; result: string; ok: boolean } | null>(null);
  const [setupOpen, setSetupOpen] = useState<boolean>(() => !shared && store.load('draft', null) === null);
  // Flujo guiado: cada draft nuevo empieza eligiendo (o detectando) el mapa
  const [mapOkFor, setMapOkFor] = useState<string>(() => (shared ? shared.id ?? '' : store.load('mapOkFor', '')));

  useEffect(() => {
    // El enlace ya se cargó: se limpia el hash para que recargar no pise cambios posteriores
    if (shared) window.history.replaceState(null, '', location.pathname + location.search);
  }, [shared]);
  // Enlace pegado con la app ya abierta: solo cambia el hash, no se recarga la página
  const draftRef = useRef(draft);
  draftRef.current = draft;
  useEffect(() => {
    function onHash() {
      const d = sharedFromUrl();
      if (!d) return;
      window.history.replaceState(null, '', location.pathname + location.search);
      if (draftRef.current.history.length > 0 && !window.confirm('Abrir el draft del enlace sustituye al actual. ¿Continuar?')) return;
      setFormatId(d.formatId); setMapId(d.mapId); setMode(d.mode); setDraft(d);
      setMsg('🔗 Draft cargado desde un enlace compartido.');
    }
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => { store.save('mode', mode); store.save('mapId', mapId); store.save('formatId', formatId); store.save('weights', weights); store.save('blindHide', blindHide); store.save('ownership', ownership); store.save('mySlot', mySlot); store.save('action', action); store.save('timerOn', timerOn); store.save('voiceFeedback', voiceFeedback); }, [mode, mapId, formatId, weights, blindHide, ownership, mySlot, action, timerOn, voiceFeedback]);
  useEffect(() => { store.save('favorites', favorites); store.save('history', history); store.save('series', series); }, [favorites, history, series]);
  useEffect(() => { store.save('draft', draft); }, [draft]);
  useEffect(() => { store.save('mapOkFor', mapOkFor); }, [mapOkFor]);

  const map = MAPS.find((m) => m.id === mapId) ?? MAPS.find((m) => m.mode === mode) ?? MAPS[0];
  const format = getFormat(formatId);
  const exp = expectedAction(draft);
  const globalBanned = [...draft.globalBansBlue, ...draft.globalBansRed];
  const banned = [...globalBanned, ...draft.bansBlue, ...draft.bansRed];
  const picked = [...draft.picksBlue, ...draft.picksRed].filter(Boolean) as string[];
  const allies = draft.picksBlue.filter(Boolean) as string[];
  const enemies = draft.picksRed.filter(Boolean) as string[];
  const setBansDone = draft.bansBlue.length + draft.bansRed.length;
  const setBansTotal = format.bansPerTeam * 2;
  const banPhase = format.bansPerTeam > 0 && setBansDone < setBansTotal;
  const picksLocked = !bansComplete(draft) && !draft.freeMode;
  const done = draft.phase === 'done';
  const maskRival = format.blindBans && blindHide;
  const mapConfirmed = mapOkFor === (draft.id ?? '') || draft.history.length > 0;
  // Paso del flujo: 1 mapa → 2 bans → 3 picks (el primer pick se decide al empezar) → 4 resultado
  const flowStep: 'map' | 'bans' | 'picks' | 'done' = !mapConfirmed ? 'map' : exp.kind === 'done' ? 'done' : picksLocked ? 'bans' : 'picks';
  // Bans que ambos equipos repitieron (posible en Ranked: los bans son simultáneos)
  const doubleBans = draft.bansBlue.filter((b) => draft.bansRed.includes(b));

  function actionFor(d: DraftState): Action {
    const e = expectedAction(d);
    if (e.kind === 'globalban') return e.team === 'blue' ? 'globalBlue' : 'globalRed';
    if (e.kind === 'ban') return e.team === 'blue' ? 'banBlue' : 'banRed';
    if (e.kind === 'pick') return e.team === 'blue' ? 'pickBlue' : 'pickRed';
    return action;
  }
  // Mantiene la acción seleccionada alineada con el paso que toca (sorteo, deshacer, primer pick manual)
  useEffect(() => {
    if (draft.freeMode || exp.kind === 'coin' || exp.kind === 'done') return;
    const kind = action.startsWith('global') ? 'globalban' : action.startsWith('ban') ? 'ban' : 'pick';
    const team = action.endsWith('Blue') ? 'blue' : 'red';
    const teamFree = format.freeOrder && exp.kind === 'ban';
    if (kind !== exp.kind || (!teamFree && team !== exp.team)) setAction(actionFor(draft));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  // Meta Ranked real del mapa actual (brawlbetter.com, generado con `npm run meta:update`)
  const realMap = REAL_META.maps[map.id] ?? null;
  const realStats = realMap?.brawlers ?? {};

  // Dependen del draft (no de los arrays derivados, que son nuevos en cada render): así no se
  // recalculan 4 veces por segundo con el temporizador
  /* eslint-disable react-hooks/exhaustive-deps */
  const recs = useMemo(() => scoreAll({ mapId: map.id, allies, enemies, weights, banned, picked, ownership }), [map.id, draft, weights, ownership]);
  const threats = useMemo(() => threatsTo(allies, enemies), [draft]);
  const vd = useMemo(() => (done ? verdict(map.id, allies, enemies) : null), [done, map.id, draft]);
  /* eslint-enable react-hooks/exhaustive-deps */
  const avoid = useMemo(() => [...recs].slice(-3).reverse(), [recs]);
  const suggestedBans = (count: number) => suggestBans(map.id, count, banned);

  // Guarda el draft terminado en el historial (una vez por draft)
  const savedRef = useRef<string>('');
  useEffect(() => {
    if (!done || picked.length !== 6) return;
    const sig = `${draft.id}|${sigOf(draft)}`;
    if (savedRef.current === sig) return;
    savedRef.current = sig;
    // Un draft cargado del historial no se vuelve a guardar; uno nuevo (otro id) sí, aunque se parezca
    setHistory((h) => h.some((e) => typeof e !== 'string' && (e.draftId === draft.id || e.id === draft.id || (!draft.id && sigOf(e) === sigOf(draft)))) ? h
      : [{ id: `${Date.now()}`, at: Date.now(), mapId: map.id, formatId, coinWinner: draft.coinWinner, history: draft.history, draftId: draft.id }, ...h].slice(0, 20));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  // --- Temporizador de turno: 22,5 s para toda la fase de bans de Ranked (simultáneos) y 22 s por pick ---
  const stepKey = exp.kind === 'ban' && format.freeOrder ? 'ban-phase' : `${exp.kind}-${'team' in exp ? exp.team : ''}-${draft.history.length}`;
  const stepSeconds = exp.kind === 'pick' ? PICK_SECONDS : BAN_SECONDS;
  const [stepStart, setStepStart] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { setStepStart(Date.now()); }, [stepKey]);
  const timerActive = timerOn && (exp.kind === 'pick' || exp.kind === 'ban' || exp.kind === 'globalban');
  useEffect(() => {
    if (!timerActive) return;
    const iv = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(iv);
  }, [timerActive]);
  const secondsLeft = Math.max(0, stepSeconds - (now - stepStart) / 1000);
  const restartTimer = () => { setStepStart(Date.now()); setNow(Date.now()); };

  // --- Teléfono: publica el draft en el servidor local para la vista /?live ---
  const [autoDetect, setAutoDetect] = useState(false);
  const [phoneViewers, setPhoneViewers] = useState(0);
  const liveSource = useMemo(() => Math.random().toString(36).slice(2, 10), []);
  // Última vez que se usó esta pestaña (abrirla, tocarla, teclear o cambiar el draft): el teléfono
  // sigue a la pestaña usada más recientemente, aunque haya otras abiertas
  const [changedAt, setChangedAt] = useState(() => Date.now());
  const draftSig = `${map.id}|${draft.id}|${draft.coinWinner}|${draft.history.length}|${draft.history.map((h) => h.brawlerId).join(',')}`;
  const lastSig = useRef(draftSig);
  useEffect(() => { if (lastSig.current !== draftSig) { lastSig.current = draftSig; setChangedAt(Date.now()); } }, [draftSig]);
  useEffect(() => {
    let last = 0;
    const touch = () => { const t = Date.now(); if (t - last > 3000) { last = t; setChangedAt(t); } };
    window.addEventListener('pointerdown', touch);
    window.addEventListener('keydown', touch);
    return () => { window.removeEventListener('pointerdown', touch); window.removeEventListener('keydown', touch); };
  }, []);
  const liveSnapshot = useMemo<LiveSnapshot>(() => {
    const lb = (id: string | null): LiveBrawler | null => { const b = brawlerById(id); return b ? { id: b.id, name: b.name, img: b.image } : null; };
    const list = (ids: string[]) => ids.map(lb).filter(Boolean) as LiveBrawler[];
    const ourTurn = exp.kind === 'pick' && exp.team === 'blue';
    const myTurn = ourTurn && mySlot !== null && allies.length === mySlot;
    const step = flowStep === 'map' ? 'Eligiendo mapa…' : exp.kind === 'done' ? 'Draft terminado' : exp.kind === 'coin' ? 'Esperando sorteo'
      : exp.kind === 'pick' ? (exp.team === 'blue' ? (myTurn ? '¡TE TOCA PICKEAR!' : 'Pickea tu equipo') : 'Pickean ellos')
      : `Fase de bans (${setBansDone}/${setBansTotal})`;
    const excluded = [...banned, ...picked, ...Object.entries(ownership).filter(([, s]) => s === 'no').map(([id]) => id)];
    return {
      mapName: map.name, mode: map.mode, mapPhoto: map.photo, step, ourTurn, myTurn,
      stepStart, stepSeconds, timerOn: timerActive,
      bansBlue: list(draft.bansBlue), bansRed: list(draft.bansRed),
      picksBlue: draft.picksBlue.map(lb), picksRed: [...draft.picksRed].reverse().map(lb),
      best: done ? [] : recs.slice(0, 3).map((r) => ({ ...lb(r.brawlerId)!, score: r.score, why: r.explanation })),
      bans: banPhase ? suggestBans(map.id, 3, banned).map((s) => ({ ...lb(s.brawlerId)!, why: s.reason })) : [],
      counters: done ? [] : enemies.map((e) => ({ enemy: lb(e)!, options: countersOnMap(map.id, e, excluded, 3).map((c) => ({ ...lb(c.brawlerId)!, matchup: c.matchup, map: c.map })) })),
      threats: threats.slice(0, 2).map((t) => `${brawlerById(t.enemy)?.name} counterea a tu ${brawlerById(t.ally)?.name}`),
      verdict: vd ? { winChance: vd.winChance, text: vd.edge === 'blue' ? 'Ventaja nuestra' : vd.edge === 'red' ? 'Ventaja rival' : 'Draft parejo', tip: vd.tip } : null,
      autoDetect, source: liveSource, changedAt
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, map.id, recs, threats, vd, mySlot, stepStart, stepSeconds, timerActive, ownership, autoDetect, changedAt, flowStep]);
  // Solo se envía cuando el contenido cambia de verdad (y, si no hay servidor, se reintenta cada 5 s sin ruido)
  const liveJson = JSON.stringify(liveSnapshot);
  const [liveRetry, setLiveRetry] = useState(0);
  useEffect(() => {
    let retry: ReturnType<typeof setTimeout> | undefined;
    const t = setTimeout(() => {
      fetch('/api/live', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: liveJson })
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((j: { viewers?: number }) => setPhoneViewers(j.viewers ?? 0))
        .catch(() => { setPhoneViewers(0); retry = setTimeout(() => setLiveRetry((n) => n + 1), 5000); });
    }, 150);
    return () => { clearTimeout(t); if (retry) clearTimeout(retry); };
  }, [liveJson, liveRetry]);
  // Cuántos teléfonos siguen el draft (se actualiza aunque el draft no cambie)
  useEffect(() => {
    const iv = setInterval(() => {
      fetch(`/api/live/address?source=${liveSource}`).then((r) => r.json()).then((j: { viewers?: number; hasLive?: boolean; owner?: string | null }) => {
        setPhoneViewers(j.viewers ?? 0);
        // El servidor perdió el draft o lo lleva otra pestaña que quizá ya no existe: se vuelve a enviar
        // (si esa otra pestaña sigue viva, el servidor lo ignora)
        if (j.hasLive === false || j.owner !== liveSource) setLiveRetry((n) => n + 1);
      }).catch(() => {});
    }, 5000);
    return () => clearInterval(iv);
  }, [liveSource]);

  // --- Acciones ---
  const confirmIf = (cond: boolean, text: string) => !cond || window.confirm(text);
  function changeMode(m: GameMode) {
    setMode(m);
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
  function confirmMap(id?: string) {
    if (id) changeMap(id);
    setMapOkFor(draft.id ?? '');
    setSetupOpen(false);
    setMsg('');
  }
  const editMap = () => setMapOkFor('');
  function changeFormat(id: string) {
    if (!confirmIf(draft.history.length > 0, 'Cambiar de formato empieza un draft nuevo y borra el actual. ¿Continuar?')) return false;
    setFormatId(id);
    setDraft(initialDraft(mode, mapId, id));
    setAction('banBlue'); setMsg('');
    return true;
  }
  function doPick(team: Team, id: string): boolean {
    const r = applyPick(draft, team, id);
    if ('error' in r) { setMsg(r.error); setAction(actionFor(draft)); return false; }
    setDraft(r); setAction(actionFor(r));
    const st = ownership[id] ?? 'ok';
    setMsg(team === 'blue' && st !== 'ok' ? `Ojo: ${brawlerById(id)?.name} lo tienes ${st === 'no' ? 'SIN TENER' : 'A BAJO NIVEL'}: rinde menos. Mira las alternativas.` : '');
    return true;
  }
  function doBan(team: Team, id: string): boolean {
    const r = applyBan(draft, team, id);
    if ('error' in r) { setMsg(r.error); return false; }
    setDraft(r); setAction(actionFor(r));
    setMsg(r.bansBlue.includes(id) && r.bansRed.includes(id) ? `🔁 ${brawlerById(id)?.name} lo banearon los dos equipos: ese ban se ha "gastado" doble.` : '');
    return true;
  }
  function doGlobalBan(team: Team, id: string): boolean {
    const r = applyGlobalBan(draft, team, id);
    if ('error' in r) { setMsg(r.error); return false; }
    setDraft(r); setAction(actionFor(r)); setMsg('');
    return true;
  }
  function applyAction(id: string) {
    if (action === 'pickBlue') return doPick('blue', id);
    if (action === 'pickRed') return doPick('red', id);
    if (action === 'banBlue') return doBan('blue', id);
    if (action === 'banRed') return doBan('red', id);
    if (action === 'globalBlue') return doGlobalBan('blue', id);
    return doGlobalBan('red', id);
  }
  // Ban sugerido con un toque: va al equipo que toca (o al que menos bans lleva)
  function banSuggested(id: string) {
    const e = expectedAction(draft);
    if (e.kind === 'globalban') return doGlobalBan(e.team, id);
    if (e.kind === 'ban') return doBan(format.freeOrder && (action === 'banBlue' || action === 'banRed') ? (action === 'banBlue' ? 'blue' : 'red') : e.team, id);
    setMsg('Los baneos ya terminaron.');
    return false;
  }
  const doUndo = () => { const r = undo(draft); setDraft(r); setMsg(''); };
  const doRedo = () => { const r = redo(draft); setDraft(r); setMsg(''); };
  function removePick(team: Team, pid: string) {
    const last = draft.history[draft.history.length - 1];
    if (last?.kind === 'pick' && last.team === team && last.brawlerId === pid) { doUndo(); return; }
    setMsg('Solo se puede quitar el último pick (usa ↩ Deshacer para volver atrás en orden).');
  }
  function setFirstPicker(t: Team) {
    if (picked.length > 0) { setMsg('Los picks ya empezaron: el primer pick no se puede cambiar.'); return; }
    if (format.coinFlip) { if (!draft.coinWinner) setDraft((d) => flipCoin(d, t)); return; }
    setDraft((d) => ({ ...d, coinWinner: t }));
  }
  function reset(ask = true) {
    if (ask && !confirmIf(draft.history.length > 0, '¿Reiniciar el draft? Se perderán los bans y picks actuales.')) return;
    setDraft(initialDraft(mode, mapId, formatId));
    setAction('banBlue'); setMsg('');
  }
  function loadEntry(e: HistoryEntry) {
    if (!confirmIf(draft.history.length > 0, 'Cargar este draft sustituye al actual. ¿Continuar?')) return;
    const mm = MAPS.find((m) => m.id === e.mapId);
    if (!mm || !FORMATS.some((f) => f.id === e.formatId)) { setMsg('Ese draft usa un mapa o formato que ya no existe.'); return; }
    setFormatId(e.formatId); setMapId(mm.id); setMode(mm.mode);
    setDraft({ ...restoreDraft(mm.mode, mm.id, e.formatId, e.coinWinner, e.history), id: e.draftId ?? e.id });
    setMsg('📜 Draft cargado desde el historial.');
  }

  // --- Serie al mejor de 3 ---
  const wins = series.filter((g) => g.result === 'win').length;
  const losses = series.filter((g) => g.result === 'loss').length;
  const seriesOver = wins >= 2 || losses >= 2;
  const gameRecorded = done && series.some((g) => (g.draftId && draft.id ? g.draftId === draft.id : sigOf(g) === sigOf(draft)));
  function recordResult(result: GameResult) {
    if (!done || gameRecorded || seriesOver) return;
    const entry: HistoryEntry = { id: `${Date.now()}`, at: Date.now(), mapId: map.id, formatId, coinWinner: draft.coinWinner, history: draft.history, result, draftId: draft.id };
    setSeries((s) => [...s, entry]);
    setHistory((h) => {
      const sig = sigOf(draft);
      let found = false;
      const next = h.map((e) => {
        if (typeof e === 'string' || found) return e;
        if (e.draftId ? e.draftId === draft.id : sigOf(e) === sig) { found = true; return { ...e, result }; }
        return e;
      });
      return found ? next : [entry, ...h].slice(0, 20);
    });
    setMsg(result === 'win' ? '🏆 Partida ganada registrada en la serie.' : '💀 Partida perdida registrada en la serie.');
  }
  function nextGame() {
    reset(false);
    setSetupOpen(true);
    setMsg(`▶ Partida ${series.length + 1} de la serie.`);
  }
  function newSeries() {
    if (!confirmIf(series.length > 0, '¿Empezar una serie nueva? Se borra el marcador actual.')) return;
    setSeries([]); reset(false); setMsg('Serie nueva: 0 – 0.');
  }

  // --- Colección ---
  const cycleOwnership = (id: string) => setOwnership((o) => {
    const cur = o[id] ?? 'ok';
    const next = cur === 'ok' ? 'low' : cur === 'low' ? 'no' : 'ok';
    const n = { ...o };
    if (next === 'ok') delete n[id]; else n[id] = next;
    return n;
  });
  const setOwn = (id: string, st: Ownership) => setOwnership((o) => { const n = { ...o }; if (st === 'ok') delete n[id]; else n[id] = st; return n; });
  const ownCount = (s: Ownership) => Object.values(ownership).filter((v) => v === s).length;
  const resetOwnership = () => { if (confirmIf(Object.keys(ownership).length > 0, '¿Marcar todos los brawlers como listos?')) setOwnership({}); };

  // --- Exportar / compartir ---
  function summaryText() {
    return `BRAWL DRAFT PRO (catálogo BrawlAPI/Brawlify, ratings de estimación)\nFormato: ${format.name}\nMapa: ${map.name} (${map.mode})\nAzul (FP→LAST): ${draft.picksBlue.map((a) => brawlerById(a)?.name ?? '—').join(' → ')}\nRojo (FP→LAST): ${[...draft.picksRed].reverse().map((a) => brawlerById(a)?.name ?? '—').join(' → ')}\nBans azul: ${draft.bansBlue.map((b) => brawlerById(b)?.name).join(', ') || '-'}\nBans rojo: ${draft.bansRed.map((b) => brawlerById(b)?.name).join(', ') || '-'}\nMi mejor pick: ${brawlerById(recs[0]?.brawlerId ?? null)?.name} (${recs[0]?.score}) — ${recs[0]?.explanation}`;
  }
  function exportSummary() {
    const txt = summaryText();
    navigator.clipboard?.writeText(txt).then(() => setMsg('📋 Resumen copiado al portapapeles.')).catch(() => setMsg(txt));
  }
  const shareUrl = () => `${location.origin}${location.pathname}#d=${encodeDraft(draft)}`;
  async function shareDraft() {
    const url = shareUrl();
    if (navigator.share) {
      try { await navigator.share({ title: 'Brawl Draft Pro', text: `Draft en ${map.name}`, url }); return; } catch { /* cancelado: se copia */ }
    }
    navigator.clipboard?.writeText(url).then(() => setMsg('🔗 Enlace del draft copiado: quien lo abra verá este mismo draft.')).catch(() => setMsg(url));
  }

  // Sugerencia del paso actual (la que aplica Enter): mejor pick azul o mejor ban disponible para quien banea
  function suggestion(): { id: string; label: string } | null {
    if (action === 'pickBlue' && exp.kind === 'pick' && exp.team === 'blue' && recs[0]) return { id: recs[0].brawlerId, label: 'pick azul' };
    if (exp.kind === 'ban' || exp.kind === 'globalban') {
      const team: Team = exp.kind === 'ban' && format.freeOrder ? (action === 'banRed' ? 'red' : 'blue') : exp.team;
      const top = suggestBans(map.id, 12, globalBanned).find((b) => exp.kind === 'globalban' ? !banned.includes(b.brawlerId) : !banBlocked(draft, team, b.brawlerId));
      return top ? { id: top.brawlerId, label: exp.kind === 'globalban' ? `ban global ${team === 'blue' ? 'azul' : 'rojo'}` : `ban ${team === 'blue' ? 'azul' : 'rojo'}` } : null;
    }
    return null;
  }
  function applySuggestion() {
    const sg = suggestion();
    if (!sg) { setMsg('No hay sugerencia automática para este paso (marca el pick del rival tocándolo).'); return; }
    if (exp.kind === 'pick') doPick('blue', sg.id);
    else if (exp.kind === 'globalban') doGlobalBan(exp.team, sg.id);
    else doBan(format.freeOrder ? (action === 'banRed' ? 'red' : 'blue') : (exp.kind === 'ban' ? exp.team : 'blue'), sg.id);
  }

  // --- Voz: «banea Piper», «pick rojo Mortis», «nosotros El Primo», «deshacer», «el sugerido» ---
  const voiceRoster = useMemo(() => ALL.map((b) => ({ id: b.id, name: b.name })), [ALL]);
  function handleVoice(alternatives: string[]) {
    const said = alternatives[0] ?? '';
    // Usa la primera alternativa del reconocedor que se entienda
    const cmd = alternatives.map((t) => parseVoice(t, voiceRoster)).find((c) => c.type !== 'none') ?? parseVoice(said, voiceRoster);
    const report = (result: string, ok: boolean, say?: string) => {
      setLastVoice({ heard: said, result, ok });
      if (voiceFeedback && say) speak(say);
    };
    if (cmd.type === 'none') { report(cmd.reason, false, 'No te he entendido'); return; }
    if (cmd.type === 'undo') { doUndo(); report('↩ Deshecho', true, 'Deshecho'); return; }
    if (cmd.type === 'redo') { doRedo(); report('↪ Rehecho', true, 'Rehecho'); return; }
    if (cmd.type === 'suggest') {
      const sg = suggestion();
      if (!sg) { report('No hay sugerencia para este paso.', false, 'No hay sugerencia'); return; }
      applySuggestion();
      report(`⏎ ${brawlerById(sg.id)?.name} (${sg.label})`, true, `${brawlerById(sg.id)?.name}, ${sg.label}`);
      return;
    }
    const e = expectedAction(draft);
    const actTeam: Team = action.endsWith('Blue') ? 'blue' : 'red';
    // Lo que no se dice se completa con el paso actual (o con la acción seleccionada en los bans simultáneos)
    const kind = cmd.kind ?? (cmd.team ? (e.kind === 'pick' || e.kind === 'done' ? 'pick' : 'ban') : null);
    const name = brawlerById(cmd.brawlerId)?.name ?? cmd.brawlerId;
    let ok: boolean;
    let label: string;
    if (!kind) {
      ok = !!applyAction(cmd.brawlerId);
      label = action.startsWith('pick') ? `pick ${actTeam === 'blue' ? 'azul' : 'rojo'}` : action.startsWith('ban') ? `ban ${actTeam === 'blue' ? 'azul' : 'rojo'}` : 'ban global';
    } else if (kind === 'pick') {
      const team = cmd.team ?? (e.kind === 'pick' ? e.team : actTeam);
      ok = doPick(team, cmd.brawlerId);
      label = `pick ${team === 'blue' ? 'azul' : 'rojo'}`;
    } else {
      const team = cmd.team ?? (e.kind === 'globalban' ? e.team : format.freeOrder && action.startsWith('ban') ? actTeam : e.kind === 'ban' ? e.team : actTeam);
      ok = e.kind === 'globalban' ? doGlobalBan(team, cmd.brawlerId) : doBan(team, cmd.brawlerId);
      label = `${e.kind === 'globalban' ? 'ban global' : 'ban'} ${team === 'blue' ? 'azul' : 'rojo'}`;
    }
    report(ok ? `✅ ${name} → ${label}` : `❌ ${name}: no se pudo (${label})`, ok, ok ? `${name}, ${label}` : `No se puede, ${name}`);
  }

  const unavailable = (id: string) => (action === 'banBlue' || action === 'banRed') && banPhase
    ? banBlocked(draft, action === 'banBlue' ? 'blue' : 'red', id)
    : banned.includes(id) || picked.includes(id);
  const pickChipLocked = (a: Action) => (a === 'pickBlue' || a === 'pickRed') && !draft.freeMode
    && (picksLocked || (exp.kind === 'pick' && exp.team !== (a === 'pickBlue' ? 'blue' : 'red')));

  return {
    ALL, mode, mapId, map, formatId, format, draft, setDraft, exp, weights, setWeights, compare, setCompare,
    favorites, setFavorites, history, series, msg, setMsg, blindHide, setBlindHide, mySlot, setMySlot,
    ownership, action, setAction, timerOn, setTimerOn, setupOpen, setSetupOpen, realStats, realMap,
    globalBanned, banned, picked, allies, enemies, setBansDone, setBansTotal, banPhase, picksLocked, done, maskRival, doubleBans,
    recs, threats, vd, avoid, suggestedBans,
    stepSeconds, secondsLeft, timerActive, restartTimer,
    wins, losses, seriesOver, gameRecorded, recordResult, nextGame, newSeries,
    mapConfirmed, flowStep, confirmMap, editMap,
    changeMode, changeMap, changeFormat, doPick, doBan, doGlobalBan, applyAction, banSuggested, doUndo, doRedo, removePick,
    setFirstPicker, reset, loadEntry, cycleOwnership, setOwn, ownCount, resetOwnership, exportSummary, shareDraft,
    unavailable, pickChipLocked, flipCoin, suggestion, applySuggestion,
    handleVoice, lastVoice, voiceFeedback, setVoiceFeedback,
    autoDetect, setAutoDetect, phoneViewers
  };
}

export type AppCtx = ReturnType<typeof useDraftApp>;
export const AppContext = createContext<AppCtx | null>(null);
export function useApp(): AppCtx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp fuera de AppContext');
  return ctx;
}
