import { HIDES } from '../furnish/hides'
import { PLACE_ROOMS } from '../intel/places'
import { createLevel } from '../level'
import { mirrorLevel } from '../mirror'
import { propSpec, type PropKind } from '../propCatalog'
import type { Level, Room } from '../site'
import { landingX } from '../stairs'
import { spotKind } from '../stealth/spots'
import { markAside } from '../gaps/aside'
import { createHoles } from '../gaps/holes'
import { blocksLaneAt, isSolidAt, tileAt, type Grid } from '../tiles'
import { quietWaysInto } from './access'
import { createComplex } from './complex'

/**
 * Checks a generated site the way a player and a guard would find it: where things are put and who can get where.
 * Used by the site tests over many seeds; each check returns the problems it found, so a failing test says what and where.
 */

export type SiteKind = 'complex' | 'outpost'

/** The site exactly as `createWorld` builds it: even seeds are mirrored. */
export function siteFor(seed: number, kind: SiteKind): Level {
  const built = kind === 'complex' ? createComplex(seed) : createLevel(seed)
  return seed % 2 === 0 ? mirrorLevel(built) : built
}

const OUTDOOR = new Set<Room['kind']>(['street', 'yard', 'rooftop'])
export const isIndoor = (room: Room) => !OUTDOOR.has(room.kind)

const solid = (grid: Grid, x: number, y: number) => isSolidAt(grid, x, y)
/** A body can be here: open air, a ladder, water, a door it can open, or beside something standing aside of the lane. */
const passable = (grid: Grid, x: number, y: number) => !blocksLaneAt(grid, x, y) || tileAt(grid, x, y) === 'door'

/** Columns a horizontal span covers, ignoring hairline overlaps. */
function columns(left: number, right: number): number[] {
  const out: number[] = []
  for (let x = Math.floor(left + 1e-3); x < right - 1e-3; x += 1) out.push(x)
  return out
}

function rows(top: number, bottom: number): number[] {
  const out: number[] = []
  for (let y = Math.floor(top + 1e-3); y < bottom - 1e-3; y += 1) out.push(y)
  return out
}

/** A hatch or manhole: a door set in a floor, with a ladder down from it. */
const hatchAt = (grid: Grid, x: number, y: number) => tileAt(grid, x, y) === 'door' && tileAt(grid, x, y + 1) === 'ladder'

function insideInterior(level: Level, x: number, y: number): boolean {
  return level.interiors.some((area) => x >= area.x && x < area.x + area.w && y >= area.y && y < area.y + area.h)
}

