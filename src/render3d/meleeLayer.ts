import type { Object3D } from 'three'
import type { PropState } from '../game/cover'
import { propSpec } from '../game/propCatalog'
import type { World } from '../game/world'

/** Depth at which a wall item pulled off the wall (an extinguisher that was thrown) is drawn, out in the room. */
const OFF_THE_WALL_Z = -0.6

/**
 * Keeps the model of a prop the player has disturbed where the game has it: dragged, falling, thrown, or tipped
 * on its side. The props layer builds every model once at a fixed spot, so it calls this for each prop it draws;
 * untouched props return at once.
 */
export function placeLooseProp(world: World, prop: PropState, model: Object3D): void {
  const loose = world.physProps.loose.get(prop.id)
  if (!loose) return
  const spec = propSpec(prop.kind)
  const middle = prop.x + 0.5
  model.visible = !prop.broken
  if (loose.tipped) {
    // A quarter turn about the edge it fell toward: the top faces away from the kicker, toward the threat.
    model.rotation.z = -loose.tipped * (Math.PI / 2)
    model.position.set(middle - loose.tipped * (spec.h / 2), -prop.y + spec.w / 2, 0)
    return
  }
  model.rotation.z = 0
  model.position.set(middle, -prop.y, spec.mount === 'wall' ? OFF_THE_WALL_Z : 0)
}
