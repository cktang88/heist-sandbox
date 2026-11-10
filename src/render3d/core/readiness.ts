import type { World } from '../../game/world'
import { jobsWithin } from './buildQueue'
import { gpuReady, preparesPending } from './gpu'

/**
 * Decides when the scene is ready for play: the first frame of the level has been drawn (shaders compiled for it) and
 * everything the opening parachute drop can reach is built, with its shaders compiled. The rest of the site is built
 * during play, a few milliseconds a frame.
 */

/** How far either side of the drop point the player can steer the parachute before landing, in tiles. */
const DROP_REACH_X = 75

export type Readiness = { ready: boolean; step: string; share: number }

/**
 * `share` is how much of the scene work is done (0..1). The count of jobs still to do on the drop path is only known
 * once the level exists, so the first count seen is the whole.
 */
export function sceneReadiness(world: World, firstCount: { value: number }): Readiness {
  if (!gpuReady()) return { ready: false, step: 'Compiling shaders and lighting the sky', share: 0 }
  const x = world.player.x
  const left = jobsWithin(x - DROP_REACH_X, -Infinity, x + DROP_REACH_X, Infinity)
  firstCount.value = Math.max(firstCount.value, left)
  const share = firstCount.value === 0 ? 1 : 1 - left / firstCount.value
  if (left > 0) return { ready: false, step: 'Furnishing the rooms below the drop', share }
  if (preparesPending() > 0) return { ready: false, step: 'Preparing shaders for the furniture', share: 1 }
  return { ready: true, step: 'Ready', share: 1 }
}
