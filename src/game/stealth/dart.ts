import type { Guard } from '../guards'
import { emitNoise } from '../noise'
import { bark } from '../security/barks'
import { isActive, setMode } from '../security/model'
import { playSound } from '../sounds'
import { stopsShotsAt } from '../tiles'
import { centerOf, type Vec } from '../types'
import type { World } from '../world'
import { knockOutCold } from './bodies'
import { DART, TAKEDOWN } from './tuning'

/**
 * The dart gun: a near-silent shot that puts a man to sleep, but not at once. For a few seconds he staggers about
 * wondering what stung him (anyone watching sees him go down), then drops with a thud. Armour stops a dart: an
 * armoured man only feels the knock and comes looking.
 */

const STEP = 0.2

export function fireDart(world: World, hand: Vec, aim: Vec): void {
  playSound(world, 'switch', hand)
  const guard = dartHit(world, hand, aim)
  if (!guard) return
  if (guard.armored) {
    bark(world, guard, 'Something hit my vest...', true)
    guard.interest = { at: { x: hand.x, y: world.player.y + world.player.h }, kind: 'noise', priority: 4, reached: false }
    setMode(guard, 'noticed')
    return
  }
  world.stealth.darts.push({ guard: world.guards.indexOf(guard), at: world.clock + DART.dropSeconds })
  bark(world, guard, 'Ow! What the... I feel...', true)
  // He forgets whatever he was about to say on the radio, and only stares about him.
  guard.radio = null
  if (guard.mode === 'calm' || guard.mode === 'caution') {
    guard.interest = { at: { x: guard.x + guard.w / 2, y: guard.y + guard.h }, kind: 'noise', priority: 2, reached: false }
    setMode(guard, 'noticed')
  }
}

/** The first living, standing guard along the line before something solid. */
function dartHit(world: World, from: Vec, aim: Vec): Guard | null {
  for (let travelled = 0.5; travelled < DART.range; travelled += STEP) {
    const at = { x: from.x + aim.x * travelled, y: from.y + aim.y * travelled }
    if (stopsShotsAt(world.grid, at.x, at.y)) return null
    const hit = world.guards.find((guard) => isActive(guard) && at.x >= guard.x && at.x <= guard.x + guard.w && at.y >= guard.y && at.y <= guard.y + guard.h)
    if (hit) return hit
  }
  return null
}

/** Darted men whose time is up go down. */
export function stepDarts(world: World): void {
  const stealth = world.stealth
  if (stealth.darts.length === 0) return
  stealth.darts = stealth.darts.filter((dart) => {
    if (world.clock < dart.at) return true
    const guard = world.guards[dart.guard]
    if (guard.mode === 'dead' || guard.out) return false
    knockOutCold(world, guard, TAKEDOWN.dartOutSeconds)
    emitNoise(world, centerOf(guard), DART.fallNoise)
    playSound(world, 'impact', centerOf(guard))
    return false
  })
}
