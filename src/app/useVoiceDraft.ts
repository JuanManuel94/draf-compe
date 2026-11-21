import { useEffect, useRef, useState } from 'react';
import { useApp } from './useDraftApp';
import { useDictation } from './useSpeech';
import { brawlerById } from '../engine/scoring';
import { store } from '../engine/storage';
import { bestReading, closestBrawlers, voiceLeftover } from '../engine/voice';
import type { Team } from '../types';

// Voz para el draft (vista rápida y vista normal): mantén pulsado 🎤, di uno o varios brawlers
// («Colt Piper Bull», «rival Mortis», «Star Nova el primo», «deshacer») y suelta.
// Cada nombre se aplica al paso que toca, uno detrás de otro, con vibración de confirmación.
type VoiceItem = { id: string; team: Team | null };
type VoiceLogEntry = { at: string; step: string; heard: string[]; got: string[]; left: string[] };
const VOICE_LOG = 'voiceLog';
export const readVoiceLog = (): VoiceLogEntry[] => store.load<VoiceLogEntry[]>(VOICE_LOG, []);
export function voiceLogText(): string {
  return readVoiceLog().map((e) => `[${e.at} · ${e.step}] oído: ${e.heard.map((h) => `«${h}»`).join(' / ')} → ${e.got.join(', ') || 'nada'}${e.left.length ? ` · sin entender: ${e.left.join(', ')}` : ''}`).join('\n');
}

