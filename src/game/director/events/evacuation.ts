import { feetOf, type Guard } from '../../security/model'
import { roomOf } from '../../security/places'
import { playSound } from '../../sounds'
import type { Vec } from '../../types'
import type { World } from '../../world'
import { idleGuards, release, sendTo } from '../crew'
import { evacuationPoint, storeysOf, unlockStorey } from '../evacuate'
import { radio } from '../say'
import type { EventDef } from '../types'

/**
 * A fire that takes hold in a room gets its building evacuated, floor by floor outward from the fire: each floor's
 * doors unlock by fire code and its calm guards leave their posts for the street. They come back when it is over.
 */

const TAKES_HOLD = 8
const FLOOR_EVERY = 4
const EVACUATION_SECONDS = 75

export const evacuation: EventDef = {
  id: 'evacuation', kind: 'reactive', mood: 'release', cooldown: 180, repeats: 1, chance: 1,
  ready: (world) => burningRoom(world) !== null,
  start(world) {
    const room = burningRoom(world)
    if (!room) return null
    const building = room.building
    const order = storeysOf(world, building).sort((a, b) => Math.abs(a - room.storey) - Math.abs(b - room.storey))
    const out = evacuationPoint(world, building)
    const walkers: { guard: Guard; spot: Vec }[] = []
    let next = 0
    let clock = 0
    playSound(world, 'alarm', { x: room.x + room.w / 2, y: room.floorY })
    radio(world, `Control: Fire in the ${building}! Evacuate, floor by floor.`)
    return {
      id: 'evacuation',
      step(stepWorld: World, dt: number) {
        clock += dt
        while (next < order.length && clock >= next * FLOOR_EVERY) emptyFloor(stepWorld, building, order[next++], out, walkers)
        if (clock < EVACUATION_SECONDS) return false
        for (const walker of walkers) release(walker.guard, walker.spot)
        radio(stepWorld, `Control: Fire crews have it. Back to your posts.`)
        return true
      },
      outcome: () => `${walkers.length} guards filed out of the ${building}`,
    }
  },
}

function emptyFloor(world: World, building: string, storey: number, out: Vec, walkers: { guard: Guard; spot: Vec }[]): void {
  unlockStorey(world, building, storey)
  for (const guard of idleGuards(world)) {
    const room = roomOf(world, feetOf(guard))
    if (room?.building !== building || room.storey !== storey) continue
    const spot = { x: out.x + (walkers.length % 9) - 4, y: out.y }
    sendTo(guard, spot)
    walkers.push({ guard, spot })
  }
}

function burningRoom(world: World) {
  for (const [id, seconds] of world.hazards.roomFire) {
    if (seconds < TAKES_HOLD) continue
    const room = world.rooms.find((candidate) => candidate.id === id)
    if (room && room.building !== 'grounds' && room.storey >= 0) return room
  }
  return null
}
