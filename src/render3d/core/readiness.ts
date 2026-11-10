import type { World } from '../../game/world'
import { jobsWithin, ON_SCREEN } from './buildQueue'
import { gpuReady, shaderProgress } from './gpu'

/**
 * Decides when the scene is ready for play: the first frame of the level has been drawn (shaders compiled for it) and
 * everything the opening view can reach in its first moments is built and on the GPU. The heist opens with the player
 * high above the site, so that is mostly sky; the rest of the site is built during play, nearest the view first, well
 * ahead of a falling player (see `buildQueue.ts`).
 */

/**
 * The area around the player's start built before play, in tiles: the view itself, plus a free fall of about a
 * second and a half below it (the camera trails the player), plus a sideways glide.
 */
const OPENING = { side: ON_SCREEN.x + 12, above: ON_SCREEN.y, below: ON_SCREEN.y + 30 }

/** Part of the bar for compiling shaders; the rest is building. */
const SHADER_SHARE = 0.4

export type Readiness = { ready: boolean; step: string; share: number }

/**
 * `share` is how much of the opening's work is done (0..1): shaders first, then building. The count of jobs still
 * to do there is only known once the level exists, so the first count seen is the whole.
 */
export function sceneReadiness(world: World, firstCount: { value: number }): Readiness {
  if (!gpuReady()) {
    const shaders = shaderProgress()
    if (shaders.total === 0) return { ready: false, step: 'Building the city, lighting the sky', share: 0 }
    return { ready: false, step: `Compiling shaders ${shaders.done} of ${shaders.total}`, share: (shaders.done / shaders.total) * SHADER_SHARE }
  }
  const { x, y } = world.player
  const left = jobsWithin(x - OPENING.side, y - OPENING.above, x + OPENING.side, y + OPENING.below)
  firstCount.value = Math.max(firstCount.value, left)
  const share = SHADER_SHARE + (1 - SHADER_SHARE) * (firstCount.value === 0 ? 1 : 1 - left / firstCount.value)
  if (left > 0) return { ready: false, step: 'Building what the drop can see first', share }
  return { ready: true, step: 'Ready', share: 1 }
}
