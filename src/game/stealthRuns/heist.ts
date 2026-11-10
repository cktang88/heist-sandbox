import { matches } from '../intel/describe'
import { searchFilter } from '../intel/area'
import type { Place } from '../intel/types'
import { isActive } from '../security/model'
import { isSolidAt, tileAt } from '../tiles'
import { centerOf, type Vec } from '../types'
import type { World } from '../world'
import { blown, feet, holdE, note, pressE, tick, type Run } from './kit'
import { basementHatch, climbLadder, enterByRoof, enterBySewer, sewerFloor, streetManhole } from './routes'
import { walkTo, type WalkOptions } from './walker'

/**
 * A whole quiet heist by script: in by one of the routes, find the case from what papers and computers say
 * (never touching a guard for it), take it, and leave by the sewer to the van.
 */

export type Entry = 'sewer' | 'roof'
export type HeistResult = { won: boolean; stage: string; sourcesRead: number; placesTried: number }

const READABLE = new Set(['whiteboard', 'noticeBoard', 'paperStack'])
/** Places the case could be that the papers point at, beyond which the script stops reading and guesses. */
const MAX_SOURCES = 14
/** Rooms a quiet player keeps out of: someone stands guard there. */
const GUARDED_ROLES = new Set(['post', 'operator', 'heavy', 'officer'])

type Source = { kind: 'paper'; id: number; at: Vec } | { kind: 'computer'; id: number; at: Vec }

/** Papers and computers in the tower, outside rooms someone stands guard in. */
function quietSources(world: World): Source[] {
  const guarded = new Set(world.guards.filter((guard) => GUARDED_ROLES.has(guard.role) && isActive(guard)).map((guard) => guard.roomId))
  const inTower = (roomId: number | undefined | null) => roomId !== undefined && roomId !== null && world.rooms[roomId]?.building === 'tower' && !guarded.has(roomId)
  const papers: Source[] = world.props.filter((prop) => READABLE.has(prop.kind) && inTower(prop.roomId))
    .map((prop) => ({ kind: 'paper', id: prop.id, at: { x: prop.x + 0.5, y: world.rooms[prop.roomId!].floorY } }))
  const computers: Source[] = world.devices.filter((device) => device.kind === 'computer' && inTower(device.roomId))
    .map((device) => ({ kind: 'computer', id: device.id, at: { x: device.x + 0.5, y: world.rooms[device.roomId!].floorY } }))
  return [...papers, ...computers]
}

/** Every lock picked leaves a door standing open for a patrol to find: a quiet player goes the long way round instead. */
const LOCKED_DOOR_COST = 60

/**
 * Rough cost of getting from one spot to another in the tower: walking along the floor, a flight's worth per storey,
 * and a heavy price for each shut door between the main stairs and the target on its floor (or on the way to them).
 */
function cost(world: World, from: Vec, to: Vec): number {
  const stairs = world.stairwells.find((well) => well.building === 'tower')
  const landing = stairs ? (stairs.leftX + stairs.rightX) / 2 : from.x
  const sameFloor = Math.abs(from.y - to.y) < 1.5
  const doors = sameFloor ? shutDoorsBetween(world, from.y, from.x, to.x) : shutDoorsBetween(world, from.y, from.x, landing) + shutDoorsBetween(world, to.y, landing, to.x)
  return Math.abs(from.x - to.x) + Math.abs(from.y - to.y) * 3 + doors * LOCKED_DOOR_COST
}

function shutDoorsBetween(world: World, floorY: number, a: number, b: number): number {
  let count = 0
  for (let x = Math.floor(Math.min(a, b)) + 1; x < Math.max(a, b); x += 1) if (tileAt(world.grid, x, Math.round(floorY) - 1) === 'door') count += 1
  return count
}

/** Where the clues say the case is, if they narrow it to one place not yet ruled out. */
function target(world: World, ruledOut: Set<number>): Place | null {
  const filter = searchFilter(world.intel)
  if (!filter) return null
  const fits = world.intel.places.filter((place) => !ruledOut.has(place.id) && matches(filter, place))
  return fits.length === 1 ? fits[0] : null
}

/** Reads a paper or searches a computer's files where the player stands. */
function useSource(run: Run, source: Source): void {
  const { world } = run
  if (source.kind === 'paper') {
    holdE(run, 3, () => world.intel.used.has(`prop:${source.id}`))
    return
  }
  holdE(run, 4, () => world.terminal !== null)
  const options = world.terminal?.options ?? []
  const search = options.indexOf('Search files for the case')
  if (search >= 0) tick(run, { selectTool: search })
  if (world.terminal) pressE(run)
}