export function useVoiceDraft() {
  const a = useApp();
  const [queue, setQueue] = useState<VoiceItem[]>([]);
  const [line, setLine] = useState<{ text: string; ok: boolean | null } | null>(null);
  const [guesses, setGuesses] = useState<string[]>([]);
  const results = useRef<string[]>([]);
  const failed = useRef(false);
  const pressAt = useRef(0);
  const tapMode = useRef(false);
  const hideT = useRef<number | undefined>(undefined);

  const show = (text: string, ok: boolean | null, hide = true) => {
    setLine({ text, ok });
    window.clearTimeout(hideT.current);
    if (hide) hideT.current = window.setTimeout(() => setLine(null), 5000);
  };
  const buzz = (ok: boolean) => { try { navigator.vibrate?.(ok ? 35 : [70, 50, 70]); } catch { /* sin vibración */ } };
  // Se busca entre TODOS los brawlers: si dices uno ya usado, se avisa en vez de cambiarlo por otro parecido
  const roster = () => a.ALL.map((b) => ({ id: b.id, name: b.name }));
  const available = (id: string) => !a.picked.includes(id) && (a.banPhase || !a.banned.includes(id));

  function onDone(readings: string[]) {
    const r = roster();
    const { text: heard, cmds } = bestReading(readings, r);
    const said = cmds.flatMap((c) => (c.type === 'apply' ? [{ id: c.brawlerId, team: c.team }] : []));
    const items = said.filter((i) => available(i.id));
    const taken = said.filter((i) => !available(i.id)).map((i) => brawlerById(i.id)?.name ?? i.id);
    const left = voiceLeftover(heard, cmds);
    // Registro para revisar después qué se oyó y qué se entendió (se puede copiar desde el menú)
    const log = readVoiceLog();
    log.unshift({ at: new Date().toLocaleTimeString(), step: a.flowStep, heard: readings.slice(0, 3), got: items.map((i) => brawlerById(i.id)?.name ?? i.id), left });
    store.save(VOICE_LOG, log.slice(0, 60));
    // Lo que no se entendió → los brawlers más parecidos, para tocarlos
    setGuesses(left.length ? [...new Set(left.flatMap((w) => closestBrawlers(w, r.filter((b) => available(b.id)), 3)))].filter((id) => !items.some((i) => i.id === id)).slice(0, 4) : []);
    if (cmds.some((c) => c.type === 'undo')) { a.doUndo(); buzz(true); show(`«${heard}» → ↩ deshecho`, true); return; }
    if (cmds.some((c) => c.type === 'redo')) { a.doRedo(); buzz(true); show(`«${heard}» → ↪ rehecho`, true); return; }
    const takenMsg = taken.length ? `✗ ${taken.join(', ')} ya no está${taken.length > 1 ? 'n' : ''} disponible${taken.length > 1 ? 's' : ''}` : '';
    if (items.length === 0) {
      if (cmds.some((c) => c.type === 'suggest')) { a.applySuggestion(); buzz(true); show(`«${heard}» → sugerido`, true); return; }
      buzz(false); show(takenMsg || `«${heard}»: no reconocí ningún brawler`, false); return;
    }
    results.current = []; failed.current = left.length > 0 || taken.length > 0;
    if (takenMsg) results.current.push(takenMsg);
    if (left.length) results.current.push(`❓ «${left.join(' / ')}»`);
    setQueue(items);
  }
  const sp = useDictation(onDone);

  // Se aplica un nombre por render: cada paso parte del draft ya actualizado por el anterior
  useEffect(() => {
    if (queue.length === 0) return;
    const [c, ...rest] = queue;
    const ok = c.team
      ? (a.exp.kind === 'globalban' ? a.doGlobalBan(c.team, c.id) : a.exp.kind === 'ban' ? a.doBan(c.team, c.id) : a.doPick(c.team, c.id))
      : !!a.applyAction(c.id);
    results.current.splice(results.current.length - (results.current[results.current.length - 1]?.startsWith('❓') ? 1 : 0), 0, `${ok ? '✓' : '✗'} ${brawlerById(c.id)?.name ?? c.id}`);
    if (!ok) failed.current = true;
    if (rest.length === 0) { buzz(!failed.current); show(results.current.join(' · '), !failed.current); }
    setQueue(rest);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue]);

  useEffect(() => {
    if (sp.listening) show(sp.interim ? `🎙️ «${sp.interim}»` : tapMode.current ? '🎙️ Escuchando… toca ⏹ al terminar' : '🎙️ Escuchando… di los brawlers y suelta', null, false);
    else if (sp.error) show(sp.error, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp.listening, sp.interim, sp.error]);

  // Modo toque: termina solo cuando llevas 2,5 s sin decir nada nuevo (u 8 s sin decir nada)
  const endRef = useRef(sp.end);
  endRef.current = sp.end;
  useEffect(() => {
    if (!sp.listening || !tapMode.current) return;
    const t = window.setTimeout(() => endRef.current(), sp.interim ? 2500 : 8000);
    return () => window.clearTimeout(t);
  }, [sp.listening, sp.interim]);

  return {
    supported: sp.supported,
    listening: sp.listening,
    line,
    guesses,
    clearGuesses: () => setGuesses([]),
    pickGuess: (id: string) => { if (a.applyAction(id)) { buzz(true); show(`✓ ${brawlerById(id)?.name}`, true); } setGuesses((g) => g.filter((x) => x !== id)); },
    // Mantener pulsado: escucha todo lo que digas (aunque hagas pausas) y aplica al soltar.
    // Toque corto: escucha hasta que tocas ⏹ o te callas 2,5 s.
    down: (e: React.PointerEvent) => {
      e.preventDefault();
      if (sp.listening) { sp.end(); pressAt.current = 0; return; }
      pressAt.current = Date.now(); tapMode.current = false; setGuesses([]);
      sp.begin(true);
    },
    up: () => {
      if (!pressAt.current) return;
      if (Date.now() - pressAt.current > 400) sp.end(); else { tapMode.current = true; show('🎙️ Escuchando… toca ⏹ al terminar', null, false); }
      pressAt.current = 0;
    },
    // Tecla V: empieza a escuchar (modo toque) o termina
    toggle: () => {
      if (sp.listening) { sp.end(); return; }
      tapMode.current = true; setGuesses([]);
      sp.begin(true);
    }
  };
}
export type VoiceDraft = ReturnType<typeof useVoiceDraft>;
