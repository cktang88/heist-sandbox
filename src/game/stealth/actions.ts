import { restrainGuard, type Guard } from '../guards'
import type { Action } from '../interact'
import { playSound } from '../sounds'
import { centerOf } from '../types'
import type { World } from '../world'
import { bodyInReach } from './carry'
import { takeUniform } from './disguise'
import { enterSpot, hidePrompt, spotForPlayer } from './hide'
import { noisemakerInReach, noisemakerPrompt, switchOn } from './noisemakers'
import { nearestSpot, roomForBody, spotFeet, spotKind } from './spots'
import { quickKill, startChoke, takedownTarget } from './takedown'
import { DISGUISE, KEYCARD, RADIO } from './tuning'
import { layBodyAt } from './bodies'

/**
 * The stealth actions that compete for the E key, each one a prompt and what it does. `interact.ts` picks the first
 * one that applies, in the order its list gives.
 */

/** Officers and control-room operators carry the keycards for the secure doors. */
export function carriesKeycard(world: World, guard: Guard): boolean {
  return (guard.role === 'officer' || guard.role === 'operator') && !world.stealth.keycards.has(world.guards.indexOf(guard))
}

/**
 * Taking a guard down. Standing, E is the quick kill; crouched, hold E to choke (a quiet choke from behind, a loud
 * wrestle from the front). A crouched player behind an officer lifts his keycard first. A startled guard can be
 * choked from any side: that is the window.
 */
export function takedownAction(world: World): Action | null {
  const target = takedownTarget(world)
  if (!target) return null
  const { guard } = target
  const key = `takedown:${world.guards.indexOf(guard)}`
  const choke: Action = { prompt: target.quiet ? 'Hold E: choke out' : 'Hold E: wrestle him down (loud)', key, run: () => startChoke(world, target) }
  if (target.startled) return { ...choke, prompt: 'Hold E: choke him NOW' }
  if (!target.quiet) return choke
  if (!world.player.crouching) return { prompt: 'E: take down', key, run: () => quickKill(world, guard), hint: 'Crouch and hold E to choke him out instead (silent)' }
  if (carriesKeycard(world, guard)) {
    return { prompt: 'Hold E: lift his keycard', key: `${key}:card`, hold: KEYCARD.liftSeconds, run: () => takeKeycard(world, guard), hint: 'Then hold E again to choke him out' }
  }
  return { ...choke, hint: 'Stand up and press E to kill him instead' }
}

function takeKeycard(world: World, guard: Guard): void {
  world.stealth.keycards.add(world.guards.indexOf(guard))
  playSound(world, 'pickup', centerOf(guard))
}

/** What can be done with a body lying in reach: tie him up, take his keycard, his radio, his uniform. */
export function bodyAction(world: World): Action | null {
  if (world.stealth.carried !== null) return null
  const index = bodyInReach(world)
  if (index === null) return null
  const guard = world.guards[index]
  // A man tied up and awake is for questioning (intel/); G still picks him up.
  if (!guard.out && guard.mode !== 'dead') return null
  const stealth = world.stealth
  const hint = 'G: pick him up'
  const key = `body:${index}`
  if (guard.out && !guard.restrained) return { prompt: 'E: tie him up (keeps him out for good)', key: `${key}:tie`, run: () => (guard.restrained = true), hint }
  if (carriesKeycard(world, guard)) return { prompt: 'Hold E: take his keycard', key: `${key}:card`, hold: KEYCARD.takeSeconds, run: () => takeKeycard(world, guard), hint }
  if (!stealth.radios.has(index)) return { prompt: 'Hold E: take his radio', key: `${key}:radio`, hold: RADIO.takeSeconds, run: () => stealth.radios.add(index), hint }
  if (!stealth.uniforms.has(index)) return { prompt: 'Hold E: put on his uniform', key: `${key}:uniform`, hold: DISGUISE.takeSeconds, run: () => takeUniform(world, guard), hint }
  return { prompt: hint, key, run: () => {} }
}

/** Carrying a body near a hiding place with room: stuff him in. */
export function stashAction(world: World): Action | null {
  const index = world.stealth.carried
  if (index === null) return null
  const player = world.player
  const feet = { x: player.x + player.w / 2, y: player.y + player.h }
  const prop = nearestSpot(world, feet, (candidate) => roomForBody(world, candidate))
  if (!prop) return { prompt: 'G: put him down   T: throw him', key: 'carry', run: () => {} }
  const kind = spotKind(prop.kind)!
  const where = kind.how === 'under' ? `under the ${kind.name}` : kind.how === 'behind' ? `behind the ${kind.name}` : `in the ${kind.name}`
  return {
    prompt: `E: hide the body ${where}`, key: `stash:${prop.id}`, hint: kind.how === 'behind' ? 'Only hidden while it is dark there' : undefined,
    run: () => {
      const guard = world.guards[index]
      world.stealth.carried = null
      guard.hiddenIn = prop.id
      layBodyAt(guard, spotFeet(prop), player.facing)
      playSound(world, 'door', spotFeet(prop))
    },
  }
}

export function hideAction(world: World): Action | null {
  if (world.stealth.carried !== null || world.melee.shield) return null
  const prop = spotForPlayer(world)
  if (!prop) return null
  return { prompt: hidePrompt(prop), key: `hide:${prop.id}`, run: () => enterSpot(world, prop) }
}

export function noisemakerAction(world: World): Action | null {
  const prop = noisemakerInReach(world)
  if (!prop) return null
  return { prompt: noisemakerPrompt(prop), key: `noise:${prop.id}`, run: () => switchOn(world, prop) }
}

/** A surrendered man is tied up, not killed. */
export function tieUpAction(world: World): Action | null {
  const center = centerOf(world.player)
  const guard = world.guards.find((other) => other.mode === 'surrendered' && !other.restrained && Math.hypot(centerOf(other).x - center.x, centerOf(other).y - center.y) < 1.6)
  if (!guard) return null
  return { prompt: 'E: tie up', key: 'tieUp', run: () => restrainGuard(world, guard) }
}
