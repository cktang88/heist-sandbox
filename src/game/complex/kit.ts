import { randomInt, type Rng } from '../rng'
import { LIGHT, type DeviceSpawn, type ElevatorShaft, type GuardSpawn, type Interior, type Lamp, type PickupSpawn, type Prop, type Room, type RoomKind, type Stairwell } from '../site'
import { chunkIndex, CHUNK_TILES, TILE_DEFS, TILE_KINDS, type Grid, type TileKind } from '../tiles'

/** Rows from one floor to the next: five rows of open room plus a one-row slab. */
export const STOREY = 6
export const ROOM_HEIGHT = STOREY - 1

/** Everything a site is assembled into while it is being generated. */
export type SiteDraft = {
  grid: Grid
  rng: Rng
  groundY: number
  rooms: Room[]
  interiors: Interior[]
  stairwells: Stairwell[]
  elevators: ElevatorShaft[]
  lamps: Lamp[]
  props: Prop[]
  guards: GuardSpawn[]
  pickups: PickupSpawn[]
  devices: DeviceSpawn[]
}

export function createDraft(grid: Grid, rng: Rng, groundY: number): SiteDraft {
  return { grid, rng, groundY, rooms: [], interiors: [], stairwells: [], elevators: [], lamps: [], props: [], guards: [], pickups: [], devices: [] }
}

/** How locked-down each kind of room is: 0 public, 1 staff, 2 restricted, 3 vault. */
const SECURITY: Partial<Record<RoomKind, Room['security']>> = {
  security: 2, armory: 2, server: 2, cells: 2, executive: 2, penthouse: 2, lab: 1, archive: 1, electrical: 1,
  mechanical: 1, barracks: 1, lockers: 1, office: 1, conference: 1, storage: 1, garage: 1, workshop: 1, vault: 3,
}

/** Colour and strength of the plain ceiling lights each kind of room starts with. */
const ROOM_LIGHT: Partial<Record<RoomKind, { color: number; strength: number; gap: number }>> = {
  executive: { color: LIGHT.warm, strength: 0.8, gap: 11 },
  penthouse: { color: LIGHT.lamp, strength: 0.7, gap: 12 },
  lounge: { color: LIGHT.warm, strength: 0.8, gap: 11 },
  barracks: { color: LIGHT.warm, strength: 0.7, gap: 10 },
  lobby: { color: LIGHT.warm, strength: 1.2, gap: 9 },
  lab: { color: LIGHT.sterile, strength: 1.2, gap: 8 },
  server: { color: LIGHT.cyan, strength: 0.6, gap: 10 },
  infirmary: { color: LIGHT.sterile, strength: 1.2, gap: 8 },
  vault: { color: LIGHT.sterile, strength: 1.1, gap: 8 },
  garage: { color: LIGHT.sodium, strength: 0.8, gap: 13 },
  mechanical: { color: LIGHT.sodium, strength: 0.6, gap: 14 },
  electrical: { color: LIGHT.sodium, strength: 0.6, gap: 14 },
  storage: { color: LIGHT.office, strength: 0.6, gap: 13 },
  sewer: { color: LIGHT.green, strength: 0.6, gap: 18 },
  stairwell: { color: LIGHT.office, strength: 0.7, gap: 20 },
}
const DEFAULT_LIGHT = { color: LIGHT.office, strength: 1, gap: 9 }

export function circuitOf(building: string, storey: number): number {
  let hash = 0
  for (const letter of building) hash = (hash * 31 + letter.charCodeAt(0)) % 997
  return hash * 100 + storey + 50
}

/**
 * Records a room and gives it plain ceiling lights. `left` and `right` are the first and last open columns;
 * `floorY` is the slab row its occupants stand on. Taller rooms pass a bigger `height`.
 */
export function addRoom(site: SiteDraft, kind: RoomKind, building: string, storey: number, left: number, right: number, floorY: number, height = ROOM_HEIGHT): Room {
  const room: Room = {
    id: site.rooms.length, kind, building, storey, x: left, y: floorY - height, w: right - left + 1, h: height, floorY,
    security: SECURITY[kind] ?? 0,
  }
  site.rooms.push(room)
  const light = ROOM_LIGHT[kind] ?? DEFAULT_LIGHT
  const count = Math.max(1, Math.round(room.w / light.gap))
  for (let index = 0; index < count; index += 1) {
    site.lamps.push({
      x: left + ((index + 0.5) * room.w) / count, y: room.y + 0.2, fixture: 'ceilingPanel', color: light.color,
      radius: 9, strength: light.strength, hung: true, circuit: circuitOf(building, storey),
    })
  }
  return room
}

/**
 * Sets a rectangle of tiles, the same as `fillTiles`, but writes the grid directly and flags each touched chunk
 * once instead of once per tile: the site is built from large fills, and per-tile bookkeeping was a fifth of it.
 */
export function fill(site: SiteDraft, ax: number, ay: number, bx: number, by: number, kind: TileKind): void {
  const { grid } = site
  const [x0, x1] = [Math.max(0, Math.min(ax, bx)), Math.min(grid.width - 1, Math.max(ax, bx))]
  const [y0, y1] = [Math.max(0, Math.min(ay, by)), Math.min(grid.height - 1, Math.max(ay, by))]
  if (x0 > x1 || y0 > y1) return
  const code = TILE_KINDS.indexOf(kind)
  const { hp } = TILE_DEFS[kind]
  for (let y = y0; y <= y1; y += 1) {
    grid.kinds.fill(code, y * grid.width + x0, y * grid.width + x1 + 1)
    grid.hp.fill(hp, y * grid.width + x0, y * grid.width + x1 + 1)
  }
  grid.version += (x1 - x0 + 1) * (y1 - y0 + 1)
  // Tiles on a chunk edge also dirty the neighbouring chunk, as `setTile` does.
  const last = { x: Math.ceil(grid.width / CHUNK_TILES) - 1, y: Math.ceil(grid.height / CHUNK_TILES) - 1 }
  for (let cy = Math.max(0, Math.floor((y0 - 1) / CHUNK_TILES)); cy <= Math.min(last.y, Math.floor((y1 + 1) / CHUNK_TILES)); cy += 1) {
    for (let cx = Math.max(0, Math.floor((x0 - 1) / CHUNK_TILES)); cx <= Math.min(last.x, Math.floor((x1 + 1) / CHUNK_TILES)); cx += 1) grid.dirtyChunks.add(chunkIndex(grid, cx, cy))
  }
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[randomInt(rng, 0, items.length - 1)]
}

export function chance(rng: Rng, odds: number): boolean {
  return rng() < odds
}