/** Furniture, wall dressing and ceiling dressing each where it can physically be. */
export function propProblems(level: Level): string[] {
  const { grid } = level
  const problems: string[] = []
  const seen = new Set<string>()
  const roomById = new Map(level.rooms.map((room) => [room.id, room]))
  problems.push(...hangingClashes(level))
  for (const prop of level.props) {
    const spec = propSpec(prop.kind)
    const half = spec.w / 2
    const [left, right] = [prop.x + 0.5 - half, prop.x + 0.5 + half]
    const where = `${prop.kind} at ${prop.x},${prop.y} (room ${prop.roomId})`
    const key = `${prop.kind}:${prop.x}:${prop.y}`
    if (seen.has(key)) problems.push(`${where} stacked on another`)
    seen.add(key)
    if (left < 0 || right > grid.width || prop.y < 0 || prop.y >= grid.height) problems.push(`${where} off the map`)
    // Razor wire is strung along a fence top and overhangs it on purpose.
    if (prop.kind === 'razorCoil') continue
    const room = prop.roomId === undefined ? undefined : roomById.get(prop.roomId)
    // The small outpost has no room records to belong to.
    if (!room && level.rooms.length > 0) problems.push(`${where} belongs to no room`)
    else if (room && (left < room.x - 1e-3 || right > room.x + room.w + 1e-3 || (spec.mount === 'floor' ? prop.y !== room.floorY : prop.y < room.y - 1e-3 || prop.y + spec.h > room.floorY + 1e-3))) {
      problems.push(`${where} stands outside its room`)
    }
    if (spec.mount === 'floor') {
      for (const x of columns(left, right)) {
        if (!solid(grid, x, prop.y)) problems.push(`${where} floats over ${x}`)
        for (const y of rows(prop.y - Math.max(spec.h, 0.1), prop.y)) {
          if (solid(grid, x, y)) problems.push(`${where} inside ${tileAt(grid, x, y)} at ${x},${y}`)
          else if (tileAt(grid, x, y) === 'ladder') problems.push(`${where} in the way of the ladder at ${x}`)
        }
        // A rug can lie over a hatch; anything standing on one would drop through when it opens, and blocks the climb.
        if (spec.h > 0.1 && hatchAt(grid, x, prop.y)) problems.push(`${where} stands on the hatch at ${x}`)
      }
    } else if (spec.mount === 'wall') {
      for (const x of columns(left, right)) {
        for (const y of rows(prop.y, prop.y + spec.h)) {
          if (solid(grid, x, y)) problems.push(`${where} on ${tileAt(grid, x, y)} at ${x},${y}`)
          else if (!insideInterior(level, x + 0.5, y + 0.5)) problems.push(`${where} with no wall behind at ${x},${y}`)
        }
      }
    } else {
      for (const x of columns(left, right)) {
        if (solid(grid, x, prop.y)) problems.push(`${where} inside ${tileAt(grid, x, prop.y)}`)
        if (!solid(grid, x, prop.y - 1)) problems.push(`${where} with no ceiling above at ${x}`)
        if (tileAt(grid, x, prop.y + 1) === 'duct') problems.push(`${where} up inside a duct's crawl space at ${x}`)
      }
    }
  }
  return problems
}

/** Wall items hanging into each other, and ceiling items hanging through each other, in one room. */
function hangingClashes(level: Level): string[] {
  const problems: string[] = []
  const byRoom = new Map<number, Level['props']>()
  for (const prop of level.props) {
    if (prop.roomId === undefined || propSpec(prop.kind).mount === 'floor') continue
    byRoom.set(prop.roomId, [...(byRoom.get(prop.roomId) ?? []), prop])
  }
  for (const props of byRoom.values()) {
    for (let a = 0; a < props.length; a += 1) {
      for (let b = a + 1; b < props.length; b += 1) {
        const [p, q] = [props[a], props[b]]
        const [ps, qs] = [propSpec(p.kind), propSpec(q.kind)]
        if (ps.mount !== qs.mount) continue
        const across = Math.min(p.x + ps.w / 2, q.x + qs.w / 2) - Math.max(p.x - ps.w / 2, q.x - qs.w / 2)
        const down = Math.min(p.y + ps.h, q.y + qs.h) - Math.max(p.y, q.y)
        if (across > 0.2 && down > 0.1) problems.push(`${p.kind} at ${p.x},${p.y} and ${q.kind} at ${q.x},${q.y} hang through each other`)
      }
    }
  }
  return problems
}

/** A spot someone stands on: solid underfoot and room for a body above. */
function standable(grid: Grid, x: number, y: number): boolean {
  return solid(grid, x, y) && !solid(grid, x, y - 1) && !solid(grid, x, y - 2)
}

