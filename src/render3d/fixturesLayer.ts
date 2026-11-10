import { Group } from 'three'
import { lampIsLit } from '../game/light'
import { inView, type LayerFactory } from './layer'
import { buildLamp, LAMP_OFF, LAMP_ON } from './props3d'

/** The light fittings themselves: the bulb glows while its lamp is lit. */
export const createFixturesLayer: LayerFactory = (world) => {
  const group = new Group()
  const fittings = world.lamps.map((lamp) => {
    const built = buildLamp(lamp)
    built.group.position.set(lamp.x, -lamp.y, 0)
    group.add(built.group)
    return { lamp, model: built.group, bulb: built.bulb }
  })
  return {
    group,
    update(now, frame) {
      for (const { lamp, model, bulb } of fittings) {
        model.visible = inView(frame, lamp.x, lamp.y, 8)
        if (model.visible) bulb.material = lampIsLit(now, lamp) ? LAMP_ON : LAMP_OFF
      }
    },
  }
}
