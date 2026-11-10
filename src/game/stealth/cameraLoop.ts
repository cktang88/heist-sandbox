import type { Device, World } from '../world'
import { CAMERA_LOOP } from './tuning'

/**
 * Looping a camera's feed from a terminal: for a while the monitor shows the empty room it recorded. Unlike a cut
 * cable, which the control room notices as a dead feed after a while, a loop raises nothing; it simply runs out.
 */

export function feedLooped(world: World, device: Device): boolean {
  return (world.stealth.looped.get(device.id) ?? -Infinity) > world.clock
}

export function loopFeeds(world: World, cameras: readonly Device[]): void {
  for (const camera of cameras) world.stealth.looped.set(camera.id, world.clock + CAMERA_LOOP.seconds)
}

/** Seconds left on the longest loop among these cameras, or 0. */
export function loopSecondsLeft(world: World, cameras: readonly Device[]): number {
  return Math.max(0, ...cameras.map((camera) => (world.stealth.looped.get(camera.id) ?? 0) - world.clock))
}
