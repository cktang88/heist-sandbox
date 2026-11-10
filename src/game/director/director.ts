import { lastEvent, note } from '../chronicle/note'
import type { World } from '../world'
import { CONDITIONS } from './conditions/registry'
import { EVENTS } from './events/registry'
import { available, candidates, decideMood, REACTIVE_GAP } from './pacing'
import type { EventDef } from './types'
import { watchSignals } from './watch'

/**
 * The heist director. When started it sets up tonight's conditions; every step it runs them and the events under
 * way; about once a second it looks at the heist and decides whether to spring something (see pacing.ts).
 */

const LOOK_SECONDS = 1
/** After a reactive event's dice say no, the same trigger is not rolled again for this long. */
const REROLL_SECONDS = 20

/**
 * Turns the director on for this heist and sets up tonight's conditions at once, before the first step, so the
 * briefing can name them. The game does this; tests of other systems leave it off and see an untouched site.
 */
export function startDirector(world: World): void {
  world.director.enabled = true
  if (!world.director.started) setUp(world)
}

/** One line per condition in play, for the briefing at the start and the pause menu (empty while the director is off). */
export function nightConditions(world: World): string[] {
  return world.director.conditions.map((condition) => condition.line)
}

export function stepDirector(world: World, dt: number): void {
  const director = world.director
  if (!director.enabled) return
  for (const condition of director.conditions) condition.step?.(world, dt)
  director.running = director.running.filter((event) => {
    if (!event.step(world, dt)) return true
    const beat = lastEvent(world, event.id)
    if (beat) beat.outcome = event.outcome()
    director.cooldowns.set(event.id, world.clock + (EVENTS.find((def) => def.id === event.id)?.cooldown ?? 0))
    return false
  })
  if (world.clock < director.nextLook) return
  director.nextLook = world.clock + LOOK_SECONDS
  watchSignals(world)
  react(world)
  pace(world)
}

function setUp(world: World): void {
  const director = world.director
  director.started = true
  director.conditions = director.picks.map((id) => CONDITIONS.find((condition) => condition.id === id)!.start(world, director.rng))
  for (const condition of director.conditions) note(world, 'tonight', null, { detail: condition.id })
}

/** The player did something an event answers: roll for it. */
function react(world: World): void {
  const director = world.director
  if (world.clock - director.lastEventAt < REACTIVE_GAP) return
  for (const event of EVENTS) {
    if (event.kind !== 'reactive' || !available(director, event, world.clock) || !event.ready(world)) continue
    if (director.rng() >= event.chance) {
      director.cooldowns.set(event.id, world.clock + REROLL_SECONDS)
      continue
    }
    if (launch(world, event)) return
  }
}

/** The director's own move, when the pacing rule asks for one. */
function pace(world: World): void {
  const director = world.director
  const decision = decideMood(world)
  director.lastDecision = decision.why
  if (!decision.mood) return
  const pool = candidates(world, EVENTS, decision.mood)
  while (pool.length > 0) {
    const [event] = pool.splice(Math.floor(director.rng() * pool.length), 1)
    if (launch(world, event)) return
  }
}

function launch(world: World, def: EventDef): boolean {
  const director = world.director
  const running = def.start(world, director.rng)
  if (!running) return false
  director.running.push(running)
  director.history.push({ id: def.id, at: world.clock, mood: def.mood })
  director.lastEventAt = world.clock
  note(world, 'event', world.player, { detail: def.id })
  return true
}
