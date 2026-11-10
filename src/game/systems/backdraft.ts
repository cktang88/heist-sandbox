import { explode } from '../explosions'
import { nearestFire, startFire } from '../hazards/fire'
import { thinSmoke, toxicPressureAt } from '../hazards/smoke'
import { playSound } from '../sounds'
import { isSolidAt } from '../tiles'
import type { World } from '../world'

/**
 * A backdraft: a fire that has filled a shut room with hot smoke and starved itself of air flares the moment a door
 * or window is opened. A tongue of flame and a blast come out through the opening, toward whoever opened it.
 */
const PACKED = 0.9
const FIRE_REACH = 10
const TONGUE = 4
const BLAST = { radius: 2.2, tileDamage: 30, bodyDamage: 60 }

/** Looks at each tile that just opened for a smoke-packed burning room on one side of it. */
export function checkBackdrafts(world: World, opened: readonly number[]): void {
  if (opened.length === 0 || world.hazards.fires.size === 0 || !world.hazards.smoke) return
  const width = world.grid.width
  const flared = new Set<number>()
  for (const key of opened) {
    const x = key % width
    const y = (key - x) / width
    for (const side of [-1, 1]) {
      // A door opens several tiles at once: one flare per doorway side.
      const doorway = x * 2 + (side > 0 ? 1 : 0)
      if (flared.has(doorway) || toxicPressureAt(world, key + side) < PACKED) continue
      if (!nearestFire(world, { x: x + 0.5 + side, y: y + 0.5 }, FIRE_REACH)) continue
      flared.add(doorway)
      flare(world, x, y, -side)
    }
  }
}

/** The flame rolls out through the opening, away from the room. */
function flare(world: World, x: number, y: number, outward: number): void {
  for (let step = 0; step < TONGUE; step += 1) {
    const tx = x + outward * step
    if (isSolidAt(world.grid, tx + 0.5, y + 0.5)) break
    startFire(world, tx, y, 1, 1.2)
    startFire(world, tx, y - 1, 1, 0.9)
  }
  playSound(world, 'fire', { x: x + 0.5, y: y + 0.5 })
  burnOffPackedSmoke(world, x, y, -outward)
  explode(world, { x: x + 0.5 + outward, y: y + 0.5 }, BLAST)
}

/** Room behind the opening whose hot smoke the flare burns: as far as the fire it needs, a storey up and down. */
const ROOM_REACH = 5
const SMOKE_LEFT = 0.3

/**
 * The flare is the packed smoke igniting, so it is used up: windows the blast then breaks, or a second door opened a
 * moment later, find a smoky room, not another backdraft.
 */
function burnOffPackedSmoke(world: World, x: number, y: number, inward: number): void {
  for (let step = 1; step <= FIRE_REACH; step += 1) {
    for (let dy = -ROOM_REACH; dy <= ROOM_REACH; dy += 1) thinSmoke(world, x + inward * step, y + dy, SMOKE_LEFT)
  }
}
