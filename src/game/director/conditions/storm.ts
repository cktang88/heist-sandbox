import { note } from '../../chronicle/note'
import { deviceCenter } from '../../devices/power'
import { floorName } from '../../security/places'
import { playSound } from '../../sounds'
import type { World } from '../../world'
import { pick } from '../crew'
import { fuseBoxOf, killCircuit, siteCircuits } from '../power'
import { radio } from '../say'
import type { ConditionDef } from '../types'
import { startRain } from './rain'

/**
 * A thunderstorm: the rain, plus lightning. Each flash lights the sky for a moment (the view reads `lightningAt`) and
 * the thunder rolls; now and then a strike knocks out a lighting circuit, which the guards then have to go and fix.
 */

const STRIKE_MIN = 22
const STRIKE_SPREAD = 38
const KNOCKOUT_ODDS = 0.35
const FAR_STRIKE = 40

export const storm: ConditionDef = {
  id: 'storm',
  fits: () => true,
  excludes: ['rain'],
  start(world, rng) {
    const wet = startRain(world, rng, 'Thunderstorm: rain covers your footsteps outside, lightning lights you up, and a strike can kill the lights.')
    let nextStrike = STRIKE_MIN * 0.5 + rng() * STRIKE_SPREAD
    return {
      id: 'storm',
      line: wet.line,
      step(stepWorld, dt) {
        wet.step?.(stepWorld, dt)
        nextStrike -= dt
        if (nextStrike > 0) return
        nextStrike = STRIKE_MIN + rng() * STRIKE_SPREAD
        strike(stepWorld, rng() < KNOCKOUT_ODDS ? pick(siteCircuits(stepWorld), rng) : null, rng())
      },
    }
  },
}

function strike(world: World, circuit: number | null, offset: number): void {
  world.director.lightningAt = world.clock
  const x = Math.max(0, Math.min(world.grid.width - 1, world.player.x + (offset - 0.5) * 2 * FAR_STRIKE))
  playSound(world, Math.abs(x - world.player.x) < FAR_STRIKE / 2 ? 'explosion' : 'collapse', { x, y: 0 })
  if (circuit === null || !killCircuit(world, circuit, false)) return
  const box = fuseBoxOf(world, circuit)
  const at = box ? deviceCenter(box) : { x, y: world.groundY }
  playSound(world, 'spark', at)
  radio(world, `Control: Lightning's knocked out a breaker on ${floorName(world, at)}.`)
  note(world, 'event', { x: at.x, y: at.y + 1 }, { detail: 'lightning', outcome: 'knocked out the lights' })
}
