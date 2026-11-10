import { Group } from 'three'
import { buildElevator } from './devices/structure/elevator'
import { buildStairwell } from './devices/structure/stairs'
import { DRAW_DISTANCE, type LayerFactory } from './layer'

/**
 * Staircases and elevators. Stairs are static, built once per stairwell as a few merged meshes;
 * elevators move their car and doors every frame, but only the stops near the view are drawn.
 */
export const createStructureLayer: LayerFactory = (world, materials) => {
  const group = new Group()
  const stairs = world.stairwells.map((well) => {
    const mesh = buildStairwell(well, world.groundY, materials.concrete)
    group.add(mesh)
    return { mesh, left: Math.min(well.leftX, well.rightX), right: Math.max(well.leftX, well.rightX) }
  })
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
