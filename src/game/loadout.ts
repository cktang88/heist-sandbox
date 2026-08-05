import type { BuildTool, ChallengeModifiers, CombatPower, GameRules, TowerKind } from './types'
import { ownsUpgrade, type UpgradeId, type UpgradeRanks } from './upgrades'

export const MAX_LOADOUT_TOWERS = 4
export const MAX_LOADOUT_POWERS = 3
export type CommanderDoctrine = 'forwardSupply' | 'leanLogistics' | 'rapidResponse' | 'bastionReserve'

export type CommanderDoctrineDefinition = {
  id: CommanderDoctrine
  name: string
  effect: string
  researchId: UpgradeId
  researchName: string
}

export const COMMANDER_DOCTRINES: readonly CommanderDoctrineDefinition[] = [
  { id: 'forwardSupply', name: 'Forward Supply', effect: '+30 preparation supply', researchId: 'command-07', researchName: 'Forward Supply' },
  { id: 'leanLogistics', name: 'Lean Logistics', effect: 'Towers and walls cost 10% less', researchId: 'command-08', researchName: 'Lean Logistics' },
  { id: 'rapidResponse', name: 'Rapid Response', effect: 'All command cooldowns recover 15% faster', researchId: 'command-09', researchName: 'Rapid Response' },
  { id: 'bastionReserve', name: 'Bastion Reserve', effect: '+50 fortress shield and +20% wall health', researchId: 'command-13', researchName: 'Bastion Reserve' },
]

export type Loadout = {
  towers: readonly TowerKind[]
  powers: readonly CombatPower[]
  doctrine?: CommanderDoctrine | null
}

export type LoadoutLimits = { towerSlots: number; powerSlots: number }

export const DEFAULT_LOADOUT: Loadout = { towers: ['gunner'], powers: [], doctrine: null }
export const DEFAULT_LOADOUT_LIMITS: LoadoutLimits = { towerSlots: MAX_LOADOUT_TOWERS, powerSlots: MAX_LOADOUT_POWERS }

export function normalizeLoadout(
  loadout: Loadout,
  availableTowers: readonly TowerKind[],
  availablePowers: readonly CombatPower[],
  limits: LoadoutLimits = DEFAULT_LOADOUT_LIMITS,
): Loadout {
  const towers = unique(loadout.towers).filter((tower) => availableTowers.includes(tower)).slice(0, Math.min(MAX_LOADOUT_TOWERS, limits.towerSlots))
  const powers = unique(loadout.powers).filter((power) => availablePowers.includes(power)).slice(0, Math.min(MAX_LOADOUT_POWERS, limits.powerSlots))
  if (!towers.length && availableTowers.length) towers.push(availableTowers.includes('gunner') ? 'gunner' : availableTowers[0])
  return { towers, powers, doctrine: normalizeCommanderDoctrine(loadout.doctrine) }
}

export function validateLoadout(
  loadout: Loadout,
  availableTowers: readonly TowerKind[],
  availablePowers: readonly CombatPower[],
  limits: LoadoutLimits = DEFAULT_LOADOUT_LIMITS,
): readonly string[] {
  const errors: string[] = []
  if (!loadout.towers.length) errors.push('Choose at least one tower.')
  const towerSlots = Math.min(MAX_LOADOUT_TOWERS, limits.towerSlots)
  const powerSlots = Math.min(MAX_LOADOUT_POWERS, limits.powerSlots)
  if (loadout.towers.length > towerSlots) errors.push(`Choose no more than ${towerSlots} towers.`)
  if (loadout.powers.length > powerSlots) errors.push(`Choose no more than ${powerSlots} powers.`)
  if (unique(loadout.towers).length !== loadout.towers.length || loadout.towers.some((tower) => !availableTowers.includes(tower))) errors.push('Tower loadout contains an unavailable tower.')
  if (unique(loadout.powers).length !== loadout.powers.length || loadout.powers.some((power) => !availablePowers.includes(power))) errors.push('Power loadout contains an unavailable power.')
  return errors
}

export function toggleLoadoutTower(
  loadout: Loadout,
  tower: TowerKind,
  availableTowers: readonly TowerKind[],
  availablePowers: readonly CombatPower[],
  limits: LoadoutLimits = DEFAULT_LOADOUT_LIMITS,
): Loadout {
  const current = normalizeLoadout(loadout, availableTowers, availablePowers, limits)
  if (!availableTowers.includes(tower)) return current
  if (current.towers.includes(tower)) {
    if (current.towers.length === 1) return current
    return { ...current, towers: current.towers.filter((candidate) => candidate !== tower) }
  }
  if (current.towers.length >= Math.min(MAX_LOADOUT_TOWERS, limits.towerSlots)) return current
  return { ...current, towers: [...current.towers, tower] }
}

