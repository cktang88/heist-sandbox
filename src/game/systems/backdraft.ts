import { explode } from '../explosions'
import { nearestFire, startFire } from '../hazards/fire'
import { toxicPressureAt } from '../hazards/smoke'
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
  explode(world, { x: x + 0.5 + outward, y: y + 0.5 }, BLAST)
}
