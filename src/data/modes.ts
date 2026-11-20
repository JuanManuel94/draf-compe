import type { GameMode } from '../types';

// Icono y color oficiales de cada modo (los del juego), tomados de BrawlAPI/Brawlify
// (api.brawlapi.com/v1/gamemodes, imágenes © Supercell). El emoji solo se usa si la imagen no carga.
export interface ModeInfo { en: string; scId: number; icon: string; color: string; emoji: string }

const icon = (scId: number) => `https://cdn.brawlify.com/game-modes/regular/${scId}.png`;

export const MODE_INFO: Record<GameMode, ModeInfo> = {
  'Atrapagemas': { en: 'Gem Grab', scId: 48000000, icon: icon(48000000), color: '#d852ff', emoji: '💎' },
  'Zona Restringida': { en: 'Hot Zone', scId: 48000017, icon: icon(48000017), color: '#ff4343', emoji: '🚩' },
  'Noqueo': { en: 'Knockout', scId: 48000020, icon: icon(48000020), color: '#fd9b0e', emoji: '🎯' },
  'Atraco': { en: 'Heist', scId: 48000002, icon: icon(48000002), color: '#e35bd8', emoji: '💰' },
  'Caza Estelar': { en: 'Bounty', scId: 48000003, icon: icon(48000003), color: '#24d6ff', emoji: '⭐' },
  'Balón Brawl': { en: 'Brawl Ball', scId: 48000005, icon: icon(48000005), color: '#9ab1fd', emoji: '⚽' }
};

export const modeInfo = (mode: string): ModeInfo =>
  MODE_INFO[mode as GameMode] ?? { en: mode, scId: 0, icon: '', color: '#9aa0c8', emoji: '🗺️' };
