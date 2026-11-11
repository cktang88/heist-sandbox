import type { Input } from '../input'
import { centerOf } from '../types'
import type { World } from '../world'
import { bodyInReach, pickUp, putDown, stepCarry, throwBody } from './carry'
import { leaveSpot, passerBy } from './hide'
import { whistle } from './lure'
import { intimidate } from './intimidate'
import { answerRadio } from './radio'
import { startChoke, stepChoke } from './takedown'

/**
 * The stealth keys that are not the ordinary "best thing in reach" E action: G to pick up and drop a body, T to throw
 * it, X to demand surrender or whistle, and E while something already has the hands busy (a choke, hiding, a radio call to answer).
 * Returns the prompt to show if it took the E key this frame, or undefined to let the usual E actions run.
 */
export function stealthControls(world: World, input: Input, dt: number): string | null | undefined {
  carryKeys(world, input, dt)
  if (input.fire || input.firePressed || input.punchPressed || input.kickPressed || input.detonatePressed) {
    world.stealth.suspiciousUntil = world.clock + 3
  }
  if (input.whistlePressed && !intimidate(world, input.aim)) whistle(world)
  if (world.stealth.choke) {
    const going = stepChoke(world, input.interact, dt)
    if (going) {
      handsFull(input)
      return world.stealth.choke!.struggle ? 'Keep holding E: wrestling him down (loud)' : 'Keep holding E: choking him out'
    }
  }
  // A lifted radio crackling is answered in a murmur, from a hiding place too; E gets him out once it is answered.
  if (world.stealth.checkIn) {
    if (input.interactPressed) answerRadio(world)
    else return `E: answer the radio for him (${Math.ceil(world.stealth.checkIn.until - world.clock)}s)`
    return null
  }
  if (world.stealth.hiding) return hidingKeys(world, input)
  return undefined
}

/**
 * G pressed (not held) picks up the nearest body and drops it again; T throws it. While a body is on the shoulder or
 * the player is hiding, grab and throw belong to this code, so the shield and furniture dragging leave them alone.
 */
function carryKeys(world: World, input: Input, dt: number): void {
  const stealth = world.stealth
  const pressed = input.grab && !stealth.grabWas
  stealth.grabWas = input.grab
  if (world.player.hidden) {
    input.grab = false
    input.throwPressed = false
    return
  }
  if (stealth.carried !== null) {
    if (pressed) putDown(world)
    else if (input.throwPressed) throwBody(world)
    input.grab = false
    input.throwPressed = false
    stepCarry(world, dt)
    return
  }
  if (!pressed || world.melee.shield || world.physProps.grabbed || stealth.choke) return
  const body = bodyInReach(world)
  if (body === null) return
  pickUp(world, body)
  input.grab = false
  stepCarry(world, dt)
}

/** Both arms round a man's neck: no shooting, punching, kicking, throwing or grabbing until he is down or let go. */
function handsFull(input: Input): void {
  Object.assign(input, { fire: false, firePressed: false, punchPressed: false, kickPressed: false, throwPressed: false, grab: false })
}

/** In hiding: E gets out, or bursts out onto a man walking right past. */
function hidingKeys(world: World, input: Input): string {
  const victim = passerBy(world)
  if (input.interactPressed) {
    leaveSpot(world)
    if (victim) {
      // He had no idea: the grab from hiding is as quiet as a choke from behind.
      const unaware = victim.state !== 'alert'
      world.player.facing = centerOf(victim).x >= centerOf(world.player).x ? 1 : -1
      startChoke(world, { guard: victim, quiet: unaware, heavy: victim.armored, startled: false })
    }
    return ''
  }
  return hidingPrompt(world)
}

export function hidingPrompt(world: World): string {
  return passerBy(world) ? 'E: grab him from hiding' : 'E: get out'
}
