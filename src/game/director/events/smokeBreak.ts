import { feetOf } from '../../security/model'
import { roomOf } from '../../security/places'
import { idleGuards, nearestTo, pick, roomsOfKind, spotIn } from '../crew'
import { startErrand, stepErrand, type ErrandPlan } from '../errand'
import { say } from '../say'
import type { EventDef } from '../types'

/** A guard slips up to the roof for a cigarette: his round goes unwalked for a minute, and he is up there alone. */

const PLAN: ErrandPlan = { arriveLine: '*lights a cigarette*', leaveLine: 'Right. Back to it.', linger: 40, limit: 70 }

export const smokeBreak: EventDef = {
  id: 'smokeBreak', kind: 'timed', mood: 'release', cooldown: Infinity, repeats: 1, chance: 1,
  ready: (world) => world.rooms.some((room) => room.kind === 'rooftop'),
  start(world, rng) {
    const smoker = pick(idleGuards(world).filter((guard) => guard.role === 'patrol' && roomOf(world, feetOf(guard))), rng)
    if (!smoker) return null
    const building = roomOf(world, feetOf(smoker))?.building
    const roofs = roomsOfKind(world, ['rooftop'], building)
    const roof = nearestTo(roofs.length > 0 ? roofs : roomsOfKind(world, ['rooftop']), feetOf(smoker), (room) => spotIn(room))
    if (!roof) return null
    const errand = startErrand(world, smoker, spotIn(roof, 0.3 + rng() * 0.4))
    say(world, smoker, 'Going up for a smoke. Cover for me.')
    return {
      id: 'smokeBreak',
      step: (stepWorld, dt) => stepErrand(stepWorld, errand, PLAN, dt),
      outcome: () => errand.state === 'done' ? 'he finished his cigarette and went back' : 'he never finished his cigarette',
    }
  },
}
