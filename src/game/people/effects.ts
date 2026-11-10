import { emitNoise } from '../noise'
import { playerLight } from '../security/perception'
import { feetOf } from '../security/model'
import { TIERS, VISION } from '../security/tuning'
import { playSound } from '../sounds'
import type { World } from '../world'
import { reveal } from './knowledge'
import { radio, say } from './lines'
import { BRAVE_SHOCK_CAP, effectOf, HALF_DEAF_SHARE, NIGHT_BLIND_KEEP, type TraitEffect } from './traits'
import type { PeopleState, Person, Snapshot } from './types'

/**
 * Traits at work. Each tick compares the guard with how he was at the last one and scales what changed:
 * a sharp-eyed man keeps more of each rise in his awareness, a coward more of each fright, a trigger-happy
 * one draws faster. The security code made the change; this only bends its size.
 */

/** Acts that take his eyes off his arc: what he notices meanwhile is halved. */
const DISTRACTING = new Set(['phone', 'smoke', 'noticeboard', 'speech', 'chat', 'coffee'])
const DISTRACTED_KEEP = 0.5
/** Grief or a grudge: fearless, and quick on the trigger. */
const FEARLESS_DRAW = 0.4
const CLUMSY_ODDS = 0.012
const CLUMSY_NOISE = 6

export function applyTraits(world: World, people: PeopleState, person: Person, before: Snapshot, tick: number): void {
  const guard = person.guard
  const effect = effectOf(person.traits, world.clock)
  scaleAwareness(world, person, before, effect)
  scaleShock(world, person, before, effect)
  onModeChange(world, people, person, before, effect)
  if (person.traits.includes('halfDeaf') && (guard.mode === 'calm' || guard.mode === 'caution') && people.rng() < HALF_DEAF_SHARE) {
    guard.deafSeconds = Math.max(guard.deafSeconds, tick)
  }
  if (person.traits.includes('clumsy') && (guard.mode === 'investigating' || guard.mode === 'searching') && people.rng() < CLUMSY_ODDS) stumble(world, people, person)
}

function scaleAwareness(world: World, person: Person, before: Snapshot, effect: TraitEffect): void {
  const guard = person.guard
  const rise = guard.awareness - before.awareness
  if (rise <= 0 || guard.mode === 'combat') return
  let keep = effect.awareness
  if (person.traits.includes('nightBlind') && playerLight(world) < VISION.lit) keep *= NIGHT_BLIND_KEEP
  if (person.act && DISTRACTING.has(person.act.name)) keep *= DISTRACTED_KEEP
  if (person.returning?.grudge === 'wary' || person.returning?.grudge === 'vengeful') keep *= 1.3
  const scaled = before.awareness + rise * keep
  // A sharper man is pushed only up to the line where the security code decides he has seen the man: that is its call.
  guard.awareness = keep > 1 ? Math.max(guard.awareness, Math.min(0.99, scaled)) : Math.max(0, scaled)
}

function scaleShock(world: World, person: Person, before: Snapshot, effect: TraitEffect): void {
  const guard = person.guard
  if (fearless(world, person)) {
    guard.shock = 0
    guard.nerve = Math.max(guard.nerve, TIERS.veteran.nerve)
    return
  }
  const rise = guard.shock - before.shock
  if (rise > 0 && effect.shock !== 1) {
    const kept = Math.min(1, before.shock + rise * effect.shock)
    guard.nerve = Math.max(0, Math.min(1, guard.nerve + (guard.shock - kept)))
    guard.shock = kept
  }
  if (person.traits.includes('brave') && guard.shock > BRAVE_SHOCK_CAP) {
    guard.nerve = Math.min(1, guard.nerve + guard.shock - BRAVE_SHOCK_CAP)
    guard.shock = BRAVE_SHOCK_CAP
  }
}

/** Grief turned to rage, or a returning man with a score to settle. */
export function fearless(world: World, person: Person): boolean {
  return world.clock < person.berserkUntil || person.returning?.grudge === 'vengeful'
}

function onModeChange(world: World, people: PeopleState, person: Person, before: Snapshot, effect: TraitEffect): void {
  const guard = person.guard
  if (before.mode === guard.mode) return
  if (guard.mode === 'combat') guard.drawSeconds *= fearless(world, person) ? FEARLESS_DRAW : effect.draw
  if (guard.mode === 'noticed' && before.mode === 'calm') {
    guard.modeSeconds -= effect.slowToLook
    if (person.traits.includes('jumpy') && say(world, people, person, 'startle', {}, true)) reveal(world, person, 'jumpy')
    else if (person.traits.includes('halfDeaf') && say(world, people, person, 'halfDeaf')) reveal(world, person, 'halfDeaf')
    else if (person.traits.includes('nightBlind') && playerLight(world) < VISION.lit && say(world, people, person, 'nightBlind')) reveal(world, person, 'nightBlind')
  }
  if (guard.mode === 'investigating' && person.traits.includes('byTheBook') && radio(world, people, person, 'callItIn')) reveal(world, person, 'byTheBook')
  if (guard.mode === 'searching' && guard.search) guard.search.endsAt = world.clock + (guard.search.endsAt - world.clock) * effect.search
}

/** Trips over something: a clatter colleagues ignore, but the player hears where he is. */
export function stumble(world: World, people: PeopleState, person: Person): void {
  const feet = feetOf(person.guard)
  emitNoise(world, { x: feet.x, y: feet.y - 0.5 }, CLUMSY_NOISE, 'guard')
  playSound(world, 'impact', feet)
  if (say(world, people, person, 'trip', {}, true)) reveal(world, person, 'clumsy')
}
