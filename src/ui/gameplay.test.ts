import { describe, expect, it } from 'vitest'
import { createTime, hitPause, stepTime, triggerSlowmo } from '../game/time'
import { applyGameplay } from './gameplay'

describe('gameplay settings', () => {
  it('leave shake and slow motion alone when both are on', () => {
    const world = { time: createTime(), shake: 0.5 }
    triggerSlowmo(world.time, 1, 0.3)
    applyGameplay(world, { shake: true, autoSlowmo: true })
    expect(world.shake).toBe(0.5)
    expect(stepTime(world.time, 1 / 60, false, false)).toBeLessThan(1)
  })

  it('turning shake off removes it', () => {
    const world = { time: createTime(), shake: 0.5 }
    applyGameplay(world, { shake: false, autoSlowmo: true })
    expect(world.shake).toBe(0)
  })

  it('turning automatic slow motion off cancels bursts and hit pauses but keeps Shift focus', () => {
    const world = { time: createTime(), shake: 0 }
    triggerSlowmo(world.time, 1, 0.3)
    hitPause(world.time, 0.1)
    applyGameplay(world, { shake: true, autoSlowmo: false })
    expect(stepTime(world.time, 1 / 60, false, false)).toBe(1)
    expect(stepTime(world.time, 1 / 60, true, false)).toBeLessThan(1)
  })
})
