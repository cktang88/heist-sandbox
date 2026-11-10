import type { Input } from '../input'
import type { World } from '../world'
import { stepKnocks } from './knock'
import { catchBullets, holdShield } from './shield'
import { kick, punch } from './strikes'
import { stepFlights, throwNearest } from './throw'

export { createMelee, type MeleeState } from './state'

/**
 * Close combat: punches, kicks, the human shield and thrown objects, then whatever they set moving
 * (thrown things in flight, guards knocked off their feet). Runs after the player has acted and before shots fly,
 * so a shield catches this frame's bullets. Cost scales with the few things in motion.
 */
export function stepMelee(world: World, input: Input, dt: number): void {
  const melee = world.melee
  melee.cooldown = Math.max(0, melee.cooldown - dt)
  for (const [guard, daze] of melee.dazes) if (daze.until <= world.clock) melee.dazes.delete(guard)
  if (!world.drone) {
    holdShield(world, input, dt)
    if (input.punchPressed) punch(world)
    else if (input.kickPressed) kick(world)
    if (input.throwPressed) throwNearest(world, input.aim)
  }
  catchBullets(world, dt)
  stepFlights(world, dt)
  stepKnocks(world, dt)
}
