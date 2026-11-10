import { sayAt } from '../security/barks'
import { log, reportEvent } from '../security/report'
import { unitName } from '../security/places'
import { nextCheckIn } from '../security/checkins'
import { playSound } from '../sounds'
import { centerOf } from '../types'
import type { World } from '../world'
import { RADIO } from './tuning'

/**
 * A downed guard's radio in the player's pocket. When control calls that man for his check-in, the radio crackles
 * and the player has a few seconds to answer for him. A couple of bluffs pass; after that control's ear catches it,
 * and once a colleague has found the body without its radio, control believes nothing on that channel.
 */

/** Control is calling a man whose radio the player has: the call waits a few seconds for an answer. */
export function ringPocketRadio(world: World, guard: number): void {
  world.stealth.checkIn = { guard, until: world.clock + RADIO.answerSeconds }
  // Not yet missing to control, but not to be scheduled again while the call is waiting.
  world.guards[guard].missing = true
  log(world, `Control: ${unitName(guard)}, check in.`)
  playSound(world, 'radio', centerOf(world.player))
}

/** The player answers: control buys it, or (too many bluffs) does not. Returns whether it was believed. */
export function answerRadio(world: World): boolean {
  const call = world.stealth.checkIn
  if (!call) return false
  world.stealth.checkIn = null
  world.stealth.bluffs += 1
  sayAt(world, { x: centerOf(world.player).x, y: world.player.y - 0.5 }, '"All quiet, Control."')
  if (world.stealth.bluffs <= RADIO.bluffs) {
    log(world, `${unitName(call.guard)}: All quiet, Control.`)
    Object.assign(world.guards[call.guard], { checkInAt: nextCheckIn(world), missing: false })
    return true
  }
  log(world, `Control: ${unitName(call.guard)}, you don't sound like yourself. Sending someone.`)
  reportEvent(world, { kind: 'missedCheckIn', guard: call.guard })
  return false
}

/** The call went unanswered: the man is missing, as if nobody had his radio. Returns the guard index, or null. */
export function unansweredCall(world: World): number | null {
  const call = world.stealth.checkIn
  if (!call || world.clock < call.until) return null
  world.stealth.checkIn = null
  return call.guard
}
