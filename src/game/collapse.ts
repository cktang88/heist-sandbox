import type { PropState } from './cover'
import { burst } from './effects'
import { propBox, propById, propsAt } from './hazards/props'
import { propSpec } from './propCatalog'
import { hurtGuard } from './guards'
import { emitNoise } from './noise'
import { GRAVITY } from './physics'
import { playSound } from './sounds'
import { builtAs, BUILT_NONE } from './gaps/holes'
import { currentHoles } from './gaps/state'
import { findUnsupportedNear } from './collapseNear'
import { bandOf, CARRIES, DUCT, HANGER_ROWS, SOLID, STOREY, type SlabRow } from './support'
import { changeMark, changesFrom, CLEAR_OF_LANE, RUBBLE, setLaneFlags, setTile, TILE_DEFS, tileAt, type Grid, type TileKind } from './tiles'
import type { Interior } from './site'
import type { Rect } from './types'
import type { World } from './world'

/** A tile that has lost its support and is dropping. It becomes a tile again where it lands. */
export type FallingTile = { x: number; y: number; vy: number; kind: TileKind }

const CRUSH_SPEED = 6
const CRUSH_DAMAGE = 60
const PLAYER_CRUSH_DAMAGE = 25
const MAX_FALL_SPEED = 30
export type { SlabRow } from './support'

/**
 * Finds solid tiles that are no longer held up. A tile is supported when a chain of touching solid tiles
 * (or ladders) links it to the bottom of the map, or to a building slab the back wall still holds (see `holdSlab`).
 * The reinforced frame cannot be destroyed, but it is held like anything else: a piece of it cut off on every side
 * (a beam whose whole storey came down around it) falls too, rather than hanging in the air for ever.
 */
export function findUnsupported(grid: Grid, slabs: readonly SlabRow[] = []): number[] {
  const { width, height, kinds } = grid
  const size = width * height
  clearScratch(size)
  for (let index = (height - 1) * width; index < size; index += 1) if (SOLID[kinds[index]]) reach(kinds, index)
  spread(grid)
  const loose: number[] = []
  for (let index = 0; index < size; index += 1) if (!supported[index] && SOLID[kinds[index]]) loose.push(index)
  // Almost always everything is held by the plain rule; the back walls only need asking when something is not.
  if (loose.length === 0) return loose
  // A slab held from behind holds what hangs from it, which may reach down to (and hold) another slab: go on until none is left.
  const held = new Uint8Array(slabs.length)
  for (let changed = true; changed;) {
    changed = false
    for (let entry = 0; entry < slabs.length; entry += 1) {
      if (held[entry] || !holdSlab(grid, slabs[entry])) continue
      held[entry] = 1
      changed = true
      spread(grid)
    }
  }
  let kept = 0
  for (const index of loose) if (!supported[index]) loose[kept++] = index
  loose.length = kept
  return loose
}

/**
 * Scratch for `findUnsupported`, kept between calls (it runs on every door opened): one flag per tile, and a stack
 * that can hold every tile once.
 */
let supported = new Uint8Array(0)
let stack = new Int32Array(0)
let top = 0

function clearScratch(size: number): void {
  if (supported.length !== size) {
    supported = new Uint8Array(size)
    stack = new Int32Array(size)
  } else supported.fill(0)
  top = 0
}

/** Marks a tile held and queues it, if it carries weight and is not already held. */
function reach(kinds: Uint8Array, next: number): void {
  if (supported[next] || !CARRIES[kinds[next]]) return
  supported[next] = 1
  stack[top++] = next
}

/** Holds everything touching the queued tiles, and so on outwards. */
function spread(grid: Grid): void {
  const { width, kinds } = grid
  const size = kinds.length
  const hanger = HANGER_ROWS * width
  while (top > 0) {
    const index = stack[--top]
    const x = index % width
    if (index >= width) reach(kinds, index - width)
    if (index + width < size) reach(kinds, index + width)
    if (x > 0) reach(kinds, index - 1)
    if (x < width - 1) reach(kinds, index + 1)
    // Ducts hang on rods from the slab two rows up, over their crawl space, not from the doors they pass over.
    if (index + hanger < size && kinds[index + hanger] === DUCT) reach(kinds, index + hanger)
  }
}

/**
 * The building is drawn cut open, but its floors are really also bolted to the back wall (and the unseen front
 * wall), which runs the whole length of the storey, and so are the partitions, lintels and ducts between them. So
 * while any tile of a slab row is still held up, the storey's frame stands, and every remaining tile of that row hangs
 * on from behind, however ragged the holes blown in it, along with everything on the storeys just above and below
 * it: only what a blast destroyed disappears. A storey comes down only once nothing at all holds its slab (its walls
 * and the storeys below are gone). Returns true if it held the row.
 */
