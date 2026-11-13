import { nameOf } from '../../security/barks'
import { createGuard, isActive, type Guard } from '../../security/model'
import type { Vec } from '../../types'
import type { World } from '../../world'
import { arrived, onErrand, pick, release, sendTo } from '../crew'
import { say } from '../say'
import type { ConditionDef } from '../types'

/**
 * An inspection by a strict officer: nobody is a rookie tonight (green guards are on their best behaviour) and the
 * inspector himself walks from post to post, a veteran wandering the site with no fixed route.
 */

const VISIT_LIMIT = 40
const LINGER = 6
const REBUKES = ['Stand up straight, {name}!', 'Is that how you hold a post, {name}?', 'Eyes open, {name}. I\'m watching.', 'Call that a patrol, {name}?']

export const inspection: ConditionDef = {
  id: 'inspection',
  fits: () => true,
  excludes: ['party'],
  start(world, rng) {
    for (const guard of world.guards) {
      if (guard.tier === 'rookie') guard.tier = 'regular'
      guard.shock = 0
    }
    const start = pick(world.guards, rng)
    const inspector = start ? createGuard({ x: Math.floor(start.home.x), y: start.home.y, facing: 1, role: 'officer', roomId: start.roomId ?? undefined }) : null
    if (inspector) world.guards.push(inspector)
    let visit: { target: Guard; spot: Vec; since: number } | null = null
    let lingerLeft = 0
    return {
      id: 'inspection',
      line: 'Inspection tonight: a strict officer walks from post to post, and nobody on duty is green.',
      step(stepWorld: World, dt: number) {
        if (!inspector) return
        if (!isActive(inspector) || inspector.mode !== 'calm') {
          // Pulled away (a noise, a fight, an alert that keeps him on edge for the rest of the night): the visit is off.
          // Left in place, the station would hold him at that man's post for good, since only this step gives it back.
          if (visit) release(inspector, visit.spot)
          visit = null
          return
        }
        if (visit) {
          const current = visit
          const done = !onErrand(inspector, current.spot) || stepWorld.clock - current.since > VISIT_LIMIT
          if (!done && arrived(inspector, current.spot)) {
            if (lingerLeft === LINGER) say(stepWorld, inspector, rebuke(stepWorld, current.target, rng()))
            lingerLeft -= dt
          }
          if (!done && lingerLeft > 0) return
          release(inspector, current.spot)
          visit = null
        }
        if (inspector.station) return
        const target = pick(stepWorld.guards.filter((guard) => guard !== inspector && isActive(guard) && guard.mode === 'calm'), rng)
        if (!target) return
        visit = { target, spot: { ...target.home }, since: stepWorld.clock }
        sendTo(inspector, visit.spot)
        lingerLeft = LINGER
      },
    }
  },
}

function rebuke(world: World, target: Guard, roll: number): string {
  return REBUKES[Math.floor(roll * REBUKES.length)].replace('{name}', nameOf(world.guards.indexOf(target)))
}
