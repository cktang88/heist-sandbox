import { createGuard } from '../../security/model'
import { storeyWord } from '../../chronicle/place'
import type { World } from '../../world'
import { pick, roomsOfKind, spotIn } from '../crew'
import { voiceAt } from '../say'
import type { ConditionDef } from '../types'

/**
 * A party on one floor: off-duty guards drinking in a lounge, music loud enough to cover footsteps nearby (see
 * `masking.ts`), and the guests slow and jumpy (rookie nerve, already rattled), quick to give up if surprised.
 */

const GUESTS = 4
const DRUNK_SHOCK = 0.45
const CHATTER_SECONDS = 9
const PARTY_ROOMS = ['lounge', 'cafeteria', 'breakRoom']
const CHATTER = ['*music thumping*', 'Another round!', 'Ha! No way!', 'Turn it up!', '*glasses clinking*', 'Who\'s on shift? Not me!']

export const party: ConditionDef = {
  id: 'party',
  fits: (site) => site === 'complex',
  excludes: ['inspection', 'skeletonCrew'],
  start(world, rng) {
    const room = pick(roomsOfKind(world, PARTY_ROOMS).filter((candidate) => candidate.w >= 6), rng)
    if (!room) return { id: 'party', line: 'A party somewhere on site: off-duty guards are drinking.' }
    world.director.masking.rooms.add(room.id)
    for (let index = 0; index < GUESTS; index += 1) {
      const spot = spotIn(room, (index + 0.5) / GUESTS)
      const guest = createGuard({ x: Math.floor(spot.x), y: room.floorY, facing: index % 2 === 0 ? 1 : -1, role: 'post', roomId: room.id })
      guest.tier = 'rookie'
      guest.shock = DRUNK_SHOCK
      world.guards.push(guest)
    }
    let chatter = CHATTER_SECONDS * rng()
    return {
      id: 'party',
      line: `Party in the ${storeyWord(room.storey)} ${room.kind === 'breakRoom' ? 'break room' : room.kind} of the ${room.building}: loud music covers your steps nearby, and the guests are drunk and jumpy.`,
      step(stepWorld: World, dt: number) {
        chatter -= dt
        if (chatter > 0) return
        chatter = CHATTER_SECONDS * (0.6 + rng())
        if (Math.abs(stepWorld.player.x - (room.x + room.w / 2)) > 30) return
        voiceAt(stepWorld, { x: room.x + 1 + rng() * (room.w - 2), y: room.floorY - 3 }, CHATTER[Math.floor(rng() * CHATTER.length)])
      },
    }
  },
}