/** Lamps, devices, pickups, guards, the loot and the way out, each where it can be. */
export function fixtureProblems(level: Level): string[] {
  const { grid } = level
  const problems: string[] = []
  const lamps = new Set<string>()
  for (const lamp of level.lamps) {
    const where = `${lamp.fixture} lamp at ${lamp.x},${lamp.y}`
    if (solid(grid, lamp.x, lamp.y)) problems.push(`${where} inside ${tileAt(grid, Math.floor(lamp.x), Math.floor(lamp.y))}`)
    if (lamp.hung && !solid(grid, lamp.x, Math.floor(lamp.y) - 1)) problems.push(`${where} hung from nothing`)
    const key = `${lamp.x}:${lamp.y}`
    if (lamps.has(key)) problems.push(`${where} on top of another lamp`)
    lamps.add(key)
  }
  const devices = new Set<string>()
  for (const device of level.devices) {
    const where = `${device.kind} at ${device.x},${device.y}`
    const key = `${device.x}:${device.y}`
    if (devices.has(key)) problems.push(`${where} on top of another device`)
    devices.add(key)
    // A terminal (and a relay set on a radio) stands on the floor: its y is the floor row.
    const onFloor = device.kind === 'computer' || (device.kind === 'radioRelay' && solid(grid, device.x, device.y))
    if (onFloor && !standable(grid, device.x, device.y)) problems.push(`${where} not on a floor`)
    if (!onFloor && solid(grid, device.x, device.y)) problems.push(`${where} inside ${tileAt(grid, Math.floor(device.x), device.y)}`)
    if (!onFloor && !insideInterior(level, device.x + 0.5, device.y + 0.5) && device.kind !== 'camera') problems.push(`${where} with no wall behind`)
    if (device.kind === 'keypad') {
      const target = device.target
      if (typeof target !== 'object' || tileAt(grid, target.x, target.y) !== 'door') problems.push(`${where} guards no door`)
    }
  }
  for (const pickup of level.pickups) if (!standable(grid, pickup.x, pickup.y)) problems.push(`${pickup.kind} at ${pickup.x},${pickup.y} not on a floor`)
  const posts = new Set<string>()
  for (const guard of level.guards) {
    const where = `${guard.role ?? 'guard'} at ${guard.x},${guard.y}`
    if (!standable(grid, guard.x, guard.y)) problems.push(`${where} not on a floor`)
    if (hatchAt(grid, guard.x, guard.y)) problems.push(`${where} stands on a hatch`)
    if (posts.has(`${guard.x}:${guard.y}`)) problems.push(`${where} inside another guard`)
    posts.add(`${guard.x}:${guard.y}`)
  }
  if (!standable(grid, level.loot.x, level.loot.y)) problems.push('loot not on a floor')
  const { extraction } = level
  if (!columns(extraction.x, extraction.x + extraction.w).some((x) => standable(grid, x, extraction.y + extraction.h))) problems.push('extraction has no floor')
  for (const shaft of level.elevators) {
    const door = shaft.doorSide === 1 ? shaft.x + shaft.w : shaft.x - 1
    for (const stop of shaft.stops) {
      if (!standable(grid, door + shaft.doorSide, stop)) problems.push(`elevator ${shaft.id} stop ${stop} opens onto no floor`)
      if (tileAt(grid, door, stop - 1) !== 'door') problems.push(`elevator ${shaft.id} stop ${stop} has no door`)
    }
  }
  return problems
}

/**
 * Who is moving: the player uses everything; an alerted guard keeps to doors, stairs and ladders;
 * a calm guard to doors and stairs.
 */
export type Mover = 'player' | 'guard' | 'calm'

/**
 * Every feet position (column, row) someone can reach from `start`, walking, stepping up a tile, falling (player only),
 * climbing ladders (not calm guards), taking stairs and riding elevators (player only). Doors count as open: every lock can be picked.
 * Ladder hatches and elevator shafts are walked past at each floor they open in, as the game does (see gaps/holes.ts).
 */
