import type { PropState } from './cover'
import { burst } from './effects'
import { propBox, propById, propsAt } from './hazards/props'
import { propSpec } from './propCatalog'
import { hurtGuard } from './guards'
import { emitNoise } from './noise'
import { GRAVITY } from './physics'
import { playSound } from './sounds'
import { setTile, TILE_DEFS, TILE_KINDS, tileAt, type Grid, type TileKind } from './tiles'
import type { Interior } from './site'
import type { Rect } from './types'
import type { World } from './world'

/** A tile that has lost its support and is dropping. It becomes a tile again where it lands. */
export type FallingTile = { x: number; y: number; vy: number; kind: TileKind }

const CRUSH_SPEED = 6
const CRUSH_DAMAGE = 60
const PLAYER_CRUSH_DAMAGE = 25
const MAX_FALL_SPEED = 30
/** A duct floor sits this many rows under the slab it hangs from (one row of crawl space between). */
const HANGER_ROWS = 2
/** Rows from one floor slab to the next. */
const STOREY = 6
const SOLID = Uint8Array.from(TILE_KINDS, (kind) => (TILE_DEFS[kind].solid ? 1 : 0))
/** Ladders are bolted to the walls beside them, so they hold the two sides of a shaft together. */
const CARRIES = Uint8Array.from(TILE_KINDS, (kind) => (TILE_DEFS[kind].solid || kind === 'ladder' ? 1 : 0))
const DUCT = TILE_KINDS.indexOf('duct')
const REINFORCED = TILE_KINDS.indexOf('reinforced')

/**
 * One slab row of a building, columns x0..x1: where floors are also held by the back wall the side view cuts away.
 * `top` and `bottom` are the building's first and last rows, so holding a slab never reaches outside it.
 */
export type SlabRow = { y: number; x0: number; x1: number; top: number; bottom: number }

/**
 * Finds solid tiles that are no longer held up. A tile is supported when a chain of touching solid tiles
 * (or ladders) links it to the bottom of the map, or to a building slab the back wall still holds (see `holdSlab`).
 * The reinforced frame cannot be destroyed, so it never falls, but a piece of it that is cut off holds nothing up
 * either: otherwise every floor bolted to a beam would hang there for ever.
 */
export function findUnsupported(grid: Grid, slabs: readonly SlabRow[] = []): number[] {
  const { width, height, kinds } = grid
  const size = width * height
  const supported = new Uint8Array(size)
  // Every tile can be on the stack at most once, so a fixed buffer is enough. Run on every door opened, so kept lean.
  const stack = new Int32Array(size)
  let top = 0
  const reach = (next: number): void => {
    if (supported[next] || !CARRIES[kinds[next]]) return
    supported[next] = 1
    stack[top++] = next
  }
  const hanger = HANGER_ROWS * width
  const spread = (): void => {
    while (top > 0) {
      const index = stack[--top]
      const x = index % width
      if (index >= width) reach(index - width)
      if (index + width < size) reach(index + width)
      if (x > 0) reach(index - 1)
      if (x < width - 1) reach(index + 1)
      // Ducts hang on rods from the slab two rows up, over their crawl space, not from the doors they pass over.
      if (index + hanger < size && kinds[index + hanger] === DUCT) reach(index + hanger)
    }
  }
  for (let index = (height - 1) * width; index < size; index += 1) if (SOLID[kinds[index]]) reach(index)
  spread()
  // A slab held from behind holds what hangs from it, which may reach down to (and hold) another slab: go on until none is left.
  const held = new Uint8Array(slabs.length)
  for (let changed = true; changed;) {
    changed = false
    slabs.forEach((slab, entry) => {
      if (held[entry] || !holdSlab(grid, supported, slab, reach)) return
      held[entry] = 1
      changed = true
      spread()
    })
  }
  const loose: number[] = []
  for (let index = 0; index < size; index += 1) if (!supported[index] && SOLID[kinds[index]] && kinds[index] !== REINFORCED) loose.push(index)
  return loose
}

/**
 * The building is drawn cut open, but its floors are really also bolted to the back wall (and the unseen front
 * wall), which runs the whole length of the storey, and so are the partitions, lintels and ducts between them. So
 * while any tile of a slab row is still held up, the storey's frame stands, and every remaining tile of that row hangs
 * on from behind, however ragged the holes blown in it, along with everything on the storeys just above and below
 * it: only what a blast destroyed disappears. A storey comes down only once nothing at all holds its slab (its walls
 * and the storeys below are gone). Returns true if it held the row.
 */
