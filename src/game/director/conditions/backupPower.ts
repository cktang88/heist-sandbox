import type { World } from '../../world'
import { pick } from '../crew'
import { buildingCircuits, killCircuit, reviveCircuit, siteCircuits } from '../power'
import type { ConditionDef } from '../types'

/**
 * The grid is on backup: one building is dark all night (the control room knows, so nobody goes to fix it), and the
 * lights everywhere else flicker now and then, a heartbeat of darkness to slip through.
 */

const DARK_CANDIDATES = ['quarters', 'depot']
const FLICKER_MIN = 4
const FLICKER_SPREAD = 8
const FLICKER_SECONDS = 0.35

export const backupPower: ConditionDef = {
  id: 'backupPower',
  fits: (site) => site === 'complex',
  excludes: [],
  start(world, rng) {
    const buildings = DARK_CANDIDATES.filter((building) => buildingCircuits(world, building).length > 0)
    const dark = pick(buildings, rng) ?? 'tower'
    for (const circuit of buildingCircuits(world, dark)) killCircuit(world, circuit, true)
    const others = siteCircuits(world).filter((circuit) => !world.deadCircuits.has(circuit))
    let nextFlicker = FLICKER_MIN + rng() * FLICKER_SPREAD
    let flickering: number | null = null
    let flickerLeft = 0
    return {
      id: 'backupPower',
      line: `Grid on backup power: the ${dark} is dark all night, and the lights elsewhere flicker.`,
      step(stepWorld: World, dt: number) {
        if (flickering !== null) {
          flickerLeft -= dt
          if (flickerLeft > 0) return
          reviveCircuit(stepWorld, flickering)
          flickering = null
        }
        nextFlicker -= dt
        if (nextFlicker > 0) return
        nextFlicker = FLICKER_MIN + rng() * FLICKER_SPREAD
        const circuit = pick(others, rng)
        if (circuit === null || !killCircuit(stepWorld, circuit, true)) return
        flickering = circuit
        flickerLeft = FLICKER_SECONDS
      },
    }
  },
}