export function toggleLoadoutPower(
  loadout: Loadout,
  power: CombatPower,
  availableTowers: readonly TowerKind[],
  availablePowers: readonly CombatPower[],
  limits: LoadoutLimits = DEFAULT_LOADOUT_LIMITS,
): Loadout {
  const current = normalizeLoadout(loadout, availableTowers, availablePowers, limits)
  if (!availablePowers.includes(power)) return current
  if (current.powers.includes(power)) return { ...current, powers: current.powers.filter((candidate) => candidate !== power) }
  if (current.powers.length >= Math.min(MAX_LOADOUT_POWERS, limits.powerSlots)) return current
  return { ...current, powers: [...current.powers, power] }
}

export function resolveRunLoadout(loadout: Loadout, modifiers?: ChallengeModifiers): Loadout {
  if (!modifiers?.allowedTools && !modifiers?.allowedPowers) return modifiers?.noPowers ? { ...loadout, powers: [] } : loadout
  const towers = modifiers.allowedTools
    ? modifiers.allowedTools.filter((tool): tool is TowerKind => tool !== 'wall')
    : [...loadout.towers]
  const powers = modifiers.noPowers
    ? []
    : modifiers.allowedPowers
      ? [...modifiers.allowedPowers]
      : modifiers.allowedTools?.includes('wall') ? ['wall' as const] : [...loadout.powers]
  return {
    towers,
    powers,
    doctrine: normalizeCommanderDoctrine(loadout.doctrine),
  }
}

export function getRunLoadoutLimits(limits: LoadoutLimits, modifiers?: ChallengeModifiers): LoadoutLimits {
  return {
    towerSlots: Math.min(limits.towerSlots, modifiers?.towerSlots ?? MAX_LOADOUT_TOWERS),
    powerSlots: Math.min(limits.powerSlots, modifiers?.powerSlots ?? MAX_LOADOUT_POWERS),
  }
}

export function canStartWithDeployment(hasOffensiveTower: boolean, modifiers?: ChallengeModifiers): boolean {
  return hasOffensiveTower || Boolean(modifiers?.allowEmptyDeployment)
}

export function loadoutsEqual(left: Loadout, right: Loadout): boolean {
  return left.towers.join('|') === right.towers.join('|') && left.powers.join('|') === right.powers.join('|') && normalizeCommanderDoctrine(left.doctrine) === normalizeCommanderDoctrine(right.doctrine)
}

export function normalizeCommanderDoctrine(value: unknown): CommanderDoctrine | null {
  return COMMANDER_DOCTRINES.some((doctrine) => doctrine.id === value) ? value as CommanderDoctrine : null
}

export function isCommanderDoctrineUnlocked(ranks: UpgradeRanks, doctrine: CommanderDoctrine): boolean {
  const definition = COMMANDER_DOCTRINES.find((candidate) => candidate.id === doctrine)
  return Boolean(definition && ownsUpgrade(ranks, definition.researchId))
}

export function normalizeUnlockedCommanderDoctrine(value: unknown, ranks: UpgradeRanks): CommanderDoctrine | null {
  const doctrine = normalizeCommanderDoctrine(value)
  return doctrine && isCommanderDoctrineUnlocked(ranks, doctrine) ? doctrine : null
}

export function applyCommanderDoctrine(rules: GameRules, doctrine: CommanderDoctrine | null): GameRules {
  switch (doctrine) {
    case 'forwardSupply':
      return { ...rules, tuning: { ...rules.tuning, budget: rules.tuning.budget + 30 } }
    case 'leanLogistics':
      return {
        ...rules,
        tuning: {
          ...rules.tuning,
          towers: Object.fromEntries(Object.entries(rules.tuning.towers).map(([kind, stats]) => [kind, { ...stats, cost: Math.max(1, Math.round(stats.cost * 0.9)) }])) as GameRules['tuning']['towers'],
          wall: { ...rules.tuning.wall, cost: Math.max(1, Math.round(rules.tuning.wall.cost * 0.9)) },
        },
      }
    case 'rapidResponse':
      return {
        ...rules,
        powers: Object.fromEntries(Object.entries(rules.powers).map(([kind, power]) => [kind, { ...power, cooldown: power.cooldown * 0.85 }])) as GameRules['powers'],
      }
    case 'bastionReserve':
      return {
        ...rules,
        tuning: { ...rules.tuning, wall: { ...rules.tuning.wall, health: rules.tuning.wall.health * 1.2 } },
        setup: { ...rules.setup, fortressShield: rules.setup.fortressShield + 50 },
      }
    default:
      return rules
  }
}

/** Starting walls are a preparation tool, separate from the temporary-wall combat power slot. */
export function getSetupBuildTools(loadout: Loadout, startingWallAvailable: boolean): BuildTool[] {
  return [...loadout.towers, ...(startingWallAvailable ? ['wall' as const] : [])]
}

function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items)]
}
