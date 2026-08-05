import type { TowerAttack, TowerKind, TowerStats, TowerVariantId } from './types'
import type { UpgradeId } from './upgrades'

export type TowerVariantDefinition = {
  id: TowerVariantId
  tower: TowerKind
  label: string
  role: string
  accent: string
  /** Research node expected to unlock this choice. */
  researchNode: UpgradeId
  apply: (base: TowerStats) => TowerStats
}

const direct = (base: TowerStats, patch: Partial<TowerStats>): TowerStats => ({ ...base, ...patch, attack: { ...base.attack } })
const attack = <K extends TowerAttack['kind']>(base: TowerStats, kind: K, patch: Partial<Extract<TowerAttack, { kind: K }>>): TowerStats => {
  if (base.attack.kind !== kind) return { ...base, attack: { ...base.attack } }
  return { ...base, attack: { ...base.attack, ...patch } as TowerAttack }
}

export const TOWER_VARIANTS: readonly TowerVariantDefinition[] = [
  { id: 'gunner-armor-piercer', tower: 'gunner', label: 'Armor Piercer', role: 'Slow anti-armor rivets', accent: '#eadb8a', researchNode: 'gunner-05', apply: (s) => direct(s, { damage: s.damage * 1.9, shotsPerSecond: s.shotsPerSecond * 0.55, range: s.range * 1.2 }) },
  { id: 'gunner-rapid-feed', tower: 'gunner', label: 'Rapid Feed', role: 'Short-range stream of light rivets', accent: '#e89157', researchNode: 'gunner-07', apply: (s) => direct(s, { damage: s.damage * 0.58, shotsPerSecond: s.shotsPerSecond * 2.2, range: s.range * 0.84 }) },
  { id: 'heavy-anti-armor', tower: 'heavyGun', label: 'Anti-Armor', role: 'Narrow, hard-hitting sustained fire', accent: '#ef8a5b', researchNode: 'gunner-09', apply: (s) => direct(s, { damage: s.damage * 1.75, shotsPerSecond: s.shotsPerSecond * 0.62, range: s.range * 1.1 }) },
  { id: 'heavy-siege', tower: 'heavyGun', label: 'Siege Feed', role: 'Wide suppression cone', accent: '#d9cc72', researchNode: 'gunner-10', apply: (s) => direct(s, { damage: s.damage * 0.72, shotsPerSecond: s.shotsPerSecond * 1.25, range: s.range * 0.9 }) },
  { id: 'cannon-hypervelocity', tower: 'cannon', label: 'Hypervelocity', role: 'Fast dense shell with a tight blast', accent: '#ffb458', researchNode: 'explosives-07', apply: (s) => attack(direct(s, { damage: s.damage * 1.55, shotsPerSecond: s.shotsPerSecond * 0.72, projectileSpeed: (s.projectileSpeed ?? 7) * 2.5 }), 'splash', { radius: s.attack.kind === 'splash' ? s.attack.radius * 0.68 : 1 }) },
  { id: 'cannon-cluster', tower: 'cannon', label: 'Cluster', role: 'Low initial damage with secondary blasts', accent: '#8fd7dc', researchNode: 'explosives-05', apply: (s) => attack(direct(s, { damage: s.damage * 0.62, shotsPerSecond: s.shotsPerSecond * 1.08 }), 'splash', { radius: s.attack.kind === 'splash' ? s.attack.radius * 1.15 : 1 }) },
  { id: 'rocket-guided', tower: 'rocket', label: 'Guided', role: 'Fast precise anti-heavy rocket', accent: '#e7d275', researchNode: 'explosives-08', apply: (s) => attack(direct(s, { damage: s.damage * 1.8, shotsPerSecond: s.shotsPerSecond * 0.58, range: s.range * 1.2, minRange: 0.5 }), 'splash', { radius: s.attack.kind === 'splash' ? s.attack.radius * 0.58 : 1 }) },
  { id: 'rocket-salvo', tower: 'rocket', label: 'Salvo', role: 'Fast small rockets for crowds', accent: '#f08b54', researchNode: 'explosives-10', apply: (s) => attack(direct(s, { damage: s.damage * 0.58, shotsPerSecond: s.shotsPerSecond * 1.9, minRange: (s.minRange ?? 0) * 0.8 }), 'splash', { radius: s.attack.kind === 'splash' ? s.attack.radius * 0.78 : 1 }) },
  { id: 'flame-napalm', tower: 'flamethrower', label: 'Napalm', role: 'Long, lethal damage-over-time burn', accent: '#ff9b45', researchNode: 'fire-07', apply: (s) => attack(direct(s, { damage: s.damage * 0.45, shotsPerSecond: s.shotsPerSecond * 0.8 }), 'flame', s.attack.kind === 'flame' ? { burnDamagePerSecond: s.attack.burnDamagePerSecond * 1.8, burnSeconds: s.attack.burnSeconds * 1.8 } : {}) },
  { id: 'flame-funeral-pyre', tower: 'flamethrower', label: 'Funeral Pyre', role: 'Wide flame whose victims spread fire', accent: '#ff5844', researchNode: 'fire-06', apply: (s) => attack(direct(s, { damage: s.damage * 0.75, shotsPerSecond: s.shotsPerSecond * 1.15 }), 'flame', s.attack.kind === 'flame' ? { radius: s.attack.radius * 1.45, burnSeconds: s.attack.burnSeconds * 0.75 } : {}) },
  { id: 'cryo-brittle', tower: 'cryo', label: 'Brittle', role: 'Deep freeze primes targets for explosions', accent: '#a9f2ff', researchNode: 'cryo-05', apply: (s) => attack(direct(s, { damage: s.damage * 0.5, shotsPerSecond: s.shotsPerSecond * 1.2 }), 'cryo', s.attack.kind === 'cryo' ? { slowMultiplier: Math.max(0.15, s.attack.slowMultiplier - 0.12), freezePerHit: s.attack.freezePerHit * 1.5 } : {}) },
  { id: 'cryo-chain-freeze', tower: 'cryo', label: 'Chain Freeze', role: 'Freeze jumps to a nearby target', accent: '#5bbde4', researchNode: 'cryo-06', apply: (s) => attack(direct(s, { damage: s.damage * 0.7, shotsPerSecond: s.shotsPerSecond * 0.9 }), 'cryo', s.attack.kind === 'cryo' ? { freezePerHit: s.attack.freezePerHit * 1.25 } : {}) },
  { id: 'tesla-stun', tower: 'tesla', label: 'Stun Coil', role: 'Weak arcs briefly stop the horde', accent: '#d7b6ff', researchNode: 'energy-04', apply: (s) => attack(direct(s, { damage: s.damage * 0.65, shotsPerSecond: s.shotsPerSecond * 1.2 }), 'chain', s.attack.kind === 'chain' ? { targets: s.attack.targets + 2 } : {}) },
  { id: 'tesla-overcharge', tower: 'tesla', label: 'Overcharge', role: 'Single-target electric burst', accent: '#fff08a', researchNode: 'energy-07', apply: (s) => attack(direct(s, { damage: s.damage * 3, shotsPerSecond: s.shotsPerSecond * 0.55, range: s.range * 1.1 }), 'chain', { targets: 1 }) },
  { id: 'laser-piercing', tower: 'laser', label: 'Piercing', role: 'Thin beam pierces a horde column', accent: '#ff91b2', researchNode: 'energy-06', apply: (s) => direct(s, { damage: s.damage * 0.68, shotsPerSecond: s.shotsPerSecond * 1.15 }) },
  { id: 'laser-prism', tower: 'laser', label: 'Prism', role: 'Rapid short beam for scattered targets', accent: '#ff424f', researchNode: 'energy-10', apply: (s) => direct(s, { damage: s.damage * 0.45, shotsPerSecond: s.shotsPerSecond * 2.1, range: s.range * 0.82 }) },
  { id: 'mortar-concussion', tower: 'mortar', label: 'Concussion', role: 'Weak blasts stun survivors', accent: '#9ccf83', researchNode: 'artillery-05', apply: (s) => attack(direct(s, { damage: s.damage * 0.62, shotsPerSecond: s.shotsPerSecond * 1.25 }), 'splash', { radius: s.attack.kind === 'splash' ? s.attack.radius * 1.15 : 1 }) },
  { id: 'mortar-cluster', tower: 'mortar', label: 'Cluster', role: 'Huge distant blast with secondary shells', accent: '#f5c06a', researchNode: 'artillery-06', apply: (s) => attack(direct(s, { damage: s.damage * 0.72, shotsPerSecond: s.shotsPerSecond * 0.7, range: s.range * 1.15 }), 'splash', { radius: s.attack.kind === 'splash' ? s.attack.radius * 1.25 : 1 }) },
  { id: 'support-overclock', tower: 'support', label: 'Overclock', role: 'Large fire-rate boost in a smaller aura', accent: '#65f0b0', researchNode: 'command-11', apply: (s) => attack(s, 'support', s.attack.kind === 'support' ? { radius: s.attack.radius * 0.82, damageMultiplier: 1 + (s.attack.damageMultiplier - 1) * 0.5, fireRateMultiplier: 1 + (s.attack.fireRateMultiplier - 1) * 2.4 } : {}) },
  { id: 'support-fortress', tower: 'support', label: 'Fortress', role: 'Wide, balanced defensive network', accent: '#ffe475', researchNode: 'command-12', apply: (s) => attack(s, 'support', s.attack.kind === 'support' ? { radius: s.attack.radius * 1.35, damageMultiplier: 1 + (s.attack.damageMultiplier - 1) * 1.2, fireRateMultiplier: 1 + (s.attack.fireRateMultiplier - 1) * 1.2 } : {}) },
] as const

export function getTowerVariant(tower: TowerKind, id: string | undefined): TowerVariantDefinition | undefined {
  if (!id) return undefined
  return TOWER_VARIANTS.find((variant) => variant.id === id && variant.tower === tower)
}

export function getTowerVariants(tower: TowerKind): readonly TowerVariantDefinition[] {
  return TOWER_VARIANTS.filter((variant) => variant.tower === tower)
}

/** Standard/unknown/wrong-family selections return a safe cloned standard stat block. */
export function applyTowerVariant(tower: TowerKind, id: string | undefined, base: TowerStats): TowerStats {
  const variant = getTowerVariant(tower, id)
  return variant ? variant.apply(base) : { ...base, attack: { ...base.attack } }
}
