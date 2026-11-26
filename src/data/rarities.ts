import type { Rarity } from './types';

export interface RarityDef {
  id: Rarity;
  name: string;
  weight: number;
  power: number;
  color: number;
  css: string;
  tier: number;
}

export const RARITIES: Record<Rarity, RarityDef> = {
  common: { id: 'common', name: 'Common', weight: 55, power: 1, color: 0x9aa3b5, css: '#9aa3b5', tier: 0 },
  uncommon: { id: 'uncommon', name: 'Uncommon', weight: 26, power: 1.35, color: 0x5fd38d, css: '#5fd38d', tier: 1 },
  rare: { id: 'rare', name: 'Rare', weight: 12, power: 1.75, color: 0x4fa8ff, css: '#4fa8ff', tier: 2 },
  epic: { id: 'epic', name: 'Epic', weight: 5.5, power: 2.3, color: 0xb05cff, css: '#b05cff', tier: 3 },
  legendary: { id: 'legendary', name: 'Legendary', weight: 1.5, power: 3, color: 0xffb340, css: '#ffb340', tier: 4 },
};

export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
