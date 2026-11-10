import { Group } from 'three'
import { propSpec } from '../game/propCatalog'
import { isSolidAt } from '../game/tiles'
import { BACK } from './levelMesh'
import { inView, type LayerFactory } from './layer'
import { buildProp } from './props'

/** Furniture and clutter. Floor props vanish once the floor under them is gone; broken props are hidden. */
export const createPropsLayer: LayerFactory = (world, materials) => {
  const group = new Group()
  const entries = world.props.map((prop) => {
    const spec = propSpec(prop.kind)
    const model = buildProp(prop.kind, materials)
    if (spec.mount === 'floor') model.position.set(prop.x + 0.5, -prop.y, 0)
    else model.position.set(prop.x + 0.5, -prop.y, spec.mount === 'wall' ? BACK + 0.02 : -0.9)
    // Wall items carry lettering (posters, signs, screens), which must not be mirrored.
    if (prop.flip && spec.mount !== 'wall') model.scale.x = -1
    group.add(model)
    return { prop, model, onFloor: spec.mount === 'floor' }
  })
  return {
    group,
    update(now, frame) {
      for (const { prop, model, onFloor } of entries) {
        model.visible = !prop.broken && inView(frame, prop.x, prop.y, 6) && (!onFloor || isSolidAt(now.grid, prop.x, prop.y))
      }
    },
  }
}
