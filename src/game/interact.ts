import { hurtGuard } from './guards'
import type { Input } from './input'
import { emitNoise } from './noise'
import { playSound } from './sounds'
import { setTile, tileAt, type Grid } from './tiles'
import { centerOf, distance, overlaps, type Vec } from './types'
import type { World } from './world'

const PICK_SECONDS = 1.3
const PICK_REACH = 2
const TAKEDOWN_REACH = 1.6
const MAX_DOOR_TILES = 8

/** The hands-on actions: grab the loot, take down an unaware guard, pick a lock. */
export function interact(world: World, input: Input, dt: number): void {
  const player = world.player
  const center = centerOf(player)

  if (!world.loot.taken && overlaps(player, world.loot)) {
    world.loot.taken = true
    playSound(world, 'pickup', center)
    player.hasLoot = true
  }

  if (input.interactPressed) {
    const guard = world.guards.find((other) => other.state !== 'dead' && other.state !== 'alert' && distance(centerOf(other), center) < TAKEDOWN_REACH)
    if (guard) {
      hurtGuard(world, guard, 1000, center)
      return
    }
  }

  const door = input.interact ? nearestDoor(world.grid, center) : null
  if (!door) {
    player.pick = 0
    return
  }
  player.pick += dt / PICK_SECONDS
  if (player.pick < 1) return
  player.pick = 0
  openDoor(world.grid, door)
  world.structureChanged = true
  emitNoise(world, center, 2)
  playSound(world, 'door', center)
}

export function nearestDoor(grid: Grid, from: Vec): Vec | null {
  let best: Vec | null = null
  let bestGap = PICK_REACH
  for (let y = Math.floor(from.y - PICK_REACH); y <= Math.floor(from.y + PICK_REACH); y += 1) {
    for (let x = Math.floor(from.x - PICK_REACH); x <= Math.floor(from.x + PICK_REACH); x += 1) {
      if (tileAt(grid, x, y) !== 'door') continue
      const gap = Math.hypot(x + 0.5 - from.x, y + 0.5 - from.y)
      if (gap >= bestGap) continue
      best = { x, y }
      bestGap = gap
    }
  }
  return best
}

/** Opens the whole door, not just the tile that was picked. */
export function openDoor(grid: Grid, start: Vec): void {
  const queue: Vec[] = [start]
  for (let opened = 0; queue.length > 0 && opened < MAX_DOOR_TILES; opened += 1) {
    const { x, y } = queue.pop()!
    if (tileAt(grid, x, y) !== 'door') continue
    setTile(grid, x, y, 'air')
    queue.push({ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 })
  }
}
