import { isInCover } from '../cover'
import { smokeDensityAt } from '../hazards/hazards'
import { lightLevelAt } from '../light'
import { feetOf, isActive, type Guard } from '../security/model'
import { centerOf } from '../types'
import type { World } from '../world'
import { note } from './note'
import { placeName } from './place'

/**
 * Close calls: the player stays unseen while guards hunting for something walk within a few tiles of him. When the
 * last of them moves off without seeing him, and it lasted long enough to count, it goes in the story.
 */

const NEAR_X = 6
const SAME_FLOOR = 1.5
const WORTH_TELLING = 5
const HUNTING = new Set(['noticed', 'investigating', 'searching', 'combat'])

export function watchHiding(world: World): void {
  const chronicle = world.chronicle
  const seen = world.guards.some((guard) => guard.seesPlayer)
  const near = seen ? [] : huntersNear(world)
  if (near.length > 0) {
    if (!chronicle.hide) chronicle.hide = { since: world.clock, searchers: new Set(), place: placeName(world, feetOf(world.player)), how: hidingHow(world) }
    for (const index of near) chronicle.hide.searchers.add(index)
    return
  }
  const streak = chronicle.hide
  chronicle.hide = null
  if (!streak || seen) return
  const seconds = Math.round(world.clock - streak.since)
  if (seconds < WORTH_TELLING) return
  chronicle.tally.closeCalls += 1
  const beat = note(world, 'hidden', null, { n: seconds, detail: streak.how, who: String(streak.searchers.size) })
  beat.place = streak.place
  beat.t = streak.since
}

function huntersNear(world: World): number[] {
  const feet = feetOf(world.player)
  const found: number[] = []
  world.guards.forEach((guard: Guard, index) => {
    if (!isActive(guard) || !HUNTING.has(guard.mode)) return
    const other = feetOf(guard)
    if (Math.abs(other.x - feet.x) <= NEAR_X && Math.abs(other.y - feet.y) < SAME_FLOOR) found.push(index)
  })
  return found
}

function hidingHow(world: World): string {
  const player = world.player
  if (isInCover(world, player)) return player.crouching ? 'crouched behind cover' : 'behind cover'
  const body = centerOf(player)
  if (smokeDensityAt(world, body) > 0.3) return 'in the smoke'
  if (lightLevelAt(world, body) < 0.15) return 'in the dark'
  return 'out of sight'
}
