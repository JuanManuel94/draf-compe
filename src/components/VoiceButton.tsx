import { forwardRef, useImperativeHandle } from 'react';
import { useApp } from '../app/useDraftApp';
import { useSpeech } from '../app/useSpeech';

export type VoiceHandle = { toggle: () => void };

// Botón de pick por voz: «banea Piper», «pick rojo Mortis», «nosotros El Primo», «deshacer», «el sugerido»
export const VoiceButton = forwardRef<VoiceHandle>(function VoiceButton(_, ref) {
  const a = useApp();
  const sp = useSpeech(a.handleVoice);
  useImperativeHandle(ref, () => ({ toggle: sp.start }), [sp.start]);
  const status = sp.listening ? (sp.interim ? `«${sp.interim}»` : 'Escuchando…') : sp.error || (a.lastVoice ? `«${a.lastVoice.heard}» → ${a.lastVoice.result}` : '');
  return (
    <div className="dd-voice">
      <button className={`dd-voice-btn ${sp.listening ? 'on' : ''}`} onClick={sp.start} disabled={!sp.supported}
        aria-pressed={sp.listening} aria-label={sp.listening ? 'Parar el dictado' : 'Dictar acción por voz (tecla V)'}
        title={sp.supported ? 'Pick por voz (tecla V): «banea Piper», «pick rojo Mortis», «nosotros El Primo», «deshacer»' : 'Tu navegador no tiene reconocimiento de voz: usa Chrome, Edge o Safari'}>
        {sp.listening ? '⏹' : '🎤'}
      </button>
      <span className={`dd-voice-status ${sp.error ? 'err' : a.lastVoice && !sp.listening ? (a.lastVoice.ok ? 'ok' : 'err') : ''}`} aria-live="polite">
        {sp.supported ? status || 'Di «banea Piper» o «pick rojo Mortis»' : 'Voz no disponible en este navegador'}
      </span>
    </div>
  );
});
