import type { World } from '../world'
import { stepAwakeTied } from './carry'
import { stepDarts } from './dart'
import { stepSpots, stepWatched } from './hide'
import { stepNoisemakers } from './noisemakers'
import { stepRigged } from './sabotage'
import { openSpot } from './search'

/**
 * The stealth toolkit's clockwork, once a frame after the guards have moved: darts taking effect, rigged breakers
 * tripping, machines left blaring, and guards reaching a hiding place they saw the player get into. The player's
 * own stealth keys run earlier, with the other hands-on actions (controls.ts, from interact.ts).
 */
export function stepStealth(world: World): void {
  stepDarts(world)
  stepRigged(world)
  stepNoisemakers(world)
  stepWatched(world, (guard, prop) => openSpot(world, guard, prop))
  stepSpots(world)
  stepAwakeTied(world)
  if (world.security.level >= 3 && !alarmCounted.has(world)) {
    alarmCounted.add(world)
    world.stats.alarms += 1
  } else if (world.security.level < 3) alarmCounted.delete(world)
}

/** Heists whose current alarm has been counted, so each time the site goes to level 3 counts once. */
const alarmCounted = new WeakSet<World>()
