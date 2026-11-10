import { Group } from 'three'
import { buildElevator } from './devices/structure/elevator'
import { buildStairwell } from './devices/structure/stairs'
import type { World } from '../game/world'
import { DRAW_DISTANCE, type LayerFactory } from './layer'

/**
 * Staircases and elevators. Stairs are static, built once per stairwell as a few merged meshes;
 * elevators move their car and doors every frame, but only the stops near the view are drawn.
 */
export const createStructureLayer: LayerFactory = (world, materials) => {
  const group = new Group()
  const buildStairs = (wells: World['stairwells']) => wells.map((well) => {
    const mesh = buildStairwell(well, world.groundY, materials.concrete)
    group.add(mesh)
    return { mesh, left: Math.min(well.leftX, well.rightX), right: Math.max(well.leftX, well.rightX) }
  })
  let builtFrom = world.stairwells
  let stairs = buildStairs(builtFrom)
  const elevators = world.elevators.map((shaft) => {
    const rig = buildElevator(shaft)
    group.add(rig.group)
    return { shaft, rig }
  })

  return {
    group,
    update(now, frame) {
      const reachX = DRAW_DISTANCE + 4
      const reachY = DRAW_DISTANCE * 0.62 + 6
      // The list is replaced whenever a flight is blown away, so the meshes are rebuilt to match.
      if (now.stairwells !== builtFrom) {
        for (const stair of stairs) group.remove(stair.mesh)
        builtFrom = now.stairwells
        stairs = buildStairs(builtFrom)
      }
      for (const stair of stairs) stair.mesh.visible = stair.right > frame.view.x - reachX && stair.left < frame.view.x + reachX
      const near = (y: number) => Math.abs(y - frame.view.y) < reachY
      for (const { shaft, rig } of elevators) {
        rig.group.visible = Math.abs(shaft.x - frame.view.x) < reachX
        if (!rig.group.visible) continue
        rig.update(now.elevatorCars.find((car) => car.shaft === shaft.id), now.groundY, near, frame.dt)
      }
    },
  }
}
