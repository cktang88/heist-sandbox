import { burst, flash } from '../effects'
import { withBlastCause } from '../explosions'
import { igniteAt } from '../hazards/hazards'
import { emitNoise } from '../noise'
import { playSound } from '../sounds'
import type { Vec } from '../types'
import type { World } from '../world'
import { liquidAt, restingKey } from './liquid'
import { stepShocks } from './shock'

/**
 * A lightning strike, for a storm to call: a blinding crack heard across the site, a fire where it lands, and a
 * jolt through any water lying there.
 */
const THUNDER = 30
const MAX_PUDDLE = 400

export function strikeAt(world: World, at: Vec): void {
  withBlastCause('accident', () => strike(world, at))
}

function strike(world: World, at: Vec): void {
  flash(world.effects, at, 2.5, 0.2, 'muzzle')
  burst(world.effects, world.systems.rng, at, 24, '#e6f2ff', 12)
  playSound(world, 'explosion', at)
  emitNoise(world, at, THUNDER, 'guard')
  igniteAt(world, at, 0.7)
  const key = restingKey(world, at.x, at.y)
  if (key < 0) return
  const width = world.grid.width
  if (liquidAt(world, 'water', key % width, Math.floor(key / width)) <= 0) return
  const energized = world.systems.energized
  const queue = [key]
  energized.set(key, undefined)
  while (queue.length > 0 && energized.size < MAX_PUDDLE) {
    const next = queue.pop()!
    for (const side of [next - 1, next + 1]) {
      if (energized.has(side) || liquidAt(world, 'water', side % width, Math.floor(side / width)) <= 0) continue
      energized.set(side, undefined)
      queue.push(side)
    }
  }
  stepShocks(world)
}
