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

/**
 * Finds solid tiles that are no longer held up. A tile is supported when a chain of
 * touching solid tiles (or ladders) links it to the bottom of the map.
 */
export function findUnsupported(grid: Grid): number[] {
  const { width, height } = grid
  const supported = new Uint8Array(width * height)
  const queue: number[] = []
  const solid = (index: number) => TILE_DEFS[TILE_KINDS[grid.kinds[index]]].solid
  // Ladders are bolted to the walls beside them, so they hold the two sides of a shaft together.
  const carries = (index: number) => solid(index) || TILE_KINDS[grid.kinds[index]] === 'ladder'
  for (let x = 0; x < width; x += 1) {
    const index = (height - 1) * width + x
    if (solid(index)) {
      supported[index] = 1
      queue.push(index)
    }
  }
  // Ducts hang on rods from the slab two rows up, over their crawl space, not from the doors they pass over.
  const hangsBelow = (index: number) => index + HANGER_ROWS * width < supported.length && TILE_KINDS[grid.kinds[index + HANGER_ROWS * width]] === 'duct'
  while (queue.length > 0) {
    const index = queue.pop()!
    const x = index % width
    const neighbours = [index - width, index + width, x > 0 ? index - 1 : -1, x < width - 1 ? index + 1 : -1, hangsBelow(index) ? index + HANGER_ROWS * width : -1]
    for (const next of neighbours) {
      if (next < 0 || next >= supported.length || supported[next] || !carries(next)) continue
      supported[next] = 1
      queue.push(next)
    }
  }
  const loose: number[] = []
  for (let index = 0; index < supported.length; index += 1) if (!supported[index] && solid(index)) loose.push(index)
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
