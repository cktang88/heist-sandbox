import { createRng, randomInt } from '../rng'
import { LIGHT, roomAt, type Level, type Room, type RoomKind } from '../site'
import { createGrid, setTile, tileAt } from '../tiles'
import { furnishSite } from '../furnish/furnish'
import { buildBlock, staff } from './block'
import { addDucts } from './ducts'
import { addRoom, chance, circuitOf, createDraft, fill, pick, ROOM_HEIGHT, STOREY, type SiteDraft } from './kit'

export const COMPLEX_WIDTH = 300
export const COMPLEX_HEIGHT = 204
/** Row of the street surface. Everything above is open sky until a building is raised into it. */
export const COMPLEX_GROUND = 164

const FRONT_FENCE = 34
const REAR_FENCE = 272
const FENCE_HEIGHT = 6
const SEWER = { left: 14, right: 290, top: COMPLEX_GROUND + 26, bottom: COMPLEX_GROUND + 29 }
const DEPOT = { x0: 52, x1: 78 }
const TOWER = { x0: 86, x1: 186 }
const QUARTERS = { x0: 194, x1: 232 }
const SILOS = [{ x0: 238, x1: 249 }, { x0: 254, x1: 265 }]
const SILO_HEIGHT = 28
const BRIDGE_STOREY = 5

/** What each band of the tower is used for, bottom to top. */
function towerPlan(storeys: number): (storey: number) => readonly RoomKind[] {
  return (storey) => {
    if (storey <= -3) return ['archive', 'storage', 'mechanical']
    if (storey === -2) return ['mechanical', 'electrical', 'storage', 'janitor']
    if (storey === -1) return ['garage', 'garage', 'storage', 'loadingDock']
    if (storey === 0) return ['lobby', 'lobby', 'security', 'lounge', 'restroom']
    if (storey <= 2) return ['cafeteria', 'kitchen', 'breakRoom', 'lounge', 'restroom', 'conference']
    if (storey <= Math.floor(storeys * 0.45)) return ['office', 'office', 'office', 'conference', 'breakRoom', 'restroom', 'archive', 'janitor']
    if (storey <= Math.floor(storeys * 0.62)) return ['lab', 'lab', 'server', 'server', 'storage', 'office', 'infirmary']
    if (storey <= Math.floor(storeys * 0.78)) return ['security', 'armory', 'cells', 'barracks', 'lockers', 'office']
    if (storey < storeys - 1) return ['executive', 'executive', 'conference', 'archive', 'lounge', 'office']
    return ['penthouse', 'executive', 'lounge']
  }
}

/**
 * A large guarded complex: a tower of twenty or more storeys with three basements, a depot,
 * living quarters joined to the tower by a sky bridge, two storage silos, a fenced yard with
 * watchtowers and a gatehouse, and a sewer running under all of it.
 */
