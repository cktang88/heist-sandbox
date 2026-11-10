import { isInCover } from '../cover'
import { lightLevelAt } from '../light'
import { VISION } from '../security/tuning'
import { centerOf } from '../types'
import type { World } from '../world'
import { disguiseBlown } from './disguise'
import { spotKind, spotProp } from './spots'

/**
 * Why the player is or is not being seen, in a few words for the HUD: in darkness, in cover, hidden in a locker,
 * disguised (or why the disguise is not working), and what is making noise. `good` cues help him, the rest give him away.
 */
export type Cue = { text: string; good: boolean }

/** Moving faster than this, standing, the feet are heard. */
const RUN_SPEED = 0.6

export function stealthCues(world: World): Cue[] {
  const player = world.player
  const stealth = world.stealth
  const cues: Cue[] = []
  if (stealth.hiding) {
    const prop = spotProp(world, stealth.hiding.prop)
    const name = prop ? spotKind(prop.kind)?.name ?? 'hiding' : 'hiding'
    return [{ text: stealth.hiding.how === 'under' ? `HIDDEN UNDER ${name.toUpperCase()}` : `HIDDEN IN ${name.toUpperCase()}`, good: true }]
  }
  const at = centerOf(player)
  if (lightLevelAt(world, at) < VISION.dim) cues.push({ text: 'IN DARKNESS', good: true })
  if (isInCover(world, player)) cues.push({ text: 'IN COVER', good: true })
  if (stealth.disguise) {
    const blown = disguiseBlown(world)
    cues.push(blown ? { text: `DISGUISE BLOWN: ${blown.toUpperCase()}`, good: false } : { text: 'DISGUISED', good: true })
  }
  const noise = noiseReason(world)
  if (noise) cues.push({ text: `NOISY: ${noise}`, good: false })
  return cues
}

function noiseReason(world: World): string | null {
  const player = world.player
  if (world.stealth.choke?.struggle) return 'STRUGGLE'
  // Feet on the floor are heard unless crouched (see movement/footsteps.ts).
  if (player.onGround && !player.crouching && Math.abs(player.vx) > RUN_SPEED) return 'FOOTSTEPS'
  return null
}
