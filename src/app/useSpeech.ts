import { useCallback, useEffect, useRef, useState } from 'react';

// Web Speech API (Chrome, Edge, Safari). Firefox no la tiene y Brave la expone pero falla con "network".
type SR = {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  start(): void; abort(): void;
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
  useEffect(() => () => recRef.current?.abort(), []);
  return { supported, listening, interim, error, start, stop };
}

export function speak(text: string) {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'es-ES';
  u.rate = 1.15;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}
