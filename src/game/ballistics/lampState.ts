import type { Lamp } from '../site'
import type { World } from '../world'

/**
 * Lamps a bullet has smashed. They stay dark for good, whatever happens to their circuit.
 * Kept outside `World` (like the device system's own state) and keyed by the lamp object, so tests that swap
 * in their own lamp list just work. This module imports nothing heavy, so `light.ts` can ask it cheaply.
 */
const shot = new WeakMap<World, Set<Lamp>>()

export function isLampShot(world: World, lamp: Lamp): boolean {
  return shot.get(world)?.has(lamp) === true
}

/** Marks a lamp smashed. Returns false if it already was. */
export function markLampShot(world: World, lamp: Lamp): boolean {
  let lamps = shot.get(world)
  if (!lamps) {
    lamps = new Set()
    shot.set(world, lamps)
  }
  if (lamps.has(lamp)) return false
  lamps.add(lamp)
  return true
}
