import type { World } from '../world'

/**
 * Keeps the reactive events' triggers up to date: when the player was last seen, how often he has cut the power,
 * and which knocked-out guards have just come round. Runs at the pacing look (about once a second), not every frame.
 */

/** Stunned this long or longer means knocked out cold, not just dazed. */
const OUT_COLD = 20

export function watchSignals(world: World): void {
  const signals = world.director.signals
  for (const circuit of world.deadCircuits) {
    if (!signals.knownDead.has(circuit) && !signals.ownDead.has(circuit)) signals.powerCuts += 1
  }
  signals.knownDead = new Set(world.deadCircuits)
  signals.woke = []
  for (const guard of world.guards) {
    if (guard.seesPlayer) signals.lastSeenAt = world.clock
    if (guard.mode === 'dead' || guard.restrained) {
      signals.out.delete(guard)
    } else if (guard.stunSeconds > OUT_COLD) {
      signals.out.add(guard)
    } else if (guard.stunSeconds <= 0 && signals.out.delete(guard)) {
      signals.woke.push(guard)
    }
  }
}

/** Seconds since any guard last had eyes on the player (the whole heist so far, if never). */
export function unseenFor(world: World): number {
  return world.clock - Math.max(0, world.director.signals.lastSeenAt)
}