function holdSlab(grid: Grid, supported: Uint8Array, slab: SlabRow, reach: (index: number) => void): boolean {
  if (slab.y < 0 || slab.y >= grid.height) return false
  const x0 = Math.max(0, slab.x0)
  const x1 = Math.min(grid.width - 1, slab.x1)
  const row = slab.y * grid.width
  let standing = false
  for (let x = x0; x <= x1 && !standing; x += 1) standing = supported[row + x] === 1 && SOLID[grid.kinds[row + x]] === 1
  if (!standing) return false
  const from = Math.max(0, slab.top, slab.y - STOREY + 1)
  const to = Math.min(grid.height - 1, slab.bottom, slab.y + STOREY - 1)
  for (let y = from; y <= to; y += 1) {
    for (let x = x0; x <= x1; x += 1) if (SOLID[grid.kinds[y * grid.width + x]]) reach(y * grid.width + x)
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

/** Turns unsupported tiles into falling ones, then moves everything that is falling. */
export function stepCollapse(world: World, dt: number): void {
  if (world.structureChanged) {
    world.structureChanged = false
    for (const index of findUnsupported(world.grid, slabRows(world))) {
      const x = index % world.grid.width
      const y = Math.floor(index / world.grid.width)
      world.falling.push({ x, y, vy: 0, kind: tileAt(world.grid, x, y) })
      setTile(world.grid, x, y, 'air')
    }
  }
  if (world.falling.length === 0) return

  // Lowest first, so a falling stack lands in order instead of on top of itself.
  world.falling.sort((a, b) => b.y - a.y)
  world.falling = world.falling.filter((tile) => !dropTile(world, tile, dt))
}

/** Moves one falling tile. Returns true when it has landed or broken up. */
function dropTile(world: World, tile: FallingTile, dt: number): boolean {
  tile.vy = Math.min(MAX_FALL_SPEED, tile.vy + GRAVITY * dt)
  tile.y += tile.vy * dt
  const box = { x: tile.x, y: tile.y, w: 1, h: 1 }

  if (tile.vy > CRUSH_SPEED) {
    const guard = world.guards.find((other) => other.state !== 'dead' && touches(box, other))
    if (guard) {
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
  setTile(world.grid, tile.x, below - 1, tile.kind)
  burst(world.effects, world.rng, { x: tile.x + 0.5, y: below }, 3, '#8a8f98', 4)
  world.shake = Math.min(1, world.shake + 0.04)
  if (tile.vy > CRUSH_SPEED) {
    emitNoise(world, { x: tile.x + 0.5, y: below }, 14)
    playSound(world, 'collapse', { x: tile.x + 0.5, y: below })
  }
  return true
}

function shatter(world: World, tile: FallingTile): boolean {
  burst(world.effects, world.rng, { x: tile.x + 0.5, y: tile.y + 0.5 }, 6, TILE_DEFS[tile.kind].color, 6)
  return true
}

function occupied(world: World, cell: Rect): boolean {
  if (touches(cell, world.player) || (!world.loot.taken && touches(cell, world.loot))) return true
  if (world.pickups.some((pickup) => !pickup.taken && touches(cell, pickup))) return true
  if ([...world.hazards.grenades, ...world.frags, ...world.charges].some((thrown) => touches(cell, thrown))) return true
  if (propsAt(world, cell.x, cell.y).some((id) => standsIn(world, propById(world, id), cell))) return true
  return world.guards.some((guard) => guard.ragdoll
    ? guard.ragdoll.points.some((point) => point.x >= cell.x && point.x < cell.x + 1 && point.y >= cell.y && point.y < cell.y + 1)
    : touches(cell, guard))
}

/** Floor furniture, or anything the player has knocked loose (an extinguisher thrown off its wall), in the cell. */
function standsIn(world: World, prop: PropState | undefined, cell: Rect): boolean {
  if (!prop || prop.broken || !touches(cell, propBox(prop))) return false
  return propSpec(prop.kind).mount === 'floor' || world.physProps.loose.has(prop.id)
}

function touches(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}
