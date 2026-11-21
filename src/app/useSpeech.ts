import { useCallback, useEffect, useRef, useState } from 'react';

// Web Speech API (Chrome, Edge, Safari). Firefox no la tiene y Brave la expone pero falla con "network".
type SR = {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type SRCtor = new () => SR;
const getSR = (): SRCtor | null => {
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

const ERRORS: Record<string, string> = {
  'not-allowed': 'Permiso de micrófono denegado: actívalo en el candado de la barra de direcciones.',
  'service-not-allowed': 'El navegador no permite el reconocimiento de voz en esta página.',
  network: 'El reconocimiento de voz necesita el servicio online del navegador. En Brave no funciona: usa Chrome o Edge.',
  'no-speech': 'No he oído nada. Pulsa 🎤 y di, por ejemplo, «banea Piper».',
  'audio-capture': 'No se encuentra ningún micrófono.',
  aborted: ''
};

export function useSpeech(onFinal: (alternatives: string[]) => void) {
  const supported = typeof window !== 'undefined' && !!getSR();
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const recRef = useRef<SR | null>(null);
  const cbRef = useRef(onFinal);
  cbRef.current = onFinal;

  const stop = useCallback(() => { recRef.current?.abort(); recRef.current = null; setListening(false); }, []);
  const start = useCallback(() => {
    const Ctor = getSR();
    if (!Ctor) { setError('Tu navegador no tiene reconocimiento de voz: usa Chrome, Edge o Safari.'); return; }
    if (recRef.current) { stop(); return; }
    const rec = new Ctor();
    rec.lang = 'es-ES';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 4;
    rec.onresult = (e) => {
      const last = e.results[e.results.length - 1];
      if (last.isFinal) {
        const alts = Array.from({ length: last.length }, (_, i) => last[i].transcript.trim()).filter(Boolean);
        setInterim(alts[0] ?? '');
        cbRef.current(alts);
      } else setInterim(last[0].transcript);
    };
    rec.onerror = (e) => { const m = ERRORS[e.error] ?? `Error de voz: ${e.error}`; if (m) setError(m); };
    rec.onend = () => { recRef.current = null; setListening(false); };
    recRef.current = rec;
    setError(''); setInterim(''); setListening(true);
    try { rec.start(); } catch { setListening(false); recRef.current = null; }
  }, [stop]);
  // Termina de escuchar y entrega lo dicho (al soltar el botón de mantener pulsado)
  const finish = useCallback(() => { try { recRef.current?.stop(); } catch { /* ya terminó */ } }, []);
  useEffect(() => () => recRef.current?.abort(), []);
  return { supported, listening, interim, error, start, stop, finish };
}

// Une los resultados finales de una sesión. Chrome en Android a veces repite el texto acumulado
// («colt», «colt piper», «colt piper bull»): si un trozo empieza por lo anterior, lo sustituye.
export function joinFinals(parts: string[]): string {
  let acc = '';
  for (const raw of parts) {
    const t = raw.trim();
    if (!t) continue;
    if (!acc || t.toLowerCase().startsWith(acc.toLowerCase())) acc = t;
    else if (!acc.toLowerCase().endsWith(t.toLowerCase())) acc = `${acc} ${t}`;
  }
  return acc;
}

const speechLang = () => (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('es') ? navigator.language : 'es-ES');

// Dictado para la vista rápida.
// - Mantener pulsado: escucha sin cortarse en las pausas (si el reconocedor se detiene, se reinicia solo)
//   y al soltar entrega TODO lo dicho: «Colt… Piper… Bull» llega entero.
// - Toque corto: escucha hasta que te callas.
// Entrega varias lecturas posibles de la frase (la principal primero) para elegir la que mejor encaja.
export function useDictation(onDone: (readings: string[]) => void) {
  const supported = typeof window !== 'undefined' && !!getSR();
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const cbRef = useRef(onDone);
  cbRef.current = onDone;
  const s = useRef({ rec: null as SR | null, holding: false, active: false, sessions: [] as string[], current: [] as string[], alts: [] as string[], live: '', restarts: 0 });

  const deliver = useCallback(() => {
    const st = s.current;
    st.active = false;
    setListening(false);
    const main = [...st.sessions, joinFinals(st.current)].filter(Boolean).join(' ').trim() || st.live.trim();
    const readings = [main, ...(st.sessions.length === 0 ? st.alts.slice(1) : [])].filter((r, i, arr) => r && arr.indexOf(r) === i);
    if (readings.length) cbRef.current(readings);
  }, []);

  const startRec = useCallback(() => {
    const Ctor = getSR();
    const st = s.current;
    if (!Ctor) { setError('Tu navegador no tiene reconocimiento de voz: usa Chrome.'); st.active = false; setListening(false); return; }
    const rec = new Ctor();
    rec.lang = speechLang();
    rec.interimResults = true;
    rec.continuous = st.holding;
    rec.maxAlternatives = 5;
    st.current = [];
    rec.onresult = (e) => {
      const finals: string[] = [];
      let partial = '';
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finals.push(r[0].transcript); else partial += ` ${r[0].transcript}`;
      }
      st.current = finals;
      if (e.results.length === 1 && e.results[0].isFinal) st.alts = Array.from({ length: e.results[0].length }, (_, i) => e.results[0][i].transcript.trim()).filter(Boolean);
      st.live = [...st.sessions, joinFinals(finals), partial.trim()].filter(Boolean).join(' ');
      setInterim(st.live);
    };
    rec.onerror = (e) => {
      // Mientras se mantiene pulsado, el silencio no es un error: se sigue escuchando
      if (st.holding && (e.error === 'no-speech' || e.error === 'aborted')) return;
      const m = ERRORS[e.error] ?? `Error de voz: ${e.error}`;
      if (m) setError(m);
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture' || e.error === 'network') st.holding = false;
    };
    rec.onend = () => {
      const fin = joinFinals(st.current);
      if (fin) st.sessions.push(fin);
      st.current = [];
      st.rec = null;
      if (st.holding && st.active && st.restarts < 20) { st.restarts++; startRec(); return; }
      deliver();
    };
    st.rec = rec;
    try { rec.start(); } catch { st.rec = null; deliver(); }
  }, [deliver]);

  const begin = useCallback((hold: boolean) => {
    const st = s.current;
    if (st.active) { st.holding = false; st.rec?.stop(); return; }
    Object.assign(st, { holding: hold, active: true, sessions: [], current: [], alts: [], live: '', restarts: 0 });
    setError(''); setInterim(''); setListening(true);
    startRec();
  }, [startRec]);
  // Al soltar: deja de reiniciar y pide al reconocedor el resultado final de lo último dicho
  const end = useCallback(() => {
    const st = s.current;
    st.holding = false;
    try { st.rec?.stop(); } catch { deliver(); }
    if (!st.rec && st.active) deliver();
  }, [deliver]);
  const cancel = useCallback(() => { const st = s.current; st.holding = false; st.active = false; st.rec?.abort(); setListening(false); }, []);
  useEffect(() => () => s.current.rec?.abort(), []);
  return { supported, listening, interim, error, begin, end, cancel };
}

export function speak(text: string) {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'es-ES';
  u.rate = 1.15;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}
