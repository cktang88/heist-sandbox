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

/** One slab row of a building, columns x0..x1: where floors are also held by the back wall the side view cuts away. */
export type SlabRow = { y: number; x0: number; x1: number }

/**
 * The building is drawn cut open, but its floors are really also bolted to the back wall (and the unseen front
 * wall). So a run of slab that has lost every 2D path to the ground still hangs on if, along the same slab row,
 * a held tile lies within this many columns on at least one side: two rocket holes leave the slab between them
 * standing. Once the walls carrying a storey are gone on both sides for longer than this, it comes down.
 */
const BACK_WALL_SPAN = 8

/**
 * Finds solid tiles that are no longer held up. A tile is supported when a chain of touching solid tiles
 * (or ladders) links it to the bottom of the map, or to a run of building slab the back wall still holds (see
 * `BACK_WALL_SPAN`). The reinforced frame cannot be destroyed, so it never falls, but a piece of it that is cut off
 * holds nothing up either: otherwise every floor bolted to a beam would hang there for ever.
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
  for (const slab of slabs) holdSlab(grid, supported, slab, reach)
  spread()
  const loose: number[] = []
  for (let index = 0; index < size; index += 1) if (!supported[index] && SOLID[kinds[index]] && kinds[index] !== REINFORCED) loose.push(index)
  return loose
}

/**
 * Marks the runs of loose slab on one row that the back wall still holds. Sweeps both ways, counting a run it has
 * just held as holding, so a row of islands between several holes all stay up.
 */
function holdSlab(grid: Grid, supported: Uint8Array, slab: SlabRow, reach: (index: number) => void): void {
  if (slab.y < 0 || slab.y >= grid.height) return
  const row = slab.y * grid.width
  const x0 = Math.max(0, slab.x0)
  const x1 = Math.min(grid.width - 1, slab.x1)
  const sweep = (from: number, to: number, step: number): void => {
    let gap = BACK_WALL_SPAN + 1
    for (let x = from; x !== to + step; x += step) {
      const index = row + x
      if (!SOLID[grid.kinds[index]]) gap += 1
      else if (supported[index]) gap = 0
      else if (gap <= BACK_WALL_SPAN) reach(index)
      else gap = BACK_WALL_SPAN + 1
    }
  }
  sweep(x0, x1, 1)
  sweep(x1, x0, -1)
}

/** The slab rows of every building of two or more storeys; one-storey sheds, bridges and silos keep the plain rule. */
export function slabRows(world: World): SlabRow[] {
  const cached = slabCache.get(world.interiors)
  if (cached) return cached
  const rows: SlabRow[] = []
  for (const interior of world.interiors) {
    if (interior.kind !== 'room' || interior.h % STOREY !== 0 || interior.h < 2 * STOREY) continue
    for (let y = interior.y; y <= interior.y + interior.h; y += STOREY) rows.push({ y, x0: interior.x, x1: interior.x + interior.w - 1 })
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
  // Setting solid around a person, a body, the loot or furniture would bury them in the tile; it breaks up on them instead.
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
  if (propsAt(world, cell.x, cell.y).some((id) => standsIn(propById(world, id), cell))) return true
  return world.guards.some((guard) => guard.ragdoll
    ? guard.ragdoll.points.some((point) => point.x >= cell.x && point.x < cell.x + 1 && point.y >= cell.y && point.y < cell.y + 1)
    : touches(cell, guard))
}

function standsIn(prop: PropState | undefined, cell: Rect): boolean {
  return !!prop && !prop.broken && propSpec(prop.kind).mount === 'floor' && touches(cell, propBox(prop))
}

function touches(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}
