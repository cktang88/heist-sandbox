import { createGuard } from '../../security/model'
import { isSolidAt } from '../../tiles'
import type { GuardSpawn, Room } from '../../site'
import type { World } from '../../world'
import { roomsOfKind } from '../crew'
import type { ConditionDef } from '../types'

/**
 * A VIP is visiting: a protection detail doubles the guard where the VIP stays (the executive floors on the complex;
 * beside the existing guards on the small site), led by an officer.
 */

const DETAIL_COMPLEX = 8
const DETAIL_SMALL = 3
const VIP_ROOMS = ['executive', 'penthouse', 'conference']

export const vipVisit: ConditionDef = {
  id: 'vipVisit',
  fits: () => true,
  excludes: ['skeletonCrew'],
  start(world, rng) {
    const rooms = roomsOfKind(world, VIP_ROOMS)
    const spawns = rooms.length > 0 ? detailInRooms(rooms, DETAIL_COMPLEX, rng) : detailBeside(world, DETAIL_SMALL, rng)
    spawns.forEach((spawn, index) => world.guards.push(createGuard(index === 0 ? { ...spawn, role: 'officer' } : spawn)))
    const where = rooms.length > 0 ? 'on the executive floors' : 'around the building'
    return { id: 'vipVisit', line: `VIP visit: ${spawns.length} extra bodyguards ${where}, led by an officer.` }
  },
}

function detailInRooms(rooms: Room[], count: number, rng: () => number): GuardSpawn[] {
  const chosen = [...rooms].sort((a, b) => b.storey - a.storey).slice(0, Math.ceil(count / 2))
  return Array.from({ length: count }, (_, index) => {
    const room = chosen[index % chosen.length]
    const x = room.x + 1 + Math.floor(rng() * Math.max(1, room.w - 3))
    const route = room.w >= 6 ? [{ x: room.x + 1, y: room.floorY }, { x: room.x + room.w - 2, y: room.floorY }] : undefined
    return { x, y: room.floorY, facing: rng() < 0.5 ? 1 : -1, role: route ? 'patrol' : 'post', roomId: room.id, route }
  })
}

/** A second man a step from an existing guard's post, or on it if the step would put him in a wall. */
function detailBeside(world: World, count: number, rng: () => number): GuardSpawn[] {
  const guards = world.guards
  return Array.from({ length: Math.min(count, guards.length) }, () => {
    const partner = guards[Math.floor(rng() * guards.length)]
    const beside = Math.floor(partner.home.x) + (rng() < 0.5 ? -2 : 1)
    const clear = !isSolidAt(world.grid, beside + 0.5, partner.home.y - 0.5) && !isSolidAt(world.grid, beside + 0.5, partner.home.y - 1.5)
    return { x: clear ? beside : Math.floor(partner.home.x), y: partner.home.y, facing: partner.facing === 1 ? -1 : 1, role: 'patrol' }
  })
}
