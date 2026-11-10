import { burst } from './effects'
import { hurtGuard } from './guards'
import { emitNoise } from './noise'
import { GRAVITY } from './physics'
import { playSound } from './sounds'
import { setTile, TILE_DEFS, TILE_KINDS, tileAt, type Grid, type TileKind } from './tiles'
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
const SOLID = Uint8Array.from(TILE_KINDS, (kind) => (TILE_DEFS[kind].solid ? 1 : 0))
/** Ladders are bolted to the walls beside them, so they hold the two sides of a shaft together. */
const CARRIES = Uint8Array.from(TILE_KINDS, (kind) => (TILE_DEFS[kind].solid || kind === 'ladder' ? 1 : 0))
const DUCT = TILE_KINDS.indexOf('duct')

/**
 * Finds solid tiles that are no longer held up. A tile is supported when a chain of
 * touching solid tiles (or ladders) links it to the bottom of the map.
 */
export function findUnsupported(grid: Grid): number[] {
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
  for (let index = (height - 1) * width; index < size; index += 1) if (SOLID[kinds[index]]) reach(index)
  const hanger = HANGER_ROWS * width
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
  const loose: number[] = []
  for (let index = 0; index < size; index += 1) if (!supported[index] && SOLID[kinds[index]]) loose.push(index)
  return loose
}

/** Turns unsupported tiles into falling ones, then moves everything that is falling. */
export function stepCollapse(world: World, dt: number): void {
  if (world.structureChanged) {
    world.structureChanged = false
    for (const index of findUnsupported(world.grid)) {
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
  if (!TILE_DEFS[tileAt(world.grid, tile.x, below)].solid) return false
  if (tileAt(world.grid, tile.x, below - 1) !== 'air') return shatter(world, tile)
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

function touches(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}
