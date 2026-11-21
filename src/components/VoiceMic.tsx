import { forwardRef, useImperativeHandle } from 'react';
import { useApp } from '../app/useDraftApp';
import { useDictation } from '../app/useSpeech';
import { useVoiceDraft, type VoiceDraft } from '../app/useVoiceDraft';
import { brawlerById } from '../engine/scoring';
import { BrawlerImg } from './ui';

// Botón 🎤 del draft por voz: mantén pulsado y di los brawlers; suelta para aplicarlos.
export function VoiceMic({ voice, cls = '' }: { voice: VoiceDraft; cls?: string }) {
  if (!voice.supported) return null;
  return (
    <button type="button" className={`qv-mic ${cls} ${voice.listening ? 'on' : ''}`}
      aria-label={voice.listening ? 'Escuchando: suelta (o toca) para terminar' : 'Mantén pulsado y di los brawlers'}
      title="Mantén pulsado y di los brawlers: «Colt Piper Bull», «rival Mortis», «deshacer». Tecla V."
      onPointerDown={voice.down} onPointerUp={voice.up} onPointerCancel={voice.up} onContextMenu={(e) => e.preventDefault()}>
      {voice.listening ? '⏹' : '🎤'}
    </button>
  );
}

// Lo que se oyó / aplicó y, si algo no se entendió, «¿Quisiste decir?» con los más parecidos
export function VoiceFeedback({ voice }: { voice: VoiceDraft }) {
  return (
    <>
      {voice.line && <div className={`qv-voice ${voice.line.ok === false ? 'err' : voice.line.ok ? 'ok' : ''}`} aria-live="polite">{voice.line.text}</div>}
      {voice.guesses.length > 0 && (
        <div className="qv-guess">
          <span>¿Quisiste decir?</span>
          {voice.guesses.map((id) => {
            const b = brawlerById(id);
            return b && <button key={id} type="button" className="qv-guess-b" onClick={() => voice.pickGuess(id)}><span className="qv-b-img"><BrawlerImg b={b} size="w-full h-full" /></span>{b.name}</button>;
          })}
          <button type="button" className="qv-guess-x" onClick={voice.clearGuesses} aria-label="Cerrar sugerencias">✕</button>
        </div>
      )}
    </>
  );
}

// Bloque completo (micrófono + ayuda + respuesta) para la vista normal. Tecla V lo activa.
export type VoiceHandle = { toggle: () => void };
export const VoiceDraftBar = forwardRef<VoiceHandle>(function VoiceDraftBar(_, ref) {
  const voice = useVoiceDraft();
  useImperativeHandle(ref, () => ({ toggle: voice.toggle }), [voice.toggle]);
  if (!voice.supported) return <p className="dd-muted small">🎤 La voz necesita Chrome (en Brave no funciona).</p>;
  return (
    <div className="dd-voicebar">
      <div className="dd-voicebar-row">
        <VoiceMic voice={voice} />
        <span className="dd-muted small">Mantén pulsado y di los brawlers seguidos: <b>«Colt Piper Bull»</b>, <b>«rival Mortis Emz Tara»</b>, <b>«deshacer»</b>.</span>
      </div>
      <VoiceFeedback voice={voice} />
    </div>
  );
});

// 🎙️ pequeño para dictar en un buscador: escucha, interpreta lo dicho con `resolve` y lo escribe en el campo
export function VoiceFill({ onText, resolve, label = 'Buscar por voz' }: { onText: (t: string) => void; resolve?: (heard: string) => string | null; label?: string }) {
  const a = useApp();
  const sp = useDictation((readings) => {
    for (const r of readings) { const v = resolve ? resolve(r) : r; if (v) { onText(v); return; } }
    a.setMsg(`🎙️ No encontré «${readings[0]}». Prueba otra vez.`);
  });
  if (!sp.supported) return null;
  return (
    <button type="button" className={`dd-voicefill ${sp.listening ? 'on' : ''}`} aria-label={sp.listening ? 'Escuchando… toca para terminar' : label} title={label}
      onClick={() => (sp.listening ? sp.end() : sp.begin(false))}>{sp.listening ? '⏹' : '🎙️'}</button>
  );
}
