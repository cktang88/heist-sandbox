import { Group, PointLight } from 'three'
import type { Vec } from '../game/types'
import type { World } from '../game/world'
import { inAlarm } from './lighting/brightness'
import { createSkyLights } from './lighting/daylight'
import { createEventLights } from './lighting/events'
import { createGuardLights } from './lighting/guardLights'
import { createLampLights } from './lighting/lampLights'

/**
 * Real lights are expensive: every one is evaluated for every lit pixel, and changing how many there are rebuilds
 * every material. So the scene has a fixed set, handed each frame to whatever matters most near the view, and every
 * other lit lamp is faked with its glowing fitting and a soft pool of light on the wall behind it.
 *
 * The whole set: the sun or moon and a sky fill; 6 lamp spots (3 with shadow maps) and 6 lamp points
 * (lamp lights); 3 guard torches; 4 points for flashes, explosions, fires and flashbangs; a faint fill at the
 * player. That is 9 spots and 11 points, about what the original 17 punctual lights cost, spent more wisely.
 */
export type LightRig = { group: Group; update(world: World, view: Vec): void }

export { lampIsLit } from '../game/light'
export { applyAtmosphere } from './lighting/daylight'

/** Longest step a fade may take at once, in seconds of game time: a skipped-ahead game settles at once. */
const MAX_FADE_STEP = 0.5

export function createLights(): LightRig {
  const group = new Group()
  const sky = createSkyLights(group)
  const lamps = createLampLights(group)
  const guards = createGuardLights(group)
  const events = createEventLights(group)
  // Keeps the player readable even in a dark room.
  const playerFill = new PointLight(0xa8c4ff, 2.2, 6, 1.8)
  group.add(playerFill)
  let lastClock = 0

  return {
    group,
    update(world, view) {
      // Fades run on game time, so they pause with the game and slow down in slow motion.
      const dt = Math.min(MAX_FADE_STEP, Math.max(0, world.clock - lastClock))
      lastClock = world.clock
      const alarm = inAlarm(world)
      const daylight = sky.update(world.timeOfDay, view, alarm)
      lamps.update(world, view, dt, alarm, daylight.outdoorGlow)
      guards.update(world, view)
      events.update(world, view)
      playerFill.position.set(world.player.x + world.player.w / 2, -(world.player.y + world.player.h / 2), 1.6)
    },
  }
}
