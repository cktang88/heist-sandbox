import { burst } from '../effects'
import { emitNoise } from '../noise'
import type { Lamp } from '../site'
import { playSound } from '../sounds'
import type { Vec } from '../types'
import type { World } from '../world'
import { markLampShot } from './lampState'
import { makeTileIndex, tilesAround } from './tileIndex'

export { isLampShot } from './lampState'

/** A round passing this close to a bulb or tube smashes it. Generous, so aimed shots at a lamp connect. */
export const LAMP_HIT_RADIUS = 0.5
/** The pop of a bulb carries about as far as a breaker's clunk: guards in the room come to look. */
const LAMP_POP_NOISE = 5
const SPARK = '#ffd36b'
const SHARDS = '#d9eef5'

const lampsAt = makeTileIndex<Lamp>((lamp) => tilesAround(lamp, LAMP_HIT_RADIUS))

/** Smashes any lamp close to this point on a bullet's path. Bullets fly on through. */
export function shootLampsAt(world: World, at: Vec): void {
  for (const lamp of lampsAt(world.lamps, at.x, at.y)) {
    if (Math.hypot(lamp.x - at.x, lamp.y - at.y) > LAMP_HIT_RADIUS) continue
    if (!markLampShot(world, lamp)) continue
    burst(world.effects, world.rng, lamp, 10, SPARK, 7)
    burst(world.effects, world.rng, lamp, 6, SHARDS, 4)
    playSound(world, 'glass', lamp)
    emitNoise(world, lamp, LAMP_POP_NOISE)
  }
}
