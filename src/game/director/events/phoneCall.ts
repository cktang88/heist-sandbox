import { feetOf } from '../../security/model'
import { roomOf } from '../../security/places'
import { playSound } from '../../sounds'
import { idleGuards, nearestTo, pick, roomsOfKind, spotIn } from '../crew'
import { startErrand, stepErrand, type ErrandPlan } from '../errand'
import { say } from '../say'
import type { EventDef } from '../types'

/**
 * A phone call pulls the control room operator away from his monitors: the cameras record, but nobody is watching
 * them until he comes back.
 */

const PLAN: ErrandPlan = { arriveLine: 'Yes, sir. No, sir. Right away, sir.', leaveLine: 'Back on the monitors.', linger: 30, limit: 50 }
const AWAY_ROOMS = ['breakRoom', 'cafeteria', 'office', 'lounge']

export const phoneCall: EventDef = {
  id: 'phoneCall', kind: 'timed', mood: 'release', cooldown: Infinity, repeats: 1, chance: 1,
  ready: (world) => world.devices.some((device) => device.kind === 'camera' && !device.disabled),
  start(world, rng) {
    const operator = pick(idleGuards(world).filter((guard) => roomOf(world, feetOf(guard))?.kind === 'security'), rng)
    if (!operator) return null
    const building = roomOf(world, feetOf(operator))?.building
    const away = nearestTo(roomsOfKind(world, AWAY_ROOMS, building).filter((room) => room.floorY === operator.home.y || room.storey <= 1), feetOf(operator), (room) => spotIn(room))
    if (!away) return null
    playSound(world, 'beep', feetOf(operator))
    say(world, operator, 'Phone for me? Fine, I\'m coming.')
    const errand = startErrand(world, operator, spotIn(away, 0.5))
    return {
      id: 'phoneCall',
      step: (stepWorld, dt) => stepErrand(stepWorld, errand, PLAN, dt),
      outcome: () => errand.state === 'done' ? 'the monitors went unwatched while he took the call' : 'he was called back before the call was over',
    }
  },
}
