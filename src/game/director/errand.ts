import type { Guard } from '../security/model'
import type { Vec } from '../types'
import type { World } from '../world'
import { arrived, onErrand, release, sendTo } from './crew'
import { say } from './say'

/**
 * One guard's errand, the shape most events share: walk somewhere, stay a while, come back. It ends early if the
 * guard is pulled away (an alarm, a fight, a bullet), which is itself part of the story.
 */

export type ErrandPlan = {
  /** Said when he arrives, and when he leaves to go back. */
  arriveLine?: string
  leaveLine?: string
  /** Seconds he stays once there. */
  linger: number
  /** Seconds he may take to get there before the errand is called off. */
  limit: number
  onArrive?(world: World): void
  onLeave?(world: World): void
}

export type Errand = { guard: Guard; spot: Vec; state: 'going' | 'there' | 'done' | 'interrupted'; left: number; since: number }

export function startErrand(world: World, guard: Guard, spot: Vec): Errand {
  sendTo(guard, spot)
  return { guard, spot, state: 'going', left: 0, since: world.clock }
}

/** Advances an errand; returns true once it is over, one way or the other. */
export function stepErrand(world: World, errand: Errand, plan: ErrandPlan, dt: number): boolean {
  if (errand.state === 'done' || errand.state === 'interrupted') return true
  if (!onErrand(errand.guard, errand.spot)) {
    errand.state = 'interrupted'
    return true
  }
  if (errand.state === 'going') {
    if (world.clock - errand.since > plan.limit) {
      release(errand.guard, errand.spot)
      errand.state = 'interrupted'
      return true
    }
    if (!arrived(errand.guard, errand.spot)) return false
    errand.state = 'there'
    errand.left = plan.linger
    if (plan.arriveLine) say(world, errand.guard, plan.arriveLine)
    plan.onArrive?.(world)
    return false
  }
  errand.left -= dt
  if (errand.left > 0) return false
  release(errand.guard, errand.spot)
  if (plan.leaveLine) say(world, errand.guard, plan.leaveLine)
  plan.onLeave?.(world)
  errand.state = 'done'
  return true
}