/** Walks to the case and over it, which picks it up. */
function takeCase(run: Run, options: WalkOptions): boolean {
  const { world } = run
  const loot = centerOf(world.loot)
  const result = walkTo(run, { x: loot.x, y: Math.round(world.loot.y + world.loot.h) }, options)
  return result === 'arrived' && world.player.hasLoot
}

/** From inside the tower: down to the basement hatch, along the sewer, up the street manhole and into the van. */
function leaveBySewer(run: Run, options: WalkOptions): string | null {
  const { world } = run
  const hatch = basementHatch(world)
  const manhole = streetManhole(world)
  const sewer = sewerFloor(world)
  // With the case in hand, a guard in the way down in the basement is choked and stowed rather than waited out.
  const out = { ...options, takedowns: true }
  // Beside the hatch on whichever side there is floor to stand on (one side may be the tower's outer wall).
  const side = isSolidAt(world.grid, hatch.x + 1.5, hatch.y - 0.5) ? -1 : 1
  if (walkTo(run, { x: hatch.x + 0.5 + side * 1.2, y: hatch.y }, out) !== 'arrived') return 'walking to the basement hatch'
  // Step onto the hatch and climb down.
  if (walkTo(run, { x: hatch.x + 0.5, y: hatch.y }, { ...out, timeout: 30 }) !== 'arrived' && !world.player.onLadder) return 'stepping onto the hatch'
  if (!climbLadder(run, hatch.x, sewer, options.maxAlert)) return 'climbing down to the sewer'
  if (walkTo(run, { x: manhole.x + 0.5, y: sewer }, options) !== 'arrived') return 'walking the sewer back'
  if (!climbLadder(run, manhole.x, manhole.y, options.maxAlert)) return 'climbing out of the manhole'
  const van = { x: world.extraction.x + world.extraction.w / 2, y: world.groundY }
  for (let frame = 0; frame < 30 * 60 && world.status === 'playing'; frame += 1) {
    if (blown(run, options.maxAlert)) return 'reaching the van'
    tick(run, { left: van.x < feet(world).x, right: van.x > feet(world).x })
  }
  return world.status === 'won' ? null : 'reaching the van'
}

/** The whole job. `stage` names where it stopped if it did not win. */
export function quietHeist(run: Run, entry: Entry, options: WalkOptions = {}): HeistResult {
  const { world } = run
  const result: HeistResult = { won: false, stage: 'entering', sourcesRead: 0, placesTried: 0 }
  if ((entry === 'sewer' ? enterBySewer(run, options) : enterByRoof(run)) !== 'arrived') return result
  const sources = quietSources(world)
  const ruledOut = new Set<number>()
  while (!world.player.hasLoot) {
    let place = target(world, ruledOut)
    if (!place && result.sourcesRead < MAX_SOURCES && sources.length > 0) {
      result.stage = 'gathering intel'
      const here = feet(world)
      sources.sort((a, b) => cost(world, here, a.at) - cost(world, here, b.at))
      const next = sources.shift()!
      if (walkTo(run, next.at, options) !== 'arrived') return result
      useSource(run, next)
      result.sourcesRead += 1
      continue
    }
    // Out of things to read: try the likeliest place not yet ruled out.
    place ??= bestGuess(world, ruledOut)
    if (!place) return { ...result, stage: 'no idea where the case is' }
    result.stage = `going to the ${place.kind}`
    result.placesTried += 1
    note(run, `heading for the ${place.kind} on storey ${place.storey}`)
    // A guard posted over the case would see it gone the moment he turned: he is the one guard taken down.
    const room = { ...options, takedownRoom: place.roomId }
    const inRoom = { x: place.x + place.w / 2, y: place.floorY }
    if (walkTo(run, inRoom, room) !== 'arrived') return result
    if (world.intel.places[world.intel.real].id === place.id) {
      result.stage = 'taking the case'
      if (!takeCase(run, room)) return result
    } else ruledOut.add(place.id)
  }
  result.stage = 'leaving'
  const failed = leaveBySewer(run, options)
  if (failed) return { ...result, stage: failed }
  return { ...result, won: true, stage: 'done' }
}

/** The candidate place most clues agree on, or failing that the first one not ruled out. */
function bestGuess(world: World, ruledOut: Set<number>): Place | null {
  const filter = searchFilter(world.intel)
  const open = world.intel.places.filter((place) => !ruledOut.has(place.id))
  return (filter && open.find((place) => matches(filter, place))) ?? open[0] ?? null
}

