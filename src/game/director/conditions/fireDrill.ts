import { lastEvent, note } from '../../chronicle/note'
import { count } from '../../chronicle/story/choose'
import { feetOf, type Guard } from '../../security/model'
import { roomOf } from '../../security/places'
import { playSound } from '../../sounds'
import type { Vec } from '../../types'
import type { World } from '../../world'
import { clockText } from '../clockText'
import { idleGuards, nearestTo, onErrand, pick, release, sendTo } from '../crew'
import { evacuationPoint, unlockBuilding } from '../evacuate'
import { radio, say } from '../say'
import type { ConditionDef } from '../types'

/**
 * A fire drill at a set time: the bells ring in one building, its guards file out to the street and stand about for a
 * minute, and by fire code every door in it is unlocked (and stays so).
 */

const EARLIEST = 120
const SPREAD = 150
const DRILL_SECONDS = 55
const BUILDINGS = ['quarters', 'depot', 'tower']

export const fireDrill: ConditionDef = {
  id: 'fireDrill',
  fits: (site) => site === 'complex',
  excludes: [],
  start(world, rng) {
    const at = Math.round(EARLIEST + rng() * SPREAD)
    const building = pick(BUILDINGS.filter((name) => world.rooms.some((room) => room.building === name)), rng) ?? 'tower'
    let phase: 'waiting' | 'drill' | 'over' = 'waiting'
    let walkers: { guard: Guard; spot: Vec }[] = []
    return {
      id: 'fireDrill',
      line: `Fire drill at ${clockText(at)}: the ${building} empties onto the street for a minute and its doors unlock.`,
      step(stepWorld: World) {
        if (phase === 'waiting' && stepWorld.clock >= at) {
          phase = 'drill'
          const out = evacuationPoint(stepWorld, building)
          unlockBuilding(stepWorld, building)
          walkers = idleGuards(stepWorld).filter((guard) => roomOf(stepWorld, feetOf(guard))?.building === building)
            .map((guard, index) => ({ guard, spot: { x: out.x + (index % 7) - 3, y: out.y } }))
          for (const walker of walkers) sendTo(walker.guard, walker.spot)
          playSound(stepWorld, 'alarm', out)
          radio(stepWorld, `Control: Fire drill in the ${building}. Everybody out, no exceptions.`)
          const near = nearestTo(walkers.map((walker) => walker.guard), stepWorld.player, feetOf)
          if (near) say(stepWorld, near, 'Not another drill...')
          note(stepWorld, 'event', out, { detail: 'fireDrill' })
        } else if (phase === 'drill' && stepWorld.clock >= at + DRILL_SECONDS) {
          phase = 'over'
          const stayed = walkers.filter((walker) => onErrand(walker.guard, walker.spot)).length
          for (const walker of walkers) release(walker.guard, walker.spot)
          radio(stepWorld, `Control: Drill's over. Back inside.`)
          const beat = lastEvent(stepWorld, 'fireDrill')
          if (beat) beat.outcome = stayed === 0 ? 'nobody was out there by the end of it' : `${count(stayed, 'guard')} stood about on the street`
        }
      },
    }
  },
}
