import { idleInput, type Input } from '../input'
import type { World } from '../world'

/**
 * What the player's body does with the keys this frame. While the drone is flown the keys steer it, and while he is
 * knocked down or jolted they do nothing; the systems that move him after his own step (the grapple line, elevators,
 * floor holes) read the keys through this so they obey the same rule as his walking.
 */
export function bodyControl(world: World, input: Input): Input {
  return world.drone || world.player.stunSeconds > 0 ? idleInput(input.aim) : input
}