export function createComplex(seed: number): Level {
  const rng = createRng(seed)
  const grid = createGrid(COMPLEX_WIDTH, COMPLEX_HEIGHT)
  const site = createDraft(grid, rng, COMPLEX_GROUND)
  const ground = COMPLEX_GROUND
  const storeys = randomInt(rng, 20, 24)

  fill(site, 0, ground, COMPLEX_WIDTH - 1, COMPLEX_HEIGHT - 3, 'dirt')
  fill(site, 0, COMPLEX_HEIGHT - 2, COMPLEX_WIDTH - 1, COMPLEX_HEIGHT - 1, 'bedrock')
  site.interiors.push({ kind: 'earth', x: 0, y: ground, w: COMPLEX_WIDTH, h: COMPLEX_HEIGHT - ground })

  buildSewer(site)

  buildBlock(site, {
    name: 'depot', ...DEPOT, storeys: 3, basements: 0, facade: 'brick', doors: [-1, 1],
    plan: (storey) => (storey === 0 ? ['loadingDock', 'loadingDock', 'garage'] : storey === 1 ? ['storage', 'storage', 'workshop'] : ['workshop', 'office', 'storage']),
    stairs: [{ x: 62, w: 8, from: 0, to: 3 }],
    shafts: [],
  })
  buildBlock(site, {
    name: 'tower', ...TOWER, storeys, basements: 3, facade: 'concrete', doors: [-1, 1], plan: towerPlan(storeys),
    stairs: [
      { x: 130, w: 12, from: -3, to: storeys },
      { x: 160, w: 10, from: 0, to: Math.floor(storeys * 0.7) },
    ],
    shafts: [{ x: TOWER.x0 + 1, w: 4, from: -3, to: storeys - 3, doorSide: 1 }],
  })
  buildBlock(site, {
    name: 'quarters', ...QUARTERS, storeys: 6, basements: 1, facade: 'brick', doors: [-1],
    plan: (storey) => (storey < 0 ? ['armory', 'storage', 'lockers'] : storey === 0 ? ['cafeteria', 'kitchen', 'lounge'] : storey <= 2 ? ['barracks', 'barracks', 'lockers', 'restroom'] : storey === 3 ? ['gym', 'infirmary', 'lockers'] : ['barracks', 'lounge', 'office', 'security']),
    stairs: [{ x: 206, w: 10, from: -1, to: 6 }],
    shafts: [{ x: QUARTERS.x1 - 4, w: 4, from: -1, to: 5, doorSide: -1 }],
  })

  buildSkyBridge(site)
  for (const silo of SILOS) buildSilo(site, silo.x0, silo.x1)
  buildPerimeter(site)
  outdoorAreas(site, storeys)

  ensureSecurityRoom(site)
  const vault = placeVault(site)
  roamingPatrols(site)
  assignGuardRooms(site)
  // Furnish first, so the ducts can re-hang whatever ceiling fittings end up under them.
  furnishSite(site)
  addDucts(site)

  return {
    name: 'Blackmoor Complex',
    timeOfDay: chance(rng, 0.35) ? 'day' : 'night',
    grid,
    groundY: ground,
    playerStart: { x: 60, y: 2 },
    extraction: { x: 3, y: ground - 4, w: 8, h: 4 },
    loot: { x: vault.x + Math.floor(vault.w / 2), y: vault.floorY },
    guards: site.guards,
    interiors: site.interiors,
    rooms: site.rooms,
    stairwells: site.stairwells,
    elevators: site.elevators,
    lamps: site.lamps,
    props: site.props,
    pickups: site.pickups,
    devices: site.devices,
  }
}

function buildSewer(site: SiteDraft): void {
  const ground = site.groundY
  fill(site, SEWER.left - 1, SEWER.top - 1, SEWER.right + 1, SEWER.bottom + 1, 'brick')
  fill(site, SEWER.left, SEWER.top, SEWER.right, SEWER.bottom, 'air')
  fill(site, SEWER.left, SEWER.bottom, SEWER.right, SEWER.bottom, 'water')
  const sewer = addRoom(site, 'sewer', 'sewer', -5, SEWER.left, SEWER.right, SEWER.bottom + 1, 4)
  // The sewer lights' fuse box, on the wall at the foot of the yard manhole.
  site.devices.push({ kind: 'fusebox', x: 83, y: sewer.floorY - 2, roomId: sewer.id, circuit: circuitOf('sewer', sewer.storey) })
  // Manholes on the street, in the yard and behind the rear fence: a cover people walk over, opened like a hatch.
  // The ladders reach down into the water, so someone standing on the sewer floor can take hold of them.
  for (const x of [22, 82, 285]) {
    fill(site, x, ground + 1, x, SEWER.bottom, 'ladder')
    setTile(site.grid, x, ground, 'door')
  }
  site.guards.push({ x: 120, y: SEWER.bottom + 1, facing: -1, role: 'patrol', route: [{ x: 60, y: SEWER.bottom + 1 }, { x: 200, y: SEWER.bottom + 1 }] })
}

/** A glazed walkway from the tower to the living quarters, several storeys up. */
function buildSkyBridge(site: SiteDraft): void {
  const floorY = site.groundY - BRIDGE_STOREY * STOREY
  const [from, to] = [TOWER.x1, QUARTERS.x0]
  // The deck can be blown out like any floor; only its ends, the buildings' slab ends, are part of the frame.
  fill(site, from + 1, floorY, to - 1, floorY, 'concrete')
  fill(site, from, floorY - STOREY, to, floorY - STOREY, 'steel')
  // The doorways replace any window there, so no sliver of a pane is left above a door.
  fill(site, from, floorY - 4, from, floorY - 1, 'concrete')
  fill(site, to, floorY - 4, to, floorY - 1, 'brick')
  fill(site, from, floorY - 3, from, floorY - 1, 'door')
  fill(site, to, floorY - 3, to, floorY - 1, 'door')
  site.interiors.push({ kind: 'room', x: from + 1, y: floorY - STOREY, w: to - from - 1, h: STOREY })
  site.lamps.push({ x: (from + to) / 2 + 0.5, y: floorY - ROOM_HEIGHT + 0.2, fixture: 'fluorescentTube', color: LIGHT.sterile, radius: 7, strength: 0.8, hung: true })
}

