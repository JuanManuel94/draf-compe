import { useState } from 'react';
import { modeInfo } from '../data/modes';
import type { Brawler } from '../types';

export function Bar({ v, c, label }: { v: number; c: string; label?: string }) {
  return (
    <div className="dd-bar" role={label ? 'meter' : undefined} aria-label={label} aria-valuenow={label ? Math.round(v) : undefined} aria-valuemin={label ? 0 : undefined} aria-valuemax={label ? 100 : undefined}>
      <div className="dd-bar-fill" style={{ width: `${Math.max(0, Math.min(100, v))}%`, background: c }} />
    </div>
  );
}

export function BrawlerImg({ b, size }: { b: Brawler; size: string }) {
  const [err, setErr] = useState(false);
  if (!b.image || err) return <span className={size}>{b.emoji}</span>;
  return <img src={b.image} alt={b.name} loading="lazy" onError={() => setErr(true)} className={`${size} object-contain mx-auto`} draggable={false} />;
}

export function MapImg({ src, name, cls }: { src?: string; name: string; cls: string }) {
  const [err, setErr] = useState(false);
  if (!src || err) return null;
  return <img src={src} alt={name} loading="lazy" onError={() => setErr(true)} className={cls} draggable={false} />;
}

// Icono oficial del modo de juego (con el emoji de reserva si la imagen no carga)
export function ModeIcon({ mode, size = 22, cls = '' }: { mode: string; size?: number; cls?: string }) {
  const [err, setErr] = useState(false);
  const m = modeInfo(mode);
  if (!m.icon || err) return <span className={`dd-mode-icon ${cls}`} style={{ fontSize: size * 0.8, width: size, height: size }} aria-hidden="true">{m.emoji}</span>;
  return <img src={m.icon} alt="" aria-hidden="true" onError={() => setErr(true)} className={`dd-mode-icon ${cls}`} style={{ width: size, height: size }} draggable={false} />;
}

export const scoreClass =(v: number) => (v >= 70 ? 'good' : v >= 50 ? 'mid' : 'bad');
export const scoreColor = (v: number) => (v >= 70 ? '#2ecc71' : v >= 50 ? '#f1c40f' : '#e74c3c');
// Búsqueda sin tildes ni mayúsculas ("pipér" encuentra a Piper)
export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
