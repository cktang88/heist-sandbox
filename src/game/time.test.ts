import { describe, expect, it } from 'vitest'
import { createPlayer, updateFocus } from './player'
import { createTime, stepTime, triggerSlowmo } from './time'

function run(time: ReturnType<typeof createTime>, seconds: number, focusing = false, acting = false): number {
  let scale = time.scale
  for (let elapsed = 0; elapsed < seconds; elapsed += 1 / 60) scale = stepTime(time, 1 / 60, focusing, acting)
  return scale
}

describe('slow motion', () => {
  it('runs at full speed by default', () => {
    expect(run(createTime(), 1)).toBeCloseTo(1)
  })

  it('slows more when the focusing player holds still than when they act', () => {
    const still = run(createTime(), 1, true, false)
    const acting = run(createTime(), 1, true, true)
    expect(still).toBeLessThan(acting)
    expect(acting).toBeLessThan(1)
  })

  it('bursts briefly and then recovers', () => {
    const time = createTime()
    triggerSlowmo(time, 0.5, 0.2)
    expect(run(time, 0.4)).toBeLessThan(0.4)
    expect(run(time, 1.5)).toBeGreaterThan(0.95)
  })

  it('ignores a second burst right after the first', () => {
    const time = createTime()
    triggerSlowmo(time, 0.3, 0.2)
    run(time, 1)
    triggerSlowmo(time, 0.3, 0.2)
    expect(time.burstLeft).toBe(0)
  })
})

describe('the focus meter', () => {
  it('runs dry while held, stays dry (no flickering slow motion) while still held, and refills once let go', () => {
    const player = createPlayer({ x: 0, y: 0 })
    for (let frame = 0; frame < 5 * 60; frame += 1) updateFocus(player, true, 1 / 60)
    expect(player.focus).toBe(0)
    let slowFrames = 0
    for (let frame = 0; frame < 120; frame += 1) if (updateFocus(player, true, 1 / 60)) slowFrames += 1
    expect(slowFrames).toBe(0)
    for (let frame = 0; frame < 60; frame += 1) updateFocus(player, false, 1 / 60)
    expect(player.focus).toBeGreaterThan(0.3)
    expect(updateFocus(player, true, 1 / 60)).toBe(true)
  })
})