/** A hollow steel tank with inner platforms and ladders, and a drain down to the sewer. */
function buildSilo(site: SiteDraft, x0: number, x1: number): void {
  const ground = site.groundY
  const top = ground - SILO_HEIGHT
  fill(site, x0, top, x1, ground - 1, 'air')
  fill(site, x0, top, x0, ground - 1, 'steel')
  fill(site, x1, top, x1, ground - 1, 'steel')
  fill(site, x0, top, x1, top, 'steel')
  fill(site, x0, ground, x1, ground, 'concrete')
  for (let level = 1; level <= 3; level += 1) {
    const y = ground - level * 7
    const fromLeft = level % 2 === 1
    fill(site, fromLeft ? x0 + 1 : x0 + 4, y, fromLeft ? x1 - 4 : x1 - 1, y, 'steel')
  }
  fill(site, x1 - 2, top + 1, x1 - 2, ground - 1, 'ladder')
  setTile(site.grid, x1 - 2, top, 'door')
  fill(site, x0, ground - 3, x0, ground - 1, 'door')
  // An outside ladder to the roof hatch.
  fill(site, x1 + 1, top, x1 + 1, ground - 1, 'ladder')
  site.interiors.push({ kind: 'room', x: x0, y: top, w: x1 - x0 + 1, h: SILO_HEIGHT })
  addRoom(site, 'silo', 'silo', 0, x0 + 1, x1 - 1, ground, SILO_HEIGHT - 1)
  if (x0 === SILOS[1].x0) {
    fill(site, x0 + 3, ground + 1, x0 + 3, SEWER.bottom, 'ladder')
    setTile(site.grid, x0 + 3, ground, 'door')
  }
}

function buildPerimeter(site: SiteDraft): void {
  const ground = site.groundY
  for (const x of [FRONT_FENCE, REAR_FENCE]) {
    fill(site, x, ground - FENCE_HEIGHT, x, ground - 1, 'fence')
    site.props.push({ kind: 'razorCoil', x, y: ground - FENCE_HEIGHT })
  }
  // Front gate with a gatehouse beside it.
  fill(site, FRONT_FENCE, ground - 3, FRONT_FENCE, ground - 1, 'door')
  fill(site, 36, ground - STOREY, 43, ground - STOREY, 'concrete')
  fill(site, 43, ground - ROOM_HEIGHT, 43, ground - 1, 'brick')
  fill(site, 43, ground - 3, 43, ground - 1, 'door')
  site.interiors.push({ kind: 'room', x: 36, y: ground - STOREY, w: 8, h: STOREY })
  const gatehouse = addRoom(site, 'gatehouse', 'gatehouse', 0, 36, 42, ground)
  site.guards.push({ x: 39, y: ground, facing: -1, role: 'post', roomId: gatehouse.id })
  site.devices.push({ kind: 'alarmButton', x: 41, y: ground - 2, roomId: gatehouse.id })
  site.devices.push({ kind: 'camera', x: 36, y: ground - 5, roomId: gatehouse.id, facing: -1 })
  site.devices.push({ kind: 'computer', x: 38, y: ground, roomId: gatehouse.id })

  for (const [x, facing] of [[46, -1], [267, 1]] as const) buildWatchtower(site, x, facing)
  for (const x of [8, 24, 44, 82, 190, 236, 280]) {
    site.lamps.push({ x: x + 0.5, y: ground - 5.5, fixture: 'streetLight', color: LIGHT.sodium, radius: 10, strength: 2.4, hung: false })
  }
}

/**
 * A raised platform on legs with a ladder, a floodlight and a sentry. Steel all through, so it can be brought down
 * (it is no part of a building's indestructible frame). The legs are posts standing at the front and back corners,
 * so people on the ground walk between them (see gaps/aside.ts).
 */
function buildWatchtower(site: SiteDraft, x: number, facing: 1 | -1): void {
  const ground = site.groundY
  const deck = ground - 10
  fill(site, x, deck, x + 4, deck, 'steel')
  for (const leg of [x, x + 4]) fill(site, leg, deck + 1, leg, ground - 1, 'steel')
  fill(site, x + 2, deck, x + 2, ground - 1, 'ladder')
  fill(site, x, deck - 5, x + 4, deck - 5, 'steel')
  // Wire mesh sides hold the roof up and still let the sentry see and shoot out.
  fill(site, x, deck - 4, x, deck - 1, 'fence')
  fill(site, x + 4, deck - 4, x + 4, deck - 1, 'fence')
  site.guards.push({ x: x + (facing === 1 ? 3 : 1), y: deck, facing, role: 'sentry' })
  // Just inside the mesh side it shines out of.
  site.lamps.push({ x: x + 2.5 + facing * 1.4, y: deck - 3.5, fixture: 'floodlight', color: LIGHT.sterile, radius: 16, strength: 3, hung: false })
}

