import type { Placement, Point, TowerKind } from './types'

export const TOWER_VISUAL_SCALE = 0.5

export type TowerMuzzle = {
  /** Horizontal distance from the tower pivot to the visible barrel tip. */
  forward: number
  /** World-space height of the barrel tip. */
  height: number
  color: string
}

const MUZZLES: Record<TowerKind, TowerMuzzle> = {
  gunner: { forward: 0.56, height: 0.31, color: '#ffd05a' },
  heavyGun: { forward: 0.56, height: 0.31, color: '#ff9a32' },
  cannon: { forward: 0.56, height: 0.31, color: '#ffad3d' },
  rocket: { forward: 0.45, height: 0.31, color: '#ff7840' },
  flamethrower: { forward: 0.5, height: 0.31, color: '#ff5b2e' },
  cryo: { forward: 0.56, height: 0.31, color: '#a8f4ff' },
  tesla: { forward: 0, height: 0.62, color: '#c5a4ff' },
  laser: { forward: 0.52, height: 0.31, color: '#ff5e66' },
  mortar: { forward: 0.33, height: 0.55, color: '#ffc06a' },
  support: { forward: 0, height: 0.65, color: '#7be6a4' },
}

export function getTowerMuzzle(kind: TowerKind): TowerMuzzle {
  return MUZZLES[kind]
}

/** Uses the acquired target direction because the weapon mount rotates inside its locked firing sector. */
export function towerMuzzlePoint(tower: Placement & { kind: TowerKind }, target: Point): Point & { y: number } {
  const muzzle = getTowerMuzzle(tower.kind)
  const dx = target.x - tower.x
  const dz = target.z - tower.z
  const length = Math.hypot(dx, dz)
  const directionX = length > 0.001 ? dx / length : Math.cos(tower.rotation ?? 0)
  const directionZ = length > 0.001 ? dz / length : Math.sin(tower.rotation ?? 0)
  return { x: tower.x + directionX * muzzle.forward, z: tower.z + directionZ * muzzle.forward, y: muzzle.height }
}
