import { restoreCircuit } from '../../devices/power'
import { deviceFeet } from '../../security/places'
import { feetOf } from '../../security/model'
import type { World } from '../../world'
import { idleGuards, nearestTo } from '../crew'
import { startErrand, stepErrand } from '../errand'
import { fuseBoxOf } from '../power'
import { radio, say } from '../say'
import type { EventDef } from '../types'

/**
 * Cut the power twice and the site calls its engineer: a guard who walks to the dead fuse box with a torch and puts
 * the lights back on, unless the box has been wrecked (or he never gets there).
 */

const CUTS_BEFORE_CALL = 2

export const engineer: EventDef = {
  id: 'engineer', kind: 'reactive', mood: 'raise', cooldown: 90, repeats: 2, chance: 0.8,
  ready: (world) => world.director.signals.powerCuts >= CUTS_BEFORE_CALL && deadBox(world) !== null,
  start(world) {
    const box = deadBox(world)
    if (!box || box.circuit === undefined) return null
    const circuit = box.circuit
    const spot = deviceFeet(world, box)
    const tech = nearestTo(idleGuards(world).filter((guard) => guard.role === 'patrol'), spot, feetOf)
    if (!tech) return null
    radio(world, 'Control: That breaker again. Sending the engineer.')
    say(world, tech, 'Torch on. Let\'s see what they did to my breakers.')
    world.director.signals.powerCuts = 0
    let fixed = false
    const errand = startErrand(world, tech, spot)
    const plan = {
      arriveLine: box.disabled ? 'This box is wrecked. Great.' : 'There we go.', linger: 4, limit: 90,
      onArrive: (stepWorld: World) => {
        restoreCircuit(stepWorld, circuit)
        fixed = !stepWorld.deadCircuits.has(circuit)
      },
    }
    return {
      id: 'engineer',
      step: (stepWorld, dt) => stepErrand(stepWorld, errand, plan, dt),
      outcome: () => (fixed ? 'the engineer got the lights back on' : errand.state === 'interrupted' ? 'the engineer never reached the fuse box' : 'the engineer found the fuse box wrecked'),
    }
  },
}

/** A fuse box whose circuit is dead through no doing of the director's. */
function deadBox(world: World) {
  for (const circuit of world.deadCircuits) {
    if (world.director.signals.ownDead.has(circuit)) continue
    const box = fuseBoxOf(world, circuit)
    if (box) return box
  }
  return null
}