/** Records the open-air areas as rooms so they can be dressed and patrolled like any other. */
function outdoorAreas(site: SiteDraft, storeys: number): void {
  const ground = site.groundY
  addRoom(site, 'street', 'grounds', 0, 0, FRONT_FENCE - 1, ground, 8)
  addRoom(site, 'yard', 'grounds', 0, 44, DEPOT.x0 - 1, ground, 8)
  addRoom(site, 'yard', 'grounds', 0, DEPOT.x1 + 1, TOWER.x0 - 1, ground, 8)
  addRoom(site, 'yard', 'grounds', 0, TOWER.x1 + 1, QUARTERS.x0 - 1, ground, 8)
  addRoom(site, 'yard', 'grounds', 0, QUARTERS.x1 + 1, SILOS[0].x0 - 1, ground, 8)
  addRoom(site, 'street', 'grounds', 0, REAR_FENCE + 1, COMPLEX_WIDTH - 1, ground, 8)
  addRoom(site, 'rooftop', 'depot', 3, DEPOT.x0 + 1, DEPOT.x1 - 1, ground - 3 * STOREY, 8)
  addRoom(site, 'rooftop', 'tower', storeys, TOWER.x0 + 1, TOWER.x1 - 1, ground - storeys * STOREY, 8)
  addRoom(site, 'rooftop', 'quarters', 6, QUARTERS.x0 + 1, QUARTERS.x1 - 1, ground - 6 * STOREY, 8)
  // Outdoor rooms got ceiling lights from addRoom; the sky has no ceiling, so drop them.
  const outdoor = new Set<RoomKind>(['street', 'yard', 'rooftop'])
  const openRooms = site.rooms.filter((room) => outdoor.has(room.kind))
  site.lamps = site.lamps.filter((lamp) => !openRooms.some((room) => lamp.fixture === 'ceilingPanel' && Math.abs(lamp.y - (room.y + 0.2)) < 0.01 && lamp.x >= room.x && lamp.x <= room.x + room.w))
  site.guards.push({ x: 150, y: ground - storeys * STOREY, facing: 1, role: 'patrol', route: [{ x: 100, y: ground - storeys * STOREY }, { x: 176, y: ground - storeys * STOREY }] })
  site.guards.push({ x: 66, y: ground, facing: 1, role: 'patrol', route: [{ x: 53, y: ground }, { x: 84, y: ground }] })
  // The quarters have no door on the silo side, so this patrol walks through their ground floor and back.
  site.guards.push({ x: 190, y: ground, facing: -1, role: 'patrol', route: [{ x: 188, y: ground }, { x: 225, y: ground }] })
}

/**
 * Cameras only report while someone watches the monitors, so the tower always has a security room: if its
 * room plan happened to make none, an ordinary room on the ground floor becomes one.
 */
function ensureSecurityRoom(site: SiteDraft): void {
  if (site.rooms.some((room) => room.kind === 'security')) return
  const candidates = site.rooms.filter((room) => room.building === 'tower' && room.storey === 0 && room.security < 2 && room.kind !== 'stairwell')
  const room = pick(site.rng, candidates)
  site.devices = site.devices.filter((device) => device.roomId !== room.id)
  site.guards = site.guards.filter((guard) => guard.roomId !== room.id)
  room.kind = 'security'
  room.security = 2
  staff(site, room)
}

/** A floor with a terminal outside this room, which can switch off the camera a vault here would get. */
function terminalElsewhereOnFloor(site: SiteDraft, room: Room): boolean {
  return site.devices.some((device) => device.kind === 'computer' && device.roomId !== room.id
    && site.rooms.some((other) => other.id === device.roomId && other.building === room.building && other.storey === room.storey))
}

/** The walls of a room that open onto a neighbouring room on the same floor (not the outer wall, a shaft or a void). */
function innerWalls(site: SiteDraft, room: Room): number[] {
  return [room.x - 1, room.x + room.w].filter((wall) => {
    const beyond = roomAt(site.rooms, wall + (wall < room.x ? -0.5 : 1.5), room.floorY - 0.5)
    return beyond !== undefined && beyond.floorY === room.floorY && beyond.building === room.building
  })
}

