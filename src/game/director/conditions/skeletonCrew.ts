import type { World } from '../../world'
import { placeAt, roomsOfKind, spotIn } from '../crew'
import type { ConditionDef } from '../types'

/**
 * Skeleton crew: a quarter of the patrols are off shift, asleep in the quarters. Fewer feet on the floors, but the
 * barracks are full of men who wake up when the alarm goes.
 */

const OFF_SHIFT_SHARE = 0.25
const BED_ROOMS = ['barracks', 'lockers', 'cafeteria']

export const skeletonCrew: ConditionDef = {
  id: 'skeletonCrew',
  fits: (site) => site === 'complex',
  excludes: ['vipVisit', 'party'],
  start(world, rng) {
    const beds = roomsOfKind(world, BED_ROOMS, 'quarters')
    const patrols = world.guards.filter((guard) => guard.role === 'patrol' && guard.roomId !== null && !beds.some((room) => room.id === guard.roomId))
    const count = beds.length === 0 ? 0 : Math.round(patrols.length * OFF_SHIFT_SHARE)
    for (let sent = 0; sent < count; sent += 1) {
      const [guard] = patrols.splice(Math.floor(rng() * patrols.length), 1)
      const room = beds[sent % beds.length]
      placeAt(guard, spotIn(room, 0.15 + rng() * 0.7), room)
      guard.role = 'post'
      guard.route = []
    }
    return { id: 'skeletonCrew', line: offShiftLine(world, count) }
  },
}

function offShiftLine(world: World, count: number): string {
  return `Skeleton crew: ${count} of the ${world.guards.length} guards are off shift, asleep in the quarters.`
}