export function reachable(level: Level, start: { x: number; y: number }, mover: Mover): Uint8Array {
  const { grid } = level
  const { width, height } = grid
  markAside(level)
  const built = createHoles(level).built
  const seen = new Uint8Array(width * height)
  const valid = (x: number, y: number) => x >= 0 && x < width && y >= 2 && y < height && passable(grid, x, y - 1) && passable(grid, x, y - 2)
  const ladder = (x: number, y: number) => tileAt(grid, x, y) === 'ladder'
  const walkedPast = (x: number, y: number) => built[y * width + x] !== 0
  // A calm guard does not climb, but walks past the top of a ladder hole like any other.
  const supported = (x: number, y: number) => solid(grid, x, y) || walkedPast(x, y) || (mover !== 'calm' && (ladder(x, y) || ladder(x, y - 1)))
  const links = new Map<number, number[]>()
  const link = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const [ka, kb] = [a.y * width + a.x, b.y * width + b.x]
    links.set(ka, [...(links.get(ka) ?? []), kb])
    links.set(kb, [...(links.get(kb) ?? []), ka])
  }
  for (const well of level.stairwells) {
    for (let stop = 0; stop + 1 < well.stops.length; stop += 1) {
      link({ x: Math.floor(landingX(well, stop)), y: well.stops[stop] }, { x: Math.floor(landingX(well, stop + 1)), y: well.stops[stop + 1] })
    }
  }
  if (mover === 'player') {
    for (const shaft of level.elevators) {
      const outside = shaft.doorSide === 1 ? shaft.x + shaft.w + 1 : shaft.x - 2
      for (let stop = 0; stop + 1 < shaft.stops.length; stop += 1) link({ x: outside, y: shaft.stops[stop] }, { x: outside, y: shaft.stops[stop + 1] })
    }
  }
  const queue: number[] = []
  const push = (x: number, y: number) => {
    const key = y * width + x
    if (seen[key]) return
    seen[key] = 1
    queue.push(key)
  }
  const land = (x: number, y: number): number | null => {
    for (let below = y; below < height; below += 1) {
      if (!valid(x, below)) return null
      if (supported(x, below)) return below
    }
    return null
  }
  const first = land(Math.floor(start.x), Math.max(2, Math.floor(start.y)))
  if (first === null) return seen
  push(Math.floor(start.x), first)
  while (queue.length > 0) {
    const key = queue.pop()!
    const [x, y] = [key % width, Math.floor(key / width)]
    for (const next of links.get(key) ?? []) push(next % width, Math.floor(next / width))
    for (const dx of [-1, 1]) {
      const nx = x + dx
      if (valid(nx, y) && supported(nx, y)) push(nx, y)
      else if (valid(nx, y) && mover === 'player') {
        const landed = land(nx, y)
        if (landed !== null) push(nx, landed)
      } else if (!valid(nx, y) && valid(nx, y - 1) && supported(nx, y - 1) && passable(grid, x, y - 3)) push(nx, y - 1)
    }
    if (mover === 'calm') continue
    const hatch = (row: number) => tileAt(grid, x, row) === 'door' && ladder(x, row + 1)
    if (valid(x, y - 1) && (ladder(x, y - 1) || (hatch(y - 1) && ladder(x, y)))) push(x, y - 1)
    if (valid(x, y + 1) && (ladder(x, y) || hatch(y))) push(x, y + 1)
  }
  return seen
}

/** Where a parachute dropped straight down from the start would land. */
export function dropZone(level: Level): { x: number; y: number } {
  return { x: Math.floor(level.playerStart.x + 0.35), y: Math.floor(level.playerStart.y) }
}

export function reachedRoom(level: Level, seen: Uint8Array, room: Room): boolean {
  const { width } = level.grid
  for (let x = room.x; x < room.x + room.w; x += 1) if (seen[room.floorY * width + x]) return true
  return false
}

export function reachedSpot(level: Level, seen: Uint8Array, x: number, y: number): boolean {
  return seen[Math.floor(y) * level.grid.width + Math.floor(x)] === 1
}

/** What other systems look for in a room of each kind (gas rings, taps, stalls, a car, racks): one of each group. */
const FITTED: Partial<Record<Room['kind'], readonly (readonly PropKind[])[]>> = {
  kitchen: [['stove']], restroom: [['toiletStall', 'toilet'], ['sink']], breakRoom: [['sink']], garage: [['car', 'van', 'truck']], server: [['serverRack']],
}
/** Papers a player reads with E, from no further than this from his middle (intel/sources.ts), standing 0.8 above his feet. */
const READABLE = new Set<PropKind>(['whiteboard', 'noticeBoard', 'paperStack'])
const READ_REACH = 2
const STANDING_MIDDLE = 0.8

