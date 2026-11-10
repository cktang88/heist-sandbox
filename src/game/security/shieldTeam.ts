import { burst } from '../effects'
import { throwGrenade } from '../hazards/hazards'
import type { Projectile } from '../projectiles'
import { playSound } from '../sounds'
import type { Vec } from '../types'
import { normalize } from '../vision'
import type { World } from '../world'
import { barkLine, sayAt } from './barks'
import { enterCombat } from './combat'
import { liveKillZones } from './killZones'
import { createGuard, eyeOf, feetOf, isActive, type Guard } from './model'
import { goTo, hold } from './movement'
import { floorBelow, isDoorway, sameFloor } from './places'
import { log } from './report'
import { entryFor } from './response'
import { PATROL, SHIELD } from './tuning'

/**
 * Escalation at choke points. Once men keep dying at the same doorway or stair head, or the squad is plainly losing,
 * the control room sends a shield team: four armoured men in a column, the front one behind a ballistic shield that
 * stops pistol, rifle and shotgun rounds from the front (not a sniper's round, a blast, fire, or shots from behind or
 * steeply above). They advance slowly, firing past the shield man, and flashbang a room before going into it.
 */

/** The control room's check, a couple of times a second: is it time for the shield team, and if so, send it. */
export function considerShieldTeam(world: World): void {
  const security = world.security
  if (security.shieldTeams >= SHIELD.maxTeams || world.clock - security.shieldTeamAt < SHIELD.every || world.status !== 'playing') return
  const choke = liveKillZones(world).filter((zone) => zone.deaths >= SHIELD.zoneDeaths).sort((a, b) => b.deaths - a.deaths)[0]
  const losing = security.deaths.filter((death) => world.clock - death.clock < SHIELD.lossWindow).length >= SHIELD.losses
  if (!choke && !losing) return
  const target = security.lastKnown ?? (choke ? { x: choke.at.x, y: choke.at.y - 1 } : null)
  if (target) sendShieldTeam(world, target)
}

/** Four armoured men set down where the response team comes in, already moving on `target` (a body position) as a column. */
export function sendShieldTeam(world: World, target: Vec): Guard[] {
  const security = world.security
  security.shieldTeams += 1
  security.shieldTeamAt = world.clock
  const entry = entryFor(world, floorBelow(world, target))
  const leader = world.guards.length
  const team: Guard[] = []
  for (let slot = 0; slot < SHIELD.size; slot += 1) {
    const man = createGuard({ ...entry(slot), y: world.groundY }, true)
    Object.assign(man, { checkInAt: Infinity, shield: slot === 0, stackLeader: leader, stackSlot: slot, combatRole: 'stack' })
    world.guards.push(man)
    enterCombat(world, man, target)
    man.heardAt = world.clock
    man.announced = man.mode
    team.push(man)
  }
  barkLine(world, team[0], 'shieldUp', true)
  sayAt(world, { x: target.x, y: target.y - 2 }, 'Control: Shield team, move up.')
  log(world, 'Control: Shield team is on site. Everyone else hold and let them through.')
  return team
}

/**
 * Does the shield stop this round? Only a man carrying one, still on his feet, hit from the side he faces by an
 * ordinary round coming in no steeper than the shield covers. When it does, it sparks and rings.
 */
export function shieldBlocks(world: World, guard: Guard, shot: Pick<Projectile, 'x' | 'y' | 'vx' | 'vy' | 'kind' | 'power'>): boolean {
  if (!guard.shield || !isActive(guard) || shot.kind !== 'bullet' || shot.power >= SHIELD.stops) return false
  const fromFront = shot.vx * guard.facing < 0
  const overTheTop = shot.vy > Math.abs(shot.vx) * SHIELD.steepest
  if (!fromFront || overTheTop) return false
  burst(world.effects, world.rng, { x: shot.x, y: shot.y }, 4, '#ffd27a', 5)
  playSound(world, 'impact', { x: shot.x, y: shot.y })
  return true
}

