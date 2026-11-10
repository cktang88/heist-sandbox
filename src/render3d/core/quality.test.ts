import { describe, expect, it } from 'vitest'
import { createQualityController, LADDER, LOW_DETAIL } from './quality'

function run(controller: ReturnType<typeof createQualityController>, ms: number, frames: number): number {
  let level = controller.level
  for (let frame = 0; frame < frames; frame += 1) level = controller.frame(ms)
  return level
}

describe('quality ladder', () => {
  it('steps down while frames are slow, one rung at a time', () => {
    const controller = createQualityController(0, false)
    expect(run(controller, 30, 80)).toBe(1)
    expect(run(controller, 30, 1000)).toBe(LADDER.length - 1)
  })

  it('climbs back only after a long run of fast frames', () => {
    const controller = createQualityController(3, false)
    expect(run(controller, 8, 100)).toBe(3)
    expect(run(controller, 8, 400)).toBeLessThan(3)
  })

  it('holds steady inside the comfortable band', () => {
    const controller = createQualityController(2, false)
    expect(run(controller, 17, 2000)).toBe(2)
  })

  it('never brings shadows back once it has dropped them', () => {
    const controller = createQualityController(LADDER.length - 2, false)
    run(controller, 40, 200)
    expect(LADDER[controller.level].shadows).toBe(false)
    expect(LADDER[run(controller, 5, 5000)].shadows).toBe(false)
  })

  it('stays on a pinned rung and ignores long pauses', () => {
    const pinned = createQualityController(LOW_DETAIL, true)
    expect(run(pinned, 5, 1000)).toBe(LOW_DETAIL)
    const free = createQualityController(0, false)
    expect(run(free, 1000, 500)).toBe(0)
  })
})
