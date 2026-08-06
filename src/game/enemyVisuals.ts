import type { EnemyKind } from './types'

export type EnemyAccessory = 'shield' | 'plateShell' | 'spiritOrb' | 'warBanner' | 'bombPack' | 'rageHorns'
export const ENEMY_VISUALS: Record<EnemyKind, { identity: string; scale: number; accessory?: EnemyAccessory }> = {
  grunt: { identity: 'plain-infantry', scale: 0.62 },
  runner: { identity: 'small-runner', scale: 0.48 },
  brute: { identity: 'large-brute', scale: 0.92 },
  shieldbearer: { identity: 'front-shield', scale: 0.62, accessory: 'shield' },
  armored: { identity: 'full-plate-shell', scale: 0.62, accessory: 'plateShell' },
  shaman: { identity: 'floating-spirit-orb', scale: 0.62, accessory: 'spiritOrb' },
  banner: { identity: 'tall-war-banner', scale: 0.62, accessory: 'warBanner' },
  sapper: { identity: 'bomb-pack', scale: 0.55, accessory: 'bombPack' },
  berserker: { identity: 'rage-horns', scale: 0.62, accessory: 'rageHorns' },
  ogre: { identity: 'boss-ring-and-health', scale: 1.35 },
}

export function getEnemyVisualScale(kind: EnemyKind): number { return ENEMY_VISUALS[kind].scale }
export function hasEnemyAccessory(kind: EnemyKind): boolean { return ENEMY_VISUALS[kind].accessory !== undefined }
