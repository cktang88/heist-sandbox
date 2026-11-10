import type { World } from '../game/world'
import type { Settings } from './settings'

/**
 * Applies the gameplay settings to a heist after each step, from outside the game core.
 * Screen shake is only ever read by the renderers, so zeroing it changes nothing in the simulation.
 * Automatic slow motion is a pending burst or hit pause on the clock, consumed at the start of the next step;
 * clearing them leaves only the slow motion the player asks for with Shift.
 */
export function applyGameplay(world: Pick<World, 'time' | 'shake'>, settings: Pick<Settings, 'autoSlowmo' | 'shake'>): void {
  if (!settings.shake) world.shake = 0
  if (!settings.autoSlowmo) {
    world.time.burstLeft = 0
    world.time.freezeLeft = 0
  }
}
