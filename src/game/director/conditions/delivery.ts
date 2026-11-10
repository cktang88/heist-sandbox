import { lastEvent, note } from '../../chronicle/note'
import { floorAt, type Floor } from '../../devices/floor'
import { unlockFloorDoors } from '../../devices/locks'
import { deviceState } from '../../devices/state'
import { feetOf, type Guard } from '../../security/model'
import { playSound } from '../../sounds'
import type { Vec } from '../../types'
import type { World } from '../../world'
import { idleGuards, nearestTo, onErrand, release, roomsOfKind, sendTo, spotIn } from '../crew'
import { clockText } from '../clockText'
import { radio, say } from '../say'
import type { ConditionDef } from '../types'

/**
 * A delivery truck arrives at a set time: the depot's ground-floor doors are unlocked for it and the nearest guards
 * spend a minute at the loading dock checking the load, with their backs to everything else. When the truck has
 * gone the doors lock again.
 */

const EARLIEST = 50
const SPREAD = 110
const UNLOADING = 60
const HANDS = 3

export const delivery: ConditionDef = {
  id: 'delivery',
  fits: (site) => site === 'complex',
  excludes: [],
  start(world, rng) {
    const at = Math.round(EARLIEST + rng() * SPREAD)
    const dock = roomsOfKind(world, ['loadingDock'], 'depot')[0] ?? roomsOfKind(world, ['loadingDock'])[0]
    let crew: Guard[] = []
    let posts: Vec[] = []
    let phase: 'waiting' | 'unloading' | 'over' = 'waiting'
    let relock = () => {}
    return {
      id: 'delivery',
      line: `Delivery at ${clockText(at)}: the depot's doors open for the truck and its guards are busy at the loading dock for a minute.`,
      step(stepWorld: World) {
        if (!dock || phase === 'over') return
        const spot = spotIn(dock, 0.5)
        if (phase === 'waiting' && stepWorld.clock >= at) {
          phase = 'unloading'
          relock = unlockForTruck(stepWorld, floorAt(stepWorld, dock.building, dock.storey, dock.floorY))
          crew = closest(stepWorld, spot)
          posts = crew.map((_, index) => ({ x: spot.x + index * 1.5 - 1.5, y: spot.y }))
          crew.forEach((guard, index) => sendTo(guard, posts[index]))
          playSound(stepWorld, 'door', spot)
          radio(stepWorld, 'Gate: Delivery truck\'s in. Opening the depot.')
          if (crew[0]) say(stepWorld, crew[0], 'Let\'s see that manifest.')
          note(stepWorld, 'event', spot, { detail: 'delivery' })
        } else if (phase === 'unloading' && stepWorld.clock >= at + UNLOADING) {
          phase = 'over'
          const stayed = crew.filter((guard, index) => onErrand(guard, posts[index])).length
          crew.forEach((guard, index) => release(guard, posts[index]))
          relock()
          radio(stepWorld, 'Gate: Truck\'s clear. Back to your posts.')
          const beat = lastEvent(stepWorld, 'delivery')
          if (beat) beat.outcome = stayed === crew.length ? 'the guards were busy unloading the whole time' : 'the unloading was cut short'
        }
      },
    }
  },
}

/** Opens the floor's locks for the truck; the function returned locks again exactly what was opened for it. */
function unlockForTruck(world: World, floor: Floor): () => void {
  const state = deviceState(world)
  const doorsBefore = new Set(state.unlockedDoors)
  const keypadsBefore = new Set(world.devices.filter((device) => device.kind === 'keypad' && device.hacked))
  unlockFloorDoors(world, floor)
  const doors = [...state.unlockedDoors].filter((key) => !doorsBefore.has(key))
  const keypads = world.devices.filter((device) => device.kind === 'keypad' && device.hacked && !keypadsBefore.has(device))
  return () => {
    for (const key of doors) state.unlockedDoors.delete(key)
    for (const keypad of keypads) keypad.hacked = false
  }
}

function closest(world: World, spot: { x: number; y: number }): Guard[] {
  const free = idleGuards(world).filter((guard) => guard.role !== 'operator')
  const crew: Guard[] = []
  while (crew.length < HANDS) {
    const next = nearestTo(free.filter((guard) => !crew.includes(guard)), spot, feetOf)
    if (!next) break
    crew.push(next)
  }
  return crew
}
