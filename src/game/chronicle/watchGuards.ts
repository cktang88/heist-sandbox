import { isBurningAt } from '../hazards/hazards'
import { feetOf, type Guard } from '../security/model'
import { centerOf, distance } from '../types'
import type { World } from '../world'
import { guardName } from './names'
import { note } from './note'

/**
 * What happened to each guard since the last look (a few times a second): killed and how, knocked out, tied up,
 * gave up, ran. One pass over the guards comparing three remembered values each.
 */

const OUT_COLD = 20
const RECENT = 1.5
const CLOSE = 1.8
const BLAST_REACH = 6

export function watchGuards(world: World): void {
  const seen = world.chronicle.guards
  const tally = world.chronicle.tally
  world.guards.forEach((guard, index) => {
    const before = seen.modes[index] ?? guard.mode
    // Out cold by the player's hand: the rival crew's victims have their own beat (a director event).
    const out = guard.mode !== 'dead' && guard.stunSeconds > OUT_COLD && !world.director.rivalVictims.has(guard)
    if (guard.mode !== before) changedMode(world, guard, index, before)
    if (out && !seen.out[index]) {
      tally.knockedOut += 1
      note(world, 'down', guard, { who: guardName(world, index), detail: 'knocked out', n: downs(world) + 1 })
    }
    if (guard.restrained && !seen.tied[index]) {
      tally.tiedUp += 1
      note(world, 'tied', guard, { who: guardName(world, index) })
    }
    seen.modes[index] = guard.mode
    seen.out[index] = out
    seen.tied[index] = guard.restrained
  })
}

function changedMode(world: World, guard: Guard, index: number, before: string): void {
  const who = guardName(world, index)
  if (guard.mode === 'dead') note(world, 'down', guard, { who, detail: howDied(world, guard), n: downs(world) + 1 })
  else if (guard.mode === 'surrendered') {
    world.chronicle.tally.surrendered += 1
    note(world, 'surrender', guard, { who })
  } else if (guard.mode === 'panic' && before !== 'panic') note(world, 'fled', guard, { who })
}

function downs(world: World): number {
  return world.chronicle.beats.filter((beat) => beat.kind === 'down').length
}

/** The likeliest cause, from what was going on around him just then. */
export function howDied(world: World, guard: Guard): string {
  const feet = feetOf(guard)
  const recently = (t: number) => world.clock - t <= RECENT
  const blast = world.chronicle.destruction.lastBlast
  if (blast && recently(blast.t) && distance(blast, centerOf(guard)) < BLAST_REACH) return 'blast'
  if (distance(centerOf(world.player), centerOf(guard)) < CLOSE) {
    const strike = world.melee.strike
    return strike && recently(strike.at) ? 'beaten' : 'takedown'
  }
  if (recently(world.chronicle.player.lastShotAt)) return `shot:${world.chronicle.player.lastShotTool}`
  if (isBurningAt(world, { x: feet.x, y: feet.y - 0.5 })) return 'fire'
  return 'accident'
}
