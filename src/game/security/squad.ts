import { distance } from '../types'
import type { World } from '../world'
import { barkLine, type LineKind } from './barks'
import { feetOf, isActive, type CombatRole, type Guard } from './model'
import { COMBAT } from './tuning'

/**
 * The squad layer above each fighting guard: who may fire aimed shots (attack tokens, so not everyone
 * opens up at once), who suppresses, who flanks, who holds a choke point and who falls back.
 * Also tracks how long the player has stayed put, which is what earns him a flashbang.
 */

const CAMP_RADIUS = 1.5
const KILLING_ZONE_SECONDS = 8
const ROLE_LINES: Partial<Record<CombatRole, LineKind>> = { flank: 'flank', hold: 'hold', suppress: 'suppress', fallback: 'fallback' }

export function organiseSquad(world: World, dt: number): void {
  const security = world.security
  const fighters = world.guards.filter((guard) => guard.mode === 'combat' && isActive(guard))
  security.shooters = []
  if (fighters.length === 0) {
    security.campSpot = null
    security.campSeconds = 0
    return
  }
  trackCamping(world, fighters, dt)

  // Tokens go to the two best placed: guards who can see him first, then the closest to where he was.
  const ranked = fighters
    .map((guard) => ({ guard, score: (guard.seesPlayer ? 0 : 1000) + (guard.lastKnown ? distance(feetOf(guard), guard.lastKnown) : 500) }))
    .sort((a, b) => a.score - b.score)
    .map((entry) => entry.guard)
  const tokens = new Set(ranked.slice(0, COMBAT.attackTokens))
  const killingZone = world.clock - security.lastCasualtyAt < KILLING_ZONE_SECONDS || security.campSeconds > COMBAT.campSeconds / 2
  let suppressor = false
  let flanker = false
  for (const guard of ranked) {
    const index = world.guards.indexOf(guard)
    if (tokens.has(guard) && guard.seesPlayer) security.shooters.push(index)
    let role: CombatRole
    if (guard.hp < guard.maxHp * COMBAT.fallbackHealth) role = 'fallback'
    else if (tokens.has(guard)) role = 'assault'
    else if (guard.seesPlayer && !suppressor) role = 'suppress'
    else if (killingZone && fighters.length >= 3 && !flanker && !guard.armored) role = 'flank'
    else role = 'hold'
    if (role === 'suppress') suppressor = true
    if (role === 'flank') flanker = true
    setRole(world, guard, role)
  }
}

/** Changes a guard's role, but not more often than every couple of seconds (except to fall back), so nobody dithers. */
function setRole(world: World, guard: Guard, role: CombatRole): void {
  if (guard.combatRole === role || (guard.replan > 0 && role !== 'fallback')) return
  guard.combatRole = role
  guard.cover = null
  guard.replan = COMBAT.replanSeconds
  if (role !== 'flank') guard.search = null
  const line = ROLE_LINES[role]
  if (line) barkLine(world, guard, line, role === 'fallback')
}

/** The freshest last known position among the fighters, and how long it has stayed in one spot. */
function trackCamping(world: World, fighters: Guard[], dt: number): void {
  const security = world.security
  let freshest: Guard | null = null
  for (const guard of fighters) if (guard.lastKnown && (!freshest || guard.lastKnownAt > freshest.lastKnownAt)) freshest = guard
  const spot = freshest?.lastKnown
  if (!spot) return
  if (security.campSpot && distance(security.campSpot, spot) < CAMP_RADIUS) security.campSeconds += dt
  else {
    security.campSpot = { ...spot }
    security.campSeconds = 0
  }
}