/**
 * Every indoor room furnished for what it is, with the fittings and a hiding place its kind promises, papers within
 * reading reach, and lit, with its lights on a switch or fuse box.
 */
export function roomProblems(level: Level): string[] {
  const problems: string[] = []
  const switched = new Set(level.devices.filter((device) => device.kind === 'lightSwitch' || device.kind === 'fusebox').map((device) => device.circuit))
  for (const room of level.rooms.filter(isIndoor)) {
    const where = `${room.kind} ${room.id} (${room.building}:${room.storey} x${room.x})`
    const mine = level.props.filter((prop) => prop.roomId === room.id)
    const floor = mine.filter((prop) => propSpec(prop.kind).mount === 'floor')
    if (floor.length === 0) problems.push(`${where} has no furniture`)
    const kinds = new Set(mine.map((prop) => prop.kind))
    for (const group of FITTED[room.kind] ?? []) if (!group.some((kind) => kinds.has(kind))) problems.push(`${where} has no ${group.join(' or ')}`)
    // A locker, closet, stall or cabinet the furnisher adds, or a desk or bed to crawl under.
    if (HIDES[room.kind] && !mine.some((prop) => spotKind(prop.kind)?.player)) problems.push(`${where} has nowhere to hide`)
    for (const paper of mine.filter((prop) => READABLE.has(prop.kind))) {
      const spec = propSpec(paper.kind)
      const middle = spec.mount === 'floor' ? paper.y - spec.h / 2 : paper.y + spec.h / 2
      if (room.floorY - STANDING_MIDDLE - middle > READ_REACH) problems.push(`${where}: ${paper.kind} at ${paper.x} hangs out of reading reach`)
    }
    const lamps = level.lamps.filter((lamp) => lamp.x >= room.x && lamp.x <= room.x + room.w && lamp.y >= room.y - 1 && lamp.y <= room.floorY)
    if (lamps.length === 0) problems.push(`${where} has no light`)
    const circuits = new Set(lamps.map((lamp) => lamp.circuit).filter((circuit) => circuit !== undefined))
    if (circuits.size > 0 && ![...circuits].some((circuit) => switched.has(circuit))) problems.push(`${where} has lights no switch or fuse box controls`)
    const solid = floor.filter((prop) => propSpec(prop.kind).h > 0.1).map((prop) => ({ prop, half: propSpec(prop.kind).w / 2 }))
    for (let a = 0; a < solid.length; a += 1) {
      for (let b = a + 1; b < solid.length; b += 1) {
        const [p, q] = [solid[a], solid[b]]
        const overlap = Math.min(p.prop.x + p.half, q.prop.x + q.half) - Math.max(p.prop.x - p.half, q.prop.x - q.half)
        if (overlap > Math.min(p.half, q.half)) problems.push(`${where}: ${p.prop.kind} at ${p.prop.x} and ${q.prop.kind} at ${q.prop.x} stand in each other`)
      }
    }
  }
  return problems
}

/** Devices that make sense: wired to something, watching something, controllable from somewhere. */
export function deviceProblems(level: Level): string[] {
  const problems: string[] = []
  const roomById = new Map(level.rooms.map((room) => [room.id, room]))
  const circuits = new Set(level.lamps.map((lamp) => lamp.circuit))
  const floorKey = (room: Room | undefined) => (room ? `${room.building}:${room.storey}` : '?')
  const terminalFloors = new Set(level.devices.filter((device) => device.kind === 'computer').map((device) => floorKey(roomById.get(device.roomId ?? -1))))
  const securityBuildings = new Set(level.rooms.filter((room) => room.kind === 'security').map((room) => room.building))
  for (const device of level.devices) {
    const where = `${device.kind} at ${device.x},${device.y}`
    const room = device.roomId === undefined ? undefined : roomById.get(device.roomId)
    if (!room) problems.push(`${where} in no room`)
    if ((device.kind === 'fusebox' || device.kind === 'lightSwitch') && !circuits.has(device.circuit)) problems.push(`${where} powers no lamp`)
    if (device.kind === 'camera') {
      if (securityBuildings.size === 0) problems.push(`${where} has nobody watching`)
      if (!terminalFloors.has(floorKey(room))) problems.push(`${where} on ${floorKey(room)} has no terminal on its floor`)
    }
    if (device.kind === 'keypad' && typeof device.target === 'object' && !standable(level.grid, device.x, device.target.y + 1)) problems.push(`${where} out of reach of a floor`)
  }
  return problems
}

