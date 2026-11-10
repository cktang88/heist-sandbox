import { indexDevices } from './ballistics/devices'
import { indexLamps } from './ballistics/lamps'
import { prepareCollapse } from './collapse'
import { indexCover } from './cover'
import { propsAt } from './hazards/props'
import { indexLampLight } from './light'
import { planStairs } from './nav'
import { indexCoverSpots } from './security/coverSpots'
import { indexDoors } from './security/discoveries'
import { indexPanes } from './security/intrusions'
import { forgetAllChanges } from './tiles'
import { prepareFallingProps } from './vehicles/fallingProps'
import type { World } from './world'

/**
 * Builds, while the site loads, the lookup tables systems otherwise build the first time they need them (props by
 * tile, cover, lamps, staircase plans, the falling-props copy of the grid, the doors and panes as built), and checks
 * once that the whole site stands. Without this the first frames of play pay for all of it at once.
 */
export function prepareWorld(world: World): void {
  // Building the site set every tile; play reacts only to what changes from here on.
  forgetAllChanges(world.grid)
  propsAt(world, 0, 0)
  indexCover(world)
  indexCoverSpots(world)
  indexLamps(world)
  indexLampLight(world)
  indexDevices(world)
  indexDoors(world)
  indexPanes(world)
  planStairs(world.stairwells)
  prepareFallingProps(world)
  prepareCollapse(world)
}