function holdSlab(grid: Grid, slab: SlabRow): boolean {
  if (slab.y < 0 || slab.y >= grid.height) return false
  const band = bandOf(grid, slab)
  const row = slab.y * grid.width
  let standing = false
  for (let x = band.x0; x <= band.x1 && !standing; x += 1) standing = supported[row + x] === 1 && SOLID[grid.kinds[row + x]] === 1
  if (!standing) return false
  for (let y = band.y0; y <= band.y1; y += 1) {
    for (let x = band.x0; x <= band.x1; x += 1) if (SOLID[grid.kinds[y * grid.width + x]]) reach(grid.kinds, y * grid.width + x)
  }
  return true
}

/** The slab rows of every building built in whole storeys; silos and watchtowers keep the plain rule. */
export function slabRows(world: World): SlabRow[] {
  const cached = slabCache.get(world.interiors)
  if (cached) return cached
  const rows: SlabRow[] = []
  for (const interior of world.interiors) {
    if (interior.kind !== 'room' || interior.h % STOREY !== 0) continue
    const bottom = interior.y + interior.h
    for (let y = interior.y; y <= bottom; y += STOREY) rows.push({ y, x0: interior.x, x1: interior.x + interior.w - 1, top: interior.y, bottom })
  }
  slabCache.set(world.interiors, rows)
  return rows
}
const slabCache = new WeakMap<readonly Interior[], SlabRow[]>()

/**
 * What the support check has already taken into account for a grid: its position in the grid's change list, and the
 * changed tiles collected since the last check (most changes, such as rubble landing, do not ask for one).
 */
type Watch = { mark: number; pending: number[] }
const watches = new WeakMap<Grid, Watch>()

/**
 * Checks the whole site once, before play, so the first check during play can look only around what changed. If
 * something is already loose, the next step drops it.
 */
export function prepareCollapse(world: World): void {
  const slabs = slabRows(world)
  if (findUnsupported(world.grid, slabs).length > 0) world.structureChanged = true
  else watches.set(world.grid, { mark: changeMark(world.grid), pending: [] })
  // Sizes the local check's buffers to this grid now, not on the first blast.
  findUnsupportedNear(world.grid, slabs, [])
}

/** Turns unsupported tiles into falling ones, then moves everything that is falling. */
export function stepCollapse(world: World, dt: number): void {
  const watch = collectChanges(world.grid)
  if (world.structureChanged) {
    world.structureChanged = false
    for (const index of unsupportedNow(world, watch)) {
      const x = index % world.grid.width
      const y = Math.floor(index / world.grid.width)
      world.falling.push({ x, y, vy: 0, kind: fallsAs(tileAt(world.grid, x, y)) })
      setTile(world.grid, x, y, 'air')
    }
    // The tiles just dropped were all loose, so what was beside them needs no second look.
    watches.set(world.grid, { mark: changeMark(world.grid), pending: [] })
  }
  if (world.falling.length === 0) return

  // Lowest first, so a falling stack lands in order instead of on top of itself.
  const { falling } = world
  sortLowestFirst(falling)
  let kept = 0
  for (const tile of falling) if (!dropTile(world, tile, dt)) falling[kept++] = tile
  falling.length = kept
}

/**
 * Sorts falling tiles lowest first, in place and keeping the order of equals (as `sort` does). They fall at much
 * the same pace, so the list is nearly in order already from the last frame and this is about one pass.
 */
function sortLowestFirst(falling: FallingTile[]): void {
  for (let next = 1; next < falling.length; next += 1) {
    const tile = falling[next]
    let at = next
    while (at > 0 && falling[at - 1].y < tile.y) {
      falling[at] = falling[at - 1]
      at -= 1
    }
    falling[at] = tile
  }
}

/**
 * Adds the tiles changed since the last look to the watch's pending list. Returns null when the grid has no watch
 * yet, or changes were missed, so only a whole-site check can be trusted.
 */
function collectChanges(grid: Grid): Watch | null {
  const watch = watches.get(grid)
  if (!watch) return null
  const from = changesFrom(grid, watch.mark)
  if (from < 0) {
    watches.delete(grid)
    return null
  }
  const { tiles } = grid.changes
  for (let entry = from; entry < tiles.length; entry += 1) watch.pending.push(tiles[entry])
  watch.mark = changeMark(grid)
  return watch
}

/** The loose tiles: worked out around the changed tiles where that settles it, otherwise over the whole site. */
function unsupportedNow(world: World, watch: Watch | null): readonly number[] {
  const slabs = slabRows(world)
  return (watch && findUnsupportedNear(world.grid, slabs, watch.pending)) ?? findUnsupported(world.grid, slabs)
}

