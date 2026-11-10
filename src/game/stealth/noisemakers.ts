import type { PropState } from '../cover'
import { propById, propCenter, propsNear } from '../hazards/props'
import { emitNoise } from '../noise'
import type { PropKind } from '../propCatalog'
import { bark } from '../security/barks'
import { isActive, setMode } from '../security/model'
import { playSound } from '../sounds'
import { centerOf, distance } from '../types'
import type { World } from '../world'
import { answerLure } from './lure'
import { NOISEMAKER } from './tuning'

/**
 * Machines that make a racket once switched on: a TV, a wall screen, an arcade cabinet, a vending machine, a coffee
 * machine, a radio set. It keeps going until a guard walks over and switches it off, which pulls him away from his
 * post (and covers a little noise). Each one works a couple of times; after that nobody falls for it.
 */

const NOISY: Partial<Record<PropKind, string>> = {
  tvStand: 'TV', wallScreen: 'screen', arcadeCabinet: 'arcade machine', vendingMachine: 'vending machine',
  coffeeMachine: 'coffee machine', radioStation: 'radio set',
}
const REACH = 1.6

/** A machine in reach the player could switch on, if any. */
export function noisemakerInReach(world: World): PropState | null {
  const center = centerOf(world.player)
  for (const prop of propsNear(world, center, REACH + 1)) {
    if (!NOISY[prop.kind] || prop.broken || world.stealth.noisemakers.some((on) => on.prop === prop.id)) continue
    if ((world.stealth.noisemakerUses.get(prop.id) ?? 0) >= NOISEMAKER.maxUses) continue
    if (Math.abs(propCenter(prop).x - center.x) < REACH) return prop
  }
  return null
}

export function noisemakerPrompt(prop: PropState): string {
  return `E: switch on the ${NOISY[prop.kind]} (pulls a guard over)`
}

export function switchOn(world: World, prop: PropState): void {
  const at = propCenter(prop)
  world.stealth.noisemakerUses.set(prop.id, (world.stealth.noisemakerUses.get(prop.id) ?? 0) + 1)
  world.stealth.noisemakers.push({ prop: prop.id, at, nextNoise: world.clock, blared: false })
  playSound(world, 'switch', at)
}

/** Every frame: running machines blare now and then, and a guard who reaches one switches it off. */
export function stepNoisemakers(world: World): void {
  const stealth = world.stealth
  stealth.noisemakers = stealth.noisemakers.filter((on) => {
    // Shot, burnt or smashed, it has gone quiet for good.
    if (propById(world, on.prop)?.broken !== false) return false
    const off = world.guards.find((guard) => isActive(guard) && distance(centerOf(guard), on.at) < NOISEMAKER.switchReach + 1 && Math.abs(guard.y + guard.h - (on.at.y + 1)) < 3)
    if (off) {
      const used = stealth.noisemakerUses.get(on.prop) ?? 1
      bark(world, off, used > 1 ? 'This thing again? Someone is messing with us.' : 'Who left this on?', true)
      playSound(world, 'switch', on.at)
      if (used > 1) setMode(off, 'caution')
      return false
    }
    if (world.clock < on.nextNoise) return true
    on.nextNoise = world.clock + NOISEMAKER.every
    playSound(world, 'beep', on.at)
    emitNoise(world, on.at, NOISEMAKER.noise)
    // The first blare is the lure; the rest only keep the man coming.
    if (!on.blared) answerLure(world, on.at)
    on.blared = true
    return true
  })
}
