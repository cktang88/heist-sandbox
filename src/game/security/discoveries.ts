import { isDoorUnlocked } from '../devices/locks'
import { smokeDensityAt } from '../hazards/hazards'
import { tileAt, type Grid } from '../tiles'
import { centerOf, distance, type Vec } from '../types'
import type { World } from '../world'
import { isLampShot } from '../ballistics/lampState'
import { barkLine, freshLine, sayAt, type LineKind } from './barks'
import { watcherFor } from './cameras'
import { markFireReported } from './danger'
import type { SecurityEvent, Tamper } from './events'
import { eyeOf, feetOf, isActive, setMode, type Guard, type InterestKind } from './model'
import { clearView, zoneOf } from './perception'
import { deviceBuilding, deviceFeet, floorBelow, roomOf } from './places'
import { reportEvent } from './report'
import { DISCOVERY } from './tuning'

/**
 * Things out of place that a guard notices on his rounds: a door standing open that should be shut (or a lock
 * that has been picked), smoke ahead, the vault standing empty, a parachute in the sky. Each is noticed once,
 * by the first guard to see it. The security room notices a dead camera feed the same patient way it notices
 * a dark circuit.
 */

/** What a guard found: where to go and look, what to say, and anything worth radioing in at once. */
export type Finding = { at: Vec; kind: InterestKind; priority: number; line: LineKind; tamper?: Tamper; canister?: boolean; report?: SecurityEvent }

const CHUTE_REPORT_AGAIN = 30
const CHUTE_BEHIND = 2
const VAULT_SIGHT = 12
const SMOKE_SAMPLES = [3, 6, 9]
const ROPE_SIGHT = 14
/** A guard this close to a shot-out lamp, on its floor, notices the dark. */
const LAMP_WITNESS = 9

/** The first thing out of place this guard can see right now, if any. Cheap: a few tiles and a handful of doors. */
export function lookForTrouble(world: World, guard: Guard): Finding | null {
  return vaultEmpty(world, guard) ?? chuteInSky(world, guard) ?? ropeOnWall(world, guard) ?? doorTampered(world, guard) ?? smokeAhead(world, guard)
}

// --- Doors -------------------------------------------------------------------------------------

const doorIndexes = new WeakMap<Grid, Map<number, number[]>>()

/** Door columns by the row of their bottom tile, as the site was built: every door starts shut and locked. */
function doorsByRow(grid: Grid): Map<number, number[]> {
  let index = doorIndexes.get(grid)
  if (index) return index
  index = new Map()
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      if (tileAt(grid, x, y) !== 'door' || tileAt(grid, x, y + 1) === 'door') continue
      index.set(y, [...(index.get(y) ?? []), x])
    }
  }
  doorIndexes.set(grid, index)
  return index
}

/** Takes note of the doors as the site was built, before anyone can open one. Called every frame; only the first call does any work. */
export function indexDoors(world: World): void {
  doorsByRow(world.grid)
}

/** The key of the door with a tile at this spot: its column and bottom row. */
export function doorKeyAt(world: World, column: number, row: number): string {
  let bottom = row
  while (tileAt(world.grid, column, bottom + 1) === 'door') bottom += 1
  return `${column},${bottom}`
}

/** A door ahead on his floor that is now open, that no guard opened. Opened without a key, its lock was picked (or blown). */
function doorTampered(world: World, guard: Guard): Finding | null {
  const feet = feetOf(guard)
  const row = Math.round(feet.y) - 1
  const columns = doorsByRow(world.grid).get(row)
  if (!columns) return null
  const security = world.security
  const eye = eyeOf(guard)
  for (const x of columns) {
    const ahead = (x + 0.5 - feet.x) * guard.facing
    if (ahead < -1 || ahead > DISCOVERY.doorSight || tileAt(world.grid, x, row) === 'door') continue
    const key = `${x},${row}`
    if (security.guardDoors.has(key) || security.doorsNoticed.has(key)) continue
    if (!clearView(world, eye, { x: x + 0.5, y: row - 0.5 })) continue
    security.doorsNoticed.add(key)
    const forced = !isDoorUnlocked(world, { x, y: row })
    return { at: { x: x + 0.5, y: feet.y }, kind: 'tamper', priority: forced ? 4 : 3, line: forced ? 'lockPicked' : 'doorOpen', tamper: forced ? 'lock' : 'door' }
  }
  return null
}

// --- Smoke, the vault, the sky -------------------------------------------------------------------

/** Smoke hanging in the air ahead, in a room nobody has reported it in yet. The first guard to see it claims it. */
function smokeAhead(world: World, guard: Guard): Finding | null {
  if (!world.hazards.smoke) return null
  const eye = eyeOf(guard)
  for (const step of SMOKE_SAMPLES) {
    const at = { x: eye.x + guard.facing * step, y: eye.y }
    if (smokeDensityAt(world, at) < DISCOVERY.smokeSeen) continue
    const room = roomOf(world, floorBelow(world, at))?.id ?? -1
    const reportedAt = world.security.firesReported.get(room)
    if (reportedAt !== undefined && world.clock - reportedAt < 60) return null
    markFireReported(world, { x: at.x, y: floorBelow(world, at).y - 1 })
    return { at: floorBelow(world, at), kind: 'smoke', priority: 3, line: 'seeFire', canister: smokeGrenadeNear(world, at) }
  }
  return null
}

