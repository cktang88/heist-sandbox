import type { World } from '../world'
import { openedTiles } from './changes'
import { stepElectric } from './electric'
import { hitTarget } from './hits'
import { stepLiquid } from './liquid'
import { blastPipes, watchFixtures } from './pipes'
import { stepShocks } from './shock'
import { followShots } from './shots'
import { stepSources } from './sources'
import { stepWading } from './wading'
import { shortSoakedDevices, soakFromPuddles } from './water'
import { sparkWires, wiresFromOpenedCeilings } from './wires'

/**
 * The couplings between systems: water from burst pipes and fixtures that pools, runs downstairs, puts out fire and
 * shorts electronics; live kit and cables that electrify the water they touch until a breaker trips. Fields tick a
 * few times a second, and only where something is happening.
 */
export { createSystems, type SystemsState } from './state'
export { strikeAt } from './lightning'

const LIQUID_TICK = 0.25

export function stepSystems(world: World, dt: number): void {
  const systems = world.systems
  followShots(world, dt, (target, at, heading) => hitTarget(world, target, at, heading))
  if (world.effects.flashes.length > 0) blastPipes(world)
  wiresFromOpenedCeilings(world, openedTiles(world))
  systems.liquidClock += dt
  if (systems.liquidClock >= LIQUID_TICK) {
    systems.liquidClock = Math.min(LIQUID_TICK, systems.liquidClock - LIQUID_TICK)
    liquidTick(world, LIQUID_TICK)
  }
  stepWading(world, dt)
  stepShocks(world)
}

function liquidTick(world: World, tick: number): void {
  watchFixtures(world)
  stepSources(world, tick)
  stepLiquid(world, 'water', tick)
  soakFromPuddles(world)
  shortSoakedDevices(world)
  stepElectric(world, tick)
  sparkWires(world, tick)
}
