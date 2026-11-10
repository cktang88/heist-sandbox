import type { World } from '../world'
import { stepTraps } from './actions'
import { checkBackdrafts } from './backdraft'
import { openedTiles } from './changes'
import { stepElectric } from './electric'
import { stepFans } from './fans'
import { burnFuel, watchTanks } from './fuel'
import { stepHeat } from './heat'
import { dropBrokenFittings, loosenFittings, stepFallingFittings } from './hanging'
import { hitTarget } from './hits'
import { sparkSwitchedCircuits } from './ignition'
import { stepLiquid } from './liquid'
import { blastPipes, watchFixtures } from './pipes'
import { stepRolling } from './rolling'
import { stepShocks } from './shock'
import { followShots } from './shots'
import { stepSources } from './sources'
import { stepWading } from './wading'
import { shortSoakedDevices, soakFromPuddles } from './water'
import { sparkWires, wiresFromOpenedCeilings } from './wires'

/**
 * The couplings between systems: water from burst pipes and fixtures that pools, runs downstairs, puts out fire and
 * shorts electronics; live kit and cables that electrify the water they touch until a breaker trips; gas that rises,
 * fans, backdrafts and sparks; fuel trails that burn; long fires that crack glass, heat doors and burn through floors;
 * fittings that come down on whoever is under them and vehicles that roll. Fields tick a few times a second, and only where something is
 * happening.
 */
export { createSystems, type SystemsState } from './state'
export { strikeAt } from './lightning'
export { ignitionSourceAt, lightCigarette } from './ignition'
export { fanAction, setFan } from './fans'
export { doorTooHot, touchHotDoor } from './heat'
export { handbrakeAction, releaseHandbrake } from './rolling'
export { systemsAction, valveAction, gasFittingAction, fuelTapAction, cableAction, timerAction, rigDoorAction, shutValves } from './actions'

const LIQUID_TICK = 0.25
/** How often people's footing and shocks are looked at. */
const PEOPLE_TICK = 0.1
const HEAT_TICK = 0.5

export function stepSystems(world: World, dt: number): void {
  const systems = world.systems
  followShots(world, dt, (target, at, heading) => hitTarget(world, target, at, heading))
  if (world.effects.flashes.length > 0) blastPipes(world)
  const opened = openedTiles(world)
  wiresFromOpenedCeilings(world, opened)
  checkBackdrafts(world, opened)
  loosenFittings(world, opened)
  stepFallingFittings(world, dt)
  stepRolling(world, dt)
  stepTraps(world, opened, dt)
  sparkSwitchedCircuits(world)
  systems.liquidClock += dt
  if (systems.liquidClock >= LIQUID_TICK) {
    systems.liquidClock = Math.min(LIQUID_TICK, systems.liquidClock - LIQUID_TICK)
    liquidTick(world, LIQUID_TICK)
  }
  systems.heatClock += dt
  if (systems.heatClock >= HEAT_TICK) {
    systems.heatClock = Math.min(HEAT_TICK, systems.heatClock - HEAT_TICK)
    if (world.hazards.fires.size > 0 || systems.heat.size > 0 || systems.hotDoors.size > 0) stepHeat(world, HEAT_TICK)
  }
  systems.peopleClock += dt
  const peopleTick = systems.peopleClock >= PEOPLE_TICK ? PEOPLE_TICK : 0
  if (peopleTick > 0) systems.peopleClock = Math.min(PEOPLE_TICK, systems.peopleClock - PEOPLE_TICK)
  stepWading(world, dt, peopleTick)
  if (peopleTick > 0) stepShocks(world)
}

function liquidTick(world: World, tick: number): void {
  watchFixtures(world)
  watchTanks(world)
  dropBrokenFittings(world)
  stepSources(world, tick)
  stepLiquid(world, 'water', tick)
  stepLiquid(world, 'fuel', tick)
  burnFuel(world, tick)
  stepFans(world, tick)
  soakFromPuddles(world)
  shortSoakedDevices(world)
  stepElectric(world, tick)
  sparkWires(world, tick)
}