/** A piece of the reinforced frame that comes loose is wrecked by the fall: it lands as ordinary rubble. */
function fallsAs(kind: TileKind): TileKind {
  return kind === 'reinforced' ? 'concrete' : kind
}

/** Moves one falling tile. Returns true when it has landed or broken up. */
function dropTile(world: World, tile: FallingTile, dt: number): boolean {
  tile.vy = Math.min(MAX_FALL_SPEED, tile.vy + GRAVITY * dt)
  tile.y += tile.vy * dt
  const box = { x: tile.x, y: tile.y, w: 1, h: 1 }

  if (tile.vy > CRUSH_SPEED) {
    for (const guard of world.guards) {
      if (guard.state === 'dead' || !touches(box, guard)) continue
      hurtGuard(world, guard, CRUSH_DAMAGE, box)
      return shatter(world, tile)
    }
    if (touches(box, world.player)) {
      world.player.hp -= PLAYER_CRUSH_DAMAGE
      return shatter(world, tile)
    }
  }

  const below = Math.floor(tile.y + 1)
  const under = tileAt(world.grid, tile.x, below)
  if (!TILE_DEFS[under].solid) return false
  // Rubble breaks up on the frame: a cut-off beam holds nothing up, so a tile left lying on it would hang unsupported.
  if (under === 'reinforced' || tileAt(world.grid, tile.x, below - 1) !== 'air') return shatter(world, tile)
  // Setting solid around a person, a body, the loot, furniture or a thrown charge would bury it; it breaks up on them instead.
  if (occupied(world, { x: tile.x, y: below - 1, w: 1, h: 1 })) return shatter(world, tile)
  // A heap that grows up into a hole in the floor above breaks up there rather than plugging it.
  if (builtAs(currentHoles(world), tile.x, below - 1) !== BUILT_NONE) return shatter(world, tile)
  setTile(world.grid, tile.x, below - 1, tile.kind)
  settleRubble(world.grid, tile.x, below - 1)
  burst(world.effects, world.rng, { x: tile.x + 0.5, y: below }, 3, '#8a8f98', 4)
  world.shake = Math.min(1, world.shake + 0.04)
  if (tile.vy > CRUSH_SPEED) {
    emitNoise(world, { x: tile.x + 0.5, y: below }, 14)
    playSound(world, 'collapse', { x: tile.x + 0.5, y: below })
  }
  return true
}

/**
 * A heap of fallen tiles up to this many rows high is a pile people step round in depth (or over); one that grows
 * taller fills enough of the room's height to block it, and then the whole heap blocks.
 */
export const LOW_PILE = 2

/** Marks a tile that has just come to rest as rubble, and decides whether its heap still leaves the lane clear. */
function settleRubble(grid: Grid, x: number, y: number): void {
  let height = 1
  while (height <= LOW_PILE && (grid.lane[(y + height) * grid.width + x] & RUBBLE) !== 0) height += 1
  if (height <= LOW_PILE) {
    setLaneFlags(grid, x, y, RUBBLE | CLEAR_OF_LANE)
    return
  }
  setLaneFlags(grid, x, y, RUBBLE)
  for (let below = 1; below < height; below += 1) setLaneFlags(grid, x, y + below, RUBBLE)
}

function shatter(world: World, tile: FallingTile): boolean {
  burst(world.effects, world.rng, { x: tile.x + 0.5, y: tile.y + 0.5 }, 6, TILE_DEFS[tile.kind].color, 6)
  return true
}

function occupied(world: World, cell: Rect): boolean {
  if (touches(cell, world.player) || (!world.loot.taken && touches(cell, world.loot))) return true
  for (const pickup of world.pickups) if (!pickup.taken && touches(cell, pickup)) return true
  for (const thrown of world.hazards.grenades) if (touches(cell, thrown)) return true
  for (const thrown of world.frags) if (touches(cell, thrown)) return true
  for (const thrown of world.charges) if (touches(cell, thrown)) return true
  for (const id of propsAt(world, cell.x, cell.y)) if (standsIn(world, propById(world, id), cell)) return true
  for (const guard of world.guards) {
    if (!guard.ragdoll) {
      if (touches(cell, guard)) return true
      continue
    }
    for (const point of guard.ragdoll.points) {
      if (point.x >= cell.x && point.x < cell.x + 1 && point.y >= cell.y && point.y < cell.y + 1) return true
    }
  }
  return false
}

/** Floor furniture, or anything the player has knocked loose (an extinguisher thrown off its wall), in the cell. */
function standsIn(world: World, prop: PropState | undefined, cell: Rect): boolean {
  if (!prop || prop.broken || !touches(cell, propBox(prop))) return false
  return propSpec(prop.kind).mount === 'floor' || world.physProps.loose.has(prop.id)
}

function touches(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}
