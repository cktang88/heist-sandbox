import type { World } from '../world'
import { hitTarget } from './hits'
import { stepLiquid } from './liquid'
import { blastPipes, watchFixtures } from './pipes'
import { followShots } from './shots'
import { stepSources } from './sources'
import { stepWading } from './wading'
import { shortSoakedDevices, soakFromPuddles } from './water'

/**
 * The couplings between systems: water from burst pipes and fixtures that pools, runs downstairs, puts out fire and
 * shorts electronics. Fields tick a few times a second, and only where something is happening.
 */
export { createSystems, type SystemsState } from './state'

const LIQUID_TICK = 0.25

export function stepSystems(world: World, dt: number): void {
  const systems = world.systems
  followShots(world, dt, (target, at, heading) => hitTarget(world, target, at, heading))
  if (world.effects.flashes.length > 0) blastPipes(world)
  systems.liquidClock += dt
  if (systems.liquidClock >= LIQUID_TICK) {
    systems.liquidClock = Math.min(LIQUID_TICK, systems.liquidClock - LIQUID_TICK)
    liquidTick(world, LIQUID_TICK)
  }
  stepWading(world, dt)
}

function liquidTick(world: World, tick: number): void {
  watchFixtures(world)
  stepSources(world, tick)
  stepLiquid(world, 'water', tick)
  soakFromPuddles(world)
  shortSoakedDevices(world)
}
