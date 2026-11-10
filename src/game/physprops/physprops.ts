import type { Input } from '../input'
import type { World } from '../world'
import { settleLooseProps } from './gravity'
import { rememberPlayer } from './pace'
import { dragFurniture } from './push'
import { landOnFurniture } from './stand'

export { doorBlockedAt } from './doors'
export { standingSurfaceUnder } from './stand'
export { propCover, kickProp } from './tip'
export { createPhysProps, type PhysPropsState } from './state'

/**
 * Furniture the player has disturbed: standing on tops, dragging with grab held, and gravity for whatever
 * is loose. Runs after the player has moved and before shots fly. Cost scales with the few loose props
 * plus a small search around the player.
 */
export function stepPhysProps(world: World, input: Input, dt: number): void {
  const hands = !world.drone
  landOnFurniture(world, hands && input.down)
  dragFurniture(world, hands && input.grab, hands && input.down, dt)
  settleLooseProps(world, dt)
  rememberPlayer(world)
}