/** Is a smoke grenade's screen what he is looking at (rather than smoke from a fire)? */
function smokeGrenadeNear(world: World, at: Vec): boolean {
  return world.hazards.grenades.some((grenade) => grenade.kind === 'smoke' && grenade.popped && distance(centerOf(grenade), at) < DISCOVERY.smokeSight + 3)
}

/** The gold gone from where it sat: the one discovery that confirms an intruder outright. */
function vaultEmpty(world: World, guard: Guard): Finding | null {
  if (world.security.vaultReported || !world.loot.taken) return null
  const spot = centerOf(world.loot)
  const eye = eyeOf(guard)
  if (distance(eye, spot) > VAULT_SIGHT || zoneOf(guard, eye, spot) !== 'central' || !clearView(world, eye, spot)) return null
  world.security.vaultReported = true
  const at = floorBelow(world, spot)
  return { at, kind: 'tamper', priority: 6, line: 'vaultOpen', tamper: 'lock', report: { kind: 'vault', at, by: world.guards.indexOf(guard) } }
}

/** A canopy against the sky is seen from far off, light or dark, by anyone looking that way. */
function chuteInSky(world: World, guard: Guard): Finding | null {
  const player = world.player
  if (!player.chute || world.clock - world.security.chuteReportedAt < CHUTE_REPORT_AGAIN) return null
  const eye = eyeOf(guard)
  const canopy = { x: player.x + player.w / 2, y: player.y - 1 }
  if ((canopy.x - eye.x) * guard.facing < -CHUTE_BEHIND || distance(eye, canopy) > DISCOVERY.chuteSight || !clearView(world, eye, canopy)) return null
  world.security.chuteReportedAt = world.clock
  return { at: floorBelow(world, canopy), kind: 'glimpse', priority: 5, line: 'chute', report: { kind: 'parachute', at: centerOf(player) } }
}

/**
 * A climbing rope hanging down the facade where he can see it. He reports it and goes to its knot to cut it.
 * A rope seen once is not reported again.
 */
function ropeOnWall(world: World, guard: Guard): Finding | null {
  if (world.ropes.length === 0) return null
  const eye = eyeOf(guard)
  for (const rope of world.ropes) {
    if (world.security.ropesNoticed.has(rope)) continue
    const nearest = { x: rope.x + 0.5, y: Math.max(rope.top, Math.min(rope.bottom + 1, eye.y)) }
    if ((nearest.x - eye.x) * guard.facing < -1 || distance(eye, nearest) > ROPE_SIGHT || !clearView(world, eye, nearest)) continue
    world.security.ropesNoticed.add(rope)
    const knot = floorBelow(world, { x: rope.anchor.x + 0.5, y: rope.anchor.y - 0.5 })
    return { at: knot, kind: 'tamper', priority: 5, line: 'rope', tamper: 'rope', report: { kind: 'tamper', at: knot, what: 'rope' } }
  }
  return null
}

/**
 * Lamps shot out are noticed like a dead circuit: a calm guard near one on its floor says so and goes to look.
 * There is nothing to switch back on, so he calls it in when he gets there.
 */
export function noticeShotLamps(world: World): void {
  const noticed = world.security.lampsNoticed
  for (const lamp of world.lamps) {
    if (noticed.has(lamp) || !isLampShot(world, lamp)) continue
    const under = floorBelow(world, { x: lamp.x, y: lamp.y })
    const witness = world.guards.find((guard) => {
      if (!isActive(guard) || (guard.mode !== 'calm' && guard.mode !== 'caution')) return false
      const feet = feetOf(guard)
      return Math.abs(feet.y - under.y) < 1.5 && Math.abs(feet.x - lamp.x) < LAMP_WITNESS && clearView(world, eyeOf(guard), { x: lamp.x, y: lamp.y + 0.5 })
    })
    if (!witness) continue
    noticed.add(lamp)
    witness.interest = { at: under, kind: 'lightsOut', priority: 2, reached: false }
    setMode(witness, 'noticed')
    witness.announced = 'noticed'
    barkLine(world, witness, 'shotLamp', true)
  }
}

// --- The security room ---------------------------------------------------------------------------

/** A camera cut a while ago shows as a dead feed in its building's security room, if someone is in there to see it. */
export function watchCameraFeeds(world: World): void {
  const security = world.security
  for (const device of world.devices) {
    if (device.kind !== 'camera') continue
    if (!device.disabled) {
      security.camerasDeadSince.delete(device.id)
      security.camerasReported.delete(device.id)
      continue
    }
    const since = security.camerasDeadSince.get(device.id) ?? world.clock
    security.camerasDeadSince.set(device.id, since)
    if (security.camerasReported.has(device.id) || world.clock - since < DISCOVERY.cameraFaultSeconds) continue
    const watcher = watcherFor(world, deviceBuilding(world, device))
    if (!watcher) continue
    security.camerasReported.add(device.id)
    sayAt(world, { x: watcher.x + watcher.w / 2, y: watcher.y - 0.5 }, freshLine(world, 'camera'))
    reportEvent(world, { kind: 'fault', at: deviceFeet(world, device), what: 'camera' })
  }
}