/** An elevator opens straight into this room: no place for a vault. */
function besideShaft(site: SiteDraft, room: Room): boolean {
  return site.elevators.some((shaft) => shaft.stops.includes(room.floorY) && (shaft.doorSide === 1 ? shaft.x + shaft.w === room.x - 1 : shaft.x - 1 === room.x + room.w))
}

/** Sets steel over a block of tiles, leaving the indestructible frame (slab ends, beams, shaft walls) as it is. */
function armour(site: SiteDraft, x0: number, y0: number, x1: number, y1: number): void {
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) if (tileAt(site.grid, x, y) !== 'reinforced') setTile(site.grid, x, y, 'steel')
  }
}

/**
 * Turns one suitable room into the steel-walled vault that holds the loot. A keypad door is set in each wall
 * that has a room beyond it; an outer wall or shaft wall stays a wall.
 */
function placeVault(site: SiteDraft): Room {
  const candidates = site.rooms.filter((room) => room.building === 'tower' && room.h === ROOM_HEIGHT && room.w >= 10 && room.w <= 22
    && (room.storey === -3 || room.storey >= 14) && room.kind !== 'stairwell' && room.kind !== 'rooftop' && innerWalls(site, room).length > 0
    && !besideShaft(site, room) && terminalElsewhereOnFloor(site, room))
  const room = pick(site.rng, candidates)
  const doors = innerWalls(site, room)
  room.kind = 'vault'
  room.security = 3
  const [left, right] = [room.x - 1, room.x + room.w]
  // Whatever the room held before it became the vault (its terminal, camera, guard) goes with its old use.
  site.devices = site.devices.filter((device) => device.roomId !== room.id)
  for (const wall of [left, right]) armour(site, wall, room.y, wall, room.floorY - 1)
  for (const wall of doors) {
    fill(site, wall, room.floorY - 3, wall, room.floorY - 1, 'door')
    site.devices.push({ kind: 'keypad', x: wall + (wall === left ? -1 : 1), y: room.floorY - 2, roomId: room.id, target: { x: wall, y: room.floorY - 1 } })
  }
  armour(site, left, room.y - 1, right, room.y - 1)
  armour(site, left, room.floorY, right, room.floorY)
  site.guards = site.guards.filter((guard) => guard.roomId !== room.id)
  site.guards.push({ x: room.x + 2, y: room.floorY, facing: 1, role: 'heavy', roomId: room.id })
  site.devices.push({ kind: 'camera', x: room.x + 1, y: room.floorY - 4, roomId: room.id, facing: 1 })
  return room
}

/**
 * One walking patrol per storey of each building, covering two neighbouring rooms joined by a doorway
 * (never across the open void over a double-height room, which a calm guard will not step into, and never
 * through the vault, which only its own guard holds).
 */
function roamingPatrols(site: SiteDraft): void {
  const byFloor = new Map<string, Room[]>()
  for (const room of site.rooms) {
    if (['grounds', 'sewer', 'silo', 'gatehouse'].includes(room.building) || ['rooftop', 'stairwell', 'vault'].includes(room.kind)) continue
    const key = `${room.building}:${room.storey}`
    byFloor.set(key, [...(byFloor.get(key) ?? []), room])
  }
  for (const rooms of byFloor.values()) {
    const sorted = [...rooms].sort((a, b) => a.x - b.x)
    const pairs = sorted.slice(1).map((b, index) => [sorted[index], b] as const).filter(([a, b]) => b.x - (a.x + a.w) <= 1 && a.floorY === b.floorY)
    if (pairs.length === 0 || !chance(site.rng, 0.8)) continue
    const [a, b] = pairs[randomInt(site.rng, 0, pairs.length - 1)]
    site.guards.push({
      x: a.x + Math.floor(a.w / 2), y: a.floorY, facing: 1, role: 'patrol', roomId: a.id,
      route: [{ x: a.x + 2, y: a.floorY }, { x: b.x + b.w - 3, y: b.floorY }],
    })
  }
}

/** Guards posted outside any building's room plan (sentries, yard and sewer patrols) learn which area they are in. */
function assignGuardRooms(site: SiteDraft): void {
  for (const guard of site.guards) guard.roomId ??= roomAt(site.rooms, guard.x + 0.5, guard.y - 0.5)?.id
}
