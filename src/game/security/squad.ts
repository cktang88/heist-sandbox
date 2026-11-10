import { distance } from '../types'
import type { World } from '../world'
import { barkLine, type LineKind } from './barks'
import { feetOf, isActive, type CombatRole, type Guard } from './model'
import { isBreaking, isShaken } from './nerve'
import { COMBAT } from './tuning'

/**
 * The squad layer above each fighting guard: who may fire aimed shots (attack tokens, so not everyone
 * opens up at once), who suppresses, who flanks, who holds a choke point and who falls back
 * (the badly hurt, and anyone whose nerve is breaking).
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
  // A flanker on his way round does not take a token from the men pinning the player, unless he has a shot already.
  const tokens = new Set(ranked.filter((guard) => guard.seesPlayer || !(guard.combatRole === 'flank' && stillFlanking(world, guard))).slice(0, COMBAT.attackTokens))
  // Flanking is the default once there are men to spare: one goes round, two in a bigger fight (or once men are dying).
  // A site without staircases (the outpost's ladders) only sends one round once the direct way has become a killing zone.
  const killingZone = world.clock - security.lastCasualtyAt < KILLING_ZONE_SECONDS || security.campSeconds > COMBAT.campSeconds / 2
  const flankersWanted = fighters.length < 3 ? 0 : world.stairwells.length === 0 ? (killingZone ? 1 : 0) : fighters.length >= 5 || killingZone ? 2 : 1
  // With staircases to go round by, the flank is manned before the suppressor; on a ladder site, after.
  const routesRound = world.stairwells.length > 0
  let suppressor = false
  let flankers = fighters.filter((guard) => guard.combatRole === 'flank' && stillFlanking(world, guard)).length
  for (const guard of ranked) {
    const index = world.guards.indexOf(guard)
    if (guard.stackLeader !== null) {
      // A shield team works as one column (shieldTeam.ts); its men fire whenever they have a shot.
      if (guard.seesPlayer) security.shooters.push(index)
      setRole(world, guard, 'stack')
      continue
    }
    if (tokens.has(guard) && guard.seesPlayer) security.shooters.push(index)
    let role: CombatRole
    if (guard.hp < guard.maxHp * COMBAT.fallbackHealth || isBreaking(guard)) role = 'fallback'
    else if (tokens.has(guard)) role = 'assault'
    else if (guard.combatRole === 'flank' && stillFlanking(world, guard)) role = 'flank'
    else if (flankers < flankersWanted && mayFlank(guard) && (routesRound || suppressor || !guard.seesPlayer)) role = 'flank'
    else if (guard.seesPlayer && !suppressor) role = 'suppress'
    else role = 'hold'
    if (role === 'suppress') suppressor = true
    if (role === 'flank' && guard.combatRole !== 'flank') flankers += 1
    setRole(world, guard, role)
  }
}

/** Steady, unarmoured men go round; heavies and the shaken stay with the squad. */
function mayFlank(guard: Guard): boolean {
  return !guard.armored && !isShaken(guard)
}

/** A flanker keeps at it until his route is walked or its time is up, so the squad does not call him back halfway. */
function stillFlanking(world: World, guard: Guard): boolean {
  return guard.search !== null && world.clock < guard.search.endsAt && guard.search.index < guard.search.points.length
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
