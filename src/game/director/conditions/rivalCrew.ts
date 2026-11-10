import { note } from '../../chronicle/note'
import { emitNoise } from '../../noise'
import { feetOf, isActive } from '../../security/model'
import { playSound } from '../../sounds'
import { knockOutCold } from '../../stealth/bodies'
import { distance, type Vec } from '../../types'
import type { World } from '../../world'
import { pick, spotIn } from '../crew'
import type { ConditionDef } from '../types'

/**
 * A rival crew is inside too. Every so often, somewhere well away from the player, they make trouble: a noise that
 * draws guards, a camera cut, a guard knocked cold. It pulls attention away, and it puts the site on edge.
 */

const FIRST = 70
const GAP = 75
const INCIDENTS = 3
const FAR = 40
const NOISE_RADIUS = 14
const COLD_SECONDS = 40

type Incident = 'noise' | 'camera' | 'knockout'

export const rivalCrew: ConditionDef = {
  id: 'rivalCrew',
  fits: (site) => site === 'complex',
  excludes: [],
  start(_world, rng) {
    let next = FIRST + rng() * GAP
    let done = 0
    return {
      id: 'rivalCrew',
      line: 'A rival crew is inside tonight: expect trouble you did not start, somewhere else on site.',
      step(world: World, dt: number) {
        for (const victim of world.director.rivalVictims) if (!victim.out) world.director.rivalVictims.delete(victim)
        if (done >= INCIDENTS) return
        next -= dt
        if (next > 0) return
        next = GAP * (0.7 + rng() * 0.6)
        done += 1
        const kinds: Incident[] = ['noise', 'camera', 'knockout']
        strike(world, kinds[Math.floor(rng() * kinds.length)], rng)
      },
    }
  },
}

function strike(world: World, kind: Incident, rng: () => number): void {
  const player = feetOf(world.player)
  if (kind === 'camera') {
    const camera = pick(world.devices.filter((device) => device.kind === 'camera' && !device.disabled && distance(device, player) > FAR), rng)
    if (camera) {
      camera.disabled = true
      playSound(world, 'spark', { x: camera.x + 0.5, y: camera.y + 0.5 })
      note(world, 'event', { x: camera.x + 0.5, y: camera.y + 2 }, { detail: 'rivalCrew', outcome: 'cut a camera' })
      return
    }
  }
  if (kind === 'knockout') {
    const victim = pick(world.guards.filter((guard) => isActive(guard) && guard.mode === 'calm' && distance(feetOf(guard), player) > FAR), rng)
    if (victim) {
      // He drops like any man knocked cold, a body to be found, and comes round angry; it is not the player's tally.
      knockOutCold(world, victim, COLD_SECONDS, false)
      world.director.rivalVictims.add(victim)
      note(world, 'event', victim, { detail: 'rivalCrew', outcome: 'knocked out a guard' })
      return
    }
  }
  const room = pick(world.rooms.filter((candidate) => candidate.kind !== 'stairwell' && distance(spotIn(candidate), player) > FAR), rng)
  if (!room) return
  const at: Vec = spotIn(room, rng())
  emitNoise(world, { x: at.x, y: at.y - 1 }, NOISE_RADIUS)
  playSound(world, 'glass', at)
  note(world, 'event', at, { detail: 'rivalCrew', outcome: 'smashed something' })
}