/** Leaves the column if its shield man is down: each man then fights on his own. */
export function stackBroken(world: World, guard: Guard): boolean {
  const leader = guard.stackLeader === null ? undefined : world.guards[guard.stackLeader]
  if (leader && isActive(leader)) return false
  guard.stackLeader = null
  guard.combatRole = 'assault'
  return true
}

/** One frame of a shield team man: the shield man leads, the rest keep a pace behind him each. */
export function moveInStack(world: World, guard: Guard, known: Vec, dt: number): void {
  const leader = world.guards[guard.stackLeader!]
  if (guard === leader) leadStack(world, guard, known, dt)
  else followStack(world, guard, leader, dt)
}

function leadStack(world: World, leader: Guard, known: Vec, dt: number): void {
  const feet = feetOf(leader)
  const threat = floorBelow(world, known)
  const side = Math.sign(threat.x - feet.x) || leader.facing
  const team = world.guards.filter((other) => other !== leader && other.stackLeader === leader.stackLeader && isActive(other))
  leader.crouching = false
  if (world.clock - leader.clearedAt < SHIELD.flashWait) return holdFacing(world, leader, side, dt)
  if (sameFloor(feet, threat) && roomAhead(world, feet, threat, side) && world.clock - leader.clearedAt > SHIELD.flashEvery) {
    flashTheRoom(world, team[0] ?? leader, threat)
    leader.clearedAt = world.clock
    return holdFacing(world, leader, side, dt)
  }
  const straggler = team.some((other) => !other.stairs && distanceAlong(feetOf(other), feet) > SHIELD.straggle + SHIELD.gap * other.stackSlot)
  const closeEnough = sameFloor(feet, threat) && Math.abs(threat.x - feet.x) <= SHIELD.standOff
  if (straggler || closeEnough) return holdFacing(world, leader, side, dt)
  goTo(world, leader, threat, SHIELD.speed, dt, false)
  // The shield stays toward the threat, even backing round a corner.
  if (sameFloor(feet, threat)) leader.facing = side > 0 ? 1 : -1
}

function followStack(world: World, guard: Guard, leader: Guard, dt: number): void {
  const lead = feetOf(leader)
  const feet = feetOf(guard)
  guard.crouching = false
  if (leader.stairs || !sameFloor(lead, feet)) {
    goTo(world, guard, lead, PATROL.hurrySpeed, dt, false)
    return
  }
  const spot = { x: lead.x - leader.facing * SHIELD.gap * guard.stackSlot, y: lead.y }
  if (Math.abs(spot.x - feet.x) > 0.3) goTo(world, guard, spot, PATROL.hurrySpeed, dt, false)
  else hold(world, guard, dt)
  guard.facing = leader.facing
}

function holdFacing(world: World, guard: Guard, side: number, dt: number): void {
  hold(world, guard, dt)
  guard.facing = side > 0 ? 1 : -1
}

/** A doorway just ahead, with the intruder somewhere in the room beyond it. */
function roomAhead(world: World, feet: Vec, threat: Vec, side: number): boolean {
  if (Math.abs(threat.x - feet.x) > SHIELD.flashReach + SHIELD.doorAhead) return false
  for (let step = 1; step <= SHIELD.doorAhead && step < Math.abs(threat.x - feet.x); step += 1) {
    if (isDoorway(world, feet.x + side * step, feet.y)) return true
  }
  return false
}

/** The man behind the shield lobs a flashbang past it into the room. */
function flashTheRoom(world: World, thrower: Guard, threat: Vec): void {
  const eye = eyeOf(thrower)
  const dx = threat.x - eye.x
  throwGrenade(world, 'flash', eye, normalize(dx, threat.y - 1 - eye.y - Math.abs(dx) * 0.35), 'guard')
  barkLine(world, thrower, 'flashOut', true)
}

function distanceAlong(a: Vec, b: Vec): number {
  return sameFloor(a, b) ? Math.abs(a.x - b.x) : Infinity
}
