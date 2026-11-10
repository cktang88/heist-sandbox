import type { Guard } from '../guards'
import { emitNoise } from '../noise'
import { bark } from '../security/barks'
import { isActive, setMode } from '../security/model'
import { startSearch } from '../security/orders'
import { playSound } from '../sounds'
import { centerOf, distance, type Vec } from '../types'
import type { World } from '../world'
import { LURE } from './tuning'

/**
 * Pulling a guard over on purpose: a short whistle or knock on the wall (X), or a noisy machine switched on
 * (noisemakers.ts). It works once or twice; guards lured to the same area again get wise to it. The second time the
 * one who comes brings a partner, and after a few they search the area properly instead.
 */

const lastWhistle = new WeakMap<World, number>()

/** The whistle: a short sound at the player that carries a few tiles. */
export function whistle(world: World): void {
  const last = lastWhistle.get(world) ?? -Infinity
  if (world.clock - last < LURE.cooldown) return
  lastWhistle.set(world, world.clock)
  const at = centerOf(world.player)
  playSound(world, 'footstep', at)
  emitNoise(world, at, LURE.whistleNoise)
  answerLure(world, at)
}

/**
 * A lure went off at a spot: count it with the recent ones nearby, and harden whoever answers it. Returns how many
 * lures this area has seen lately, this one included.
 */
export function answerLure(world: World, at: Vec): number {
  const stealth = world.stealth
  stealth.lures = stealth.lures.filter((lure) => world.clock - lure.clock < LURE.memory)
  stealth.lures.push({ x: at.x, y: at.y, clock: world.clock })
  const count = stealth.lures.filter((lure) => Math.abs(lure.x - at.x) < LURE.area && Math.abs(lure.y - at.y) < 3).length
  const answering = world.guards.filter((guard) => isActive(guard) && guard.interest?.kind === 'noise' && distance(guard.interest.at, at) < 2)
  for (const guard of answering) harden(world, guard, at, count)
  return count
}

function harden(world: World, guard: Guard, at: Vec, count: number): void {
  if (count >= LURE.searchAfter) {
    bark(world, guard, 'Someone is playing games. Search the area.', true)
    startSearch(world, guard, at)
    return
  }
  if (count < LURE.pairAfter) return
  const partner = world.guards
    .filter((other) => other !== guard && isActive(other) && (other.mode === 'calm' || other.mode === 'caution') && distance(centerOf(other), centerOf(guard)) < 15)
    .sort((a, b) => distance(centerOf(a), centerOf(guard)) - distance(centerOf(b), centerOf(guard)))[0]
  bark(world, guard, partner ? 'Again? Cover me on this one.' : 'Again? Something is not right.', true)
  if (!partner) return
  partner.interest = { at: { ...at }, kind: 'noise', priority: 4, reached: false }
  setMode(partner, 'investigating')
}
