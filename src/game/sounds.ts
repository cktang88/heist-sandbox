import type { Vec } from './types'
import type { World } from './world'

export type SoundKind =
  | 'pistol' | 'rifle' | 'shotgun' | 'sniper' | 'rocket' | 'guardShot'
  | 'explosion' | 'kill' | 'door' | 'reload' | 'collapse' | 'pickup'
  | 'footstep' | 'glass' | 'alarm' | 'beep' | 'switch' | 'elevator' | 'elevatorDing' | 'radio' | 'spark'
  | 'fire' | 'spray' | 'flashbang' | 'smokePop' | 'impact' | 'keyboard' | 'shout'

/** Something audible that happened this frame. The game core only records it; an audio adapter plays it. */
export type SoundEvent = Vec & { kind: SoundKind }

const MAX_PENDING = 48

export function playSound(world: World, kind: SoundKind, at: Vec): void {
  if (world.sounds.length >= MAX_PENDING) world.sounds.shift()
  world.sounds.push({ kind, x: at.x, y: at.y })
}
