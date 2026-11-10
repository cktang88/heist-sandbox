import { nightConditions } from '../../director/director'
import type { ConditionId } from '../../director/types'
import { everSeen } from '../../stealth/rating'
import type { World } from '../../world'
import type { Beat } from '../types'

/**
 * Everything the story is told from, as plain data: the beats in time order and the final numbers. The story is a
 * pure function of this, so the same heist always reads the same, and tests can write a heist by hand.
 */
export type HeistRecord = {
  site: string
  outcome: 'won' | 'dead' | 'playing'
  seconds: number
  beats: Beat[]
  conditions: ConditionId[]
  /** The briefing lines of tonight's conditions. */
  briefing: string[]
  carrying: boolean
  numbers: {
    seen: number
    seenBy: number
    alarms: number
    peakLevel: number
    knockedOut: number
    killed: number
    tied: number
    surrendered: number
    tilesDestroyed: number
    explosions: number
    shots: number
    collapses: number
    vehiclesLost: number
    maxFire: number
    closeCalls: number
    clues: number
  }
}

export function recordOf(world: World): HeistRecord {
  const tally = world.chronicle.tally
  return {
    site: world.name,
    outcome: world.status,
    seconds: world.clock,
    beats: [...world.chronicle.beats].sort((a, b) => a.t - b.t).map((beat) => ({ ...beat })),
    conditions: world.director.conditions.map((condition) => condition.id),
    briefing: nightConditions(world),
    carrying: world.player.hasLoot,
    numbers: {
      // A camera or a glimpse of the parachute counts as being seen, even if no guard ever looked him in the face.
      seen: Math.max(world.stats.timesSpotted, everSeen(world) ? 1 : 0),
      seenBy: tally.seenBy.size,
      alarms: tally.alarms,
      peakLevel: tally.peakLevel,
      knockedOut: tally.knockedOut,
      killed: world.guards.filter((guard) => guard.mode === 'dead').length,
      tied: tally.tiedUp,
      surrendered: tally.surrendered,
      tilesDestroyed: world.stats.tilesDestroyed,
      explosions: tally.explosions,
      shots: tally.shots,
      collapses: tally.collapses,
      vehiclesLost: tally.vehiclesLost,
      maxFire: tally.maxFire,
      closeCalls: tally.closeCalls,
      clues: world.intel.clues.length,
    },
  }
}
