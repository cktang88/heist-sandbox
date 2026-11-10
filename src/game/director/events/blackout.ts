import { feetOf } from '../../security/model'
import { roomOf } from '../../security/places'
import { playSound } from '../../sounds'
import type { World } from '../../world'
import { buildingCircuits, killCircuit, reviveCircuit } from '../power'
import { radio } from '../say'
import type { EventDef } from '../types'

/**
 * The grid drops out in one building (the player's, if he is inside one) for half a minute. The control room knows
 * it is the grid, so nobody goes looking: a free window of darkness that ends on its own.
 */

const DARK_SECONDS = 30

export const blackout: EventDef = {
  id: 'blackout', kind: 'timed', mood: 'release', cooldown: Infinity, repeats: 1, chance: 1,
  ready: (world) => world.devices.some((device) => device.kind === 'fusebox'),
  start(world) {
    const building = roomOf(world, feetOf(world.player))?.building ?? 'tower'
    const killed = buildingCircuits(world, building).filter((circuit) => killCircuit(world, circuit, true))
    if (killed.length === 0) return null
    playSound(world, 'spark', feetOf(world.player))
    radio(world, `Control: Grid's dropped in the ${building}. Backup in thirty, sit tight.`)
    let left = DARK_SECONDS
    return {
      id: 'blackout',
      step(stepWorld: World, dt: number) {
        left -= dt
        if (left > 0) return false
        for (const circuit of killed) reviveCircuit(stepWorld, circuit)
        radio(stepWorld, `Control: Power's back in the ${building}.`)
        return true
      },
      outcome: () => `the ${building} went dark for half a minute`,
    }
  },
}