/** Guards posted on real floors in their own room, patrols walking routes they can walk. */
export function guardProblems(level: Level): string[] {
  const problems: string[] = []
  const roomById = new Map(level.rooms.map((room) => [room.id, room]))
  for (const guard of level.guards) {
    const where = `${guard.role} guard at ${guard.x},${guard.y}`
    const room = guard.roomId === undefined ? undefined : roomById.get(guard.roomId)
    if (room && (guard.y !== room.floorY || guard.x < room.x - 1 || guard.x > room.x + room.w)) problems.push(`${where} outside his room ${room.kind} ${room.id}`)
    if (!guard.route) continue
    const seen = reachable(level, guard, 'calm')
    for (const point of guard.route) if (!reachedSpot(level, seen, point.x, point.y)) problems.push(`${where} cannot walk to route point ${point.x},${point.y}`)
  }
  return problems
}

const CASE_KINDS = new Set<Room['kind']>(Object.values(PLACE_ROOMS).flat())

/** Feet spots of the van's floor. */
function vanFloor(level: Level): { x: number; y: number }[] {
  const { extraction: van } = level
  return Array.from({ length: van.w }, (_, index) => ({ x: van.x + index, y: van.y + van.h }))
}

/**
 * Every room the case could be hidden in (whichever the heist picks) can be reached from the drop and left for the van,
 * and has at least two quiet ways in, so one guarded door is never the only way.
 */
export function caseRoomProblems(level: Level): string[] {
  const problems: string[] = []
  const fromDrop = reachable(level, dropZone(level), 'player')
  for (const room of level.rooms.filter((candidate) => CASE_KINDS.has(candidate.kind) && isIndoor(candidate) && candidate.building !== 'silo')) {
    const where = `${room.kind} ${room.id} (${room.building}:${room.storey} x${room.x})`
    if (!reachedRoom(level, fromDrop, room)) problems.push(`${where} cannot be reached from the drop`)
    const back = reachable(level, { x: room.x + Math.floor(room.w / 2), y: room.floorY }, 'player')
    if (!vanFloor(level).some((spot) => reachedSpot(level, back, spot.x, spot.y))) problems.push(`${where} has no way back to the van`)
    const ways = quietWaysInto(level.grid, level.devices, room)
    if (ways.length < 2) problems.push(`${where} has only ${ways.join(', ') || 'no way'} in`)
  }
  return problems
}

/** The sewer joins up: down a street manhole from the van, along to the tower's basement hatch and up into the tower. */
export function sewerProblems(level: Level): string[] {
  const sewer = level.rooms.find((room) => room.kind === 'sewer')
  if (!sewer) return ['no sewer']
  const problems: string[] = []
  const fromVan = reachable(level, vanFloor(level)[0], 'player')
  if (!reachedRoom(level, fromVan, sewer)) problems.push('the sewer cannot be reached from the van')
  const below = reachable(level, { x: sewer.x + Math.floor(sewer.w / 2), y: sewer.floorY }, 'player')
  const lowest = Math.max(...level.rooms.filter((room) => room.building === 'tower').map((room) => room.floorY))
  const basement = level.rooms.filter((room) => room.building === 'tower' && room.floorY === lowest && room.kind !== 'vault')
  if (!basement.some((room) => reachedRoom(level, below, room))) problems.push('the sewer leads nowhere into the tower')
  return problems
}
