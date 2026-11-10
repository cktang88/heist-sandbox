import { describe, expect, it } from 'vitest'
import { fillTiles } from '../tiles'
import type { World } from '../world'
import { addGuard, arena, GROUND, putPlayer, run } from '../security/testArena'

/**
 * What a stealth player can count on, measured on a plain indoor floor with one calm guard facing the player:
 * how long until he notices ("Huh?") and until he is sure, by distance, light and posture. These pin down the
 * tuning (security/tuning.ts): darkness and crouching hide, full light and running do not, and a glance is a step
 * up, not an instant alarm.
 */

type Light = 'lit' | 'dim' | 'dark'
type Posture = 'standing' | 'crouched' | 'crouch-walking'

/** An indoor floor under a ceiling; 'lit' and 'dim' hang a row of lamps, of full and of low strength. */
function floor(light: Light): World {
  const world = arena()
  fillTiles(world.grid, 0, GROUND - 6, 110, GROUND - 6, 'concrete')
  world.interiors.push({ kind: 'room', x: 0, y: GROUND - 5, w: 110, h: 5 })
  const strength = light === 'lit' ? 1 : 0.32
  if (light !== 'dark') for (let x = 4; x < 110; x += 6) world.lamps.push({ x, y: GROUND - 4.8, fixture: 'ceilingPanel', color: 0xffffff, radius: 9, strength, hung: false })
  return world
}

/** Seconds until the guard notices and until he identifies the player, or Infinity within the time allowed. */
function watch(light: Light, posture: Posture, gap: number, seconds = 6): { notice: number; identify: number } {
  const world = floor(light)
  const guard = addGuard(world, 20, 1)
  putPlayer(world, 20.5 + gap)
  let notice = Infinity
  let identify = Infinity
  const walking = posture === 'crouch-walking'
  run(world, seconds, { crouch: posture !== 'standing', right: walking }, () => {
    // Walking on the spot: kept at the same distance so only posture and light change between rows.
    if (walking) world.player.x = 20.5 + gap - world.player.w / 2
    if (notice === Infinity && guard.awareness >= 0.3) notice = world.clock
    if (guard.mode === 'combat') {
      identify = world.clock
      return true
    }
  })
  return { notice, identify }
}

describe('stealth measures', () => {
  it('prints the detection table for the report', () => {
    for (const light of ['lit', 'dim', 'dark'] as const) {
      for (const posture of ['standing', 'crouched', 'crouch-walking'] as const) {
        const cells = [2, 4, 7, 10].map((gap) => {
          const { notice, identify } = watch(light, posture, gap)
          return `${gap}t ${Number.isFinite(notice) ? notice.toFixed(1) : '-'}/${Number.isFinite(identify) ? identify.toFixed(1) : '-'}`
        })
        console.log(`${light.padEnd(4)} ${posture.padEnd(14)} ${cells.join('  ')}`)
      }
    }
  })

  it('in full light, a standing player in front of a guard is identified within about three seconds at ten tiles', () => {
    expect(watch('lit', 'standing', 10).identify).toBeLessThan(3.2)
  })

  it('in the dark, a crouched player two tiles in front of a guard is never made out', () => {
    expect(watch('dark', 'crouched', 2).notice).toBe(Infinity)
  })

  it('in dim light, a crouched player keeping still at seven tiles has seconds to slip away before the guard is sure', () => {
    const { notice, identify } = watch('dim', 'crouched', 7)
    expect(identify - notice).toBeGreaterThan(2.5)
  })

  it('in dim light, a crouched player close in front of a guard (two tiles) is never identified while he keeps still', () => {
    expect(watch('dim', 'crouched', 2).identify).toBe(Infinity)
  })

  it('a glimpse is a step, not an alarm: a crouched player in dim light at four tiles is noticed well before he is identified', () => {
    const { notice, identify } = watch('dim', 'crouch-walking', 4)
    expect(notice).toBeLessThan(identify)
    expect(identify - notice).toBeGreaterThan(1)
  })
})
