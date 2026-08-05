import type { DamageSource, DamageType, EnemyKind, GameRules, Point, TowerKind } from './types'

export const DAMAGE_SOURCE_LABELS: Record<DamageSource, string> = {
  gunner: 'Rivet Gun', heavyGun: 'Heavy Gun', cannon: 'Blast Cannon', rocket: 'Rocket Battery',
  flamethrower: 'Flame Thrower', cryo: 'Cryo Projector', tesla: 'Tesla Coil', laser: 'Laser Lance',
  mortar: 'Field Mortar', support: 'Support Beacon', strafe: 'Strafe', barrage: 'Barrage',
  cryoBeam: 'Cryo Beam', nuke: 'Tactical Nuke', orbitalLaser: 'Orbital Laser', repair: 'Emergency Repair',
  wallSpikes: 'Wall Spikes', wallExplosion: 'Wall Explosion',
}

export function createEmptyDamageBySource(): Record<DamageSource, number> {
  return Object.fromEntries(Object.keys(DAMAGE_SOURCE_LABELS).map((source) => [source, 0])) as Record<DamageSource, number>
}

type DamageTarget = Point & {
  kind: EnemyKind
  health: number
  facingX?: number
  facingZ?: number
  status: {
    armorBreakRemaining: number
    armorBreakAmount: number
    brittleRemaining: number
  }
}

export type DamageCredit = { tower?: TowerKind; source?: DamageSource }

export function calculateDamage(target: DamageTarget, damage: number, damageType: DamageType, rules: GameRules, armorPiercing = false, attackOrigin?: Point): number {
  const canUseBallisticDefense = target.kind !== 'shieldbearer' || isAttackInFront(target, attackOrigin)
  const baseReduction = damageType === 'ballistic' && canUseBallisticDefense ? rules.tuning.enemies[target.kind].ballisticReduction ?? 0 : 0
  const armorBreak = target.status.armorBreakRemaining > 0 ? target.status.armorBreakAmount : 0
  const reduction = armorPiercing ? 0 : Math.max(0, baseReduction - armorBreak)
  const brittleMultiplier = damageType === 'explosive' && target.status.brittleRemaining > 0 ? 1.35 : 1
  return damage * (1 - reduction) * brittleMultiplier
}

/** Shieldbearers block shots arriving from the half-plane they face. */
export function isAttackInFront(target: Pick<DamageTarget, 'x' | 'z' | 'facingX' | 'facingZ'>, attackOrigin?: Point): boolean {
  if (!attackOrigin) return false
  const facing = normalizedDirection(target.facingX ?? 0, target.facingZ ?? 0)
  if (facing.x === 0 && facing.z === 0) return false
  const incoming = normalizedDirection(attackOrigin.x - target.x, attackOrigin.z - target.z)
  return facing.x * incoming.x + facing.z * incoming.z > 0
}

/** Credits only real health removed, so overkill never inflates the report. */
export function recordDamageCredit(
  damageByTower: Record<TowerKind, number>,
  damageBySource: Record<DamageSource, number>,
  credit: DamageCredit,
  applied: number,
  healthBefore: number,
): void {
  const amount = Math.min(applied, Math.max(0, healthBefore))
  const source = credit.source ?? credit.tower
  if (credit.tower) damageByTower[credit.tower] += amount
  if (source) damageBySource[source] += amount
}

function normalizedDirection(x: number, z: number): Point {
  const length = Math.hypot(x, z)
  return length > 0.0001 ? { x: x / length, z: z / length } : { x: 0, z: 0 }
}
