import type { ShotSpec } from './projectiles'
import type { ToolId } from './toolDefs'

/**
 * How each firearm behaves. Every gun has its own job:
 * spread grows while you hold the trigger ("bloom") and settles when you stop.
 */
export type GunDef = {
  shot: ShotSpec
  pellets: number
  noise: number
  /** Recoil shove on the arms and camera, 0..1. */
  kick: number
  /** Screen shake added per shot, 0..1. */
  shake: number
  bloomPerShot: number
  ejectsShell: boolean
}

export const MAX_BLOOM = 0.14
export const BLOOM_RECOVERY_PER_SECOND = 0.35

export const GUNS: Partial<Record<ToolId, GunDef>> = {
  pistol: {
    shot: { kind: 'bullet', fromPlayer: true, speed: 75, damage: 40, tileDamage: 3, spread: 0.008, push: 2 },
    pellets: 1, noise: 4, kick: 0.5, shake: 0.03, bloomPerShot: 0.02, ejectsShell: true,
  },
  rifle: {
    shot: { kind: 'bullet', fromPlayer: true, speed: 80, damage: 26, tileDamage: 12, spread: 0.02, push: 3 },
    pellets: 1, noise: 30, kick: 0.45, shake: 0.1, bloomPerShot: 0.016, ejectsShell: true,
  },
  shotgun: {
    shot: { kind: 'bullet', fromPlayer: true, speed: 65, damage: 17, tileDamage: 16, spread: 0.13, push: 7, life: 0.22 },
    pellets: 9, noise: 34, kick: 1, shake: 0.4, bloomPerShot: 0.03, ejectsShell: true,
  },
  sniper: {
    shot: { kind: 'bullet', fromPlayer: true, speed: 150, damage: 160, tileDamage: 70, spread: 0, push: 12 },
    pellets: 1, noise: 40, kick: 1, shake: 0.45, bloomPerShot: 0.08, ejectsShell: true,
  },
  rocket: {
    shot: { kind: 'rocket', fromPlayer: true, speed: 30, damage: 0, tileDamage: 0, spread: 0.02, push: 0 },
    pellets: 1, noise: 22, kick: 0.8, shake: 0.2, bloomPerShot: 0, ejectsShell: false,
  },
}
