import { describe, expect, it } from 'vitest'
import { powerKnockback } from './powerEffects'
import { distanceToSegment, isPointInPowerLane, resolvePowerLine } from './powerTargeting'

describe('oriented power targeting', () => {
  it('measures distance to the middle and rounded ends of a segment', () => {
    expect(distanceToSegment({ x: 2, z: 1 }, { x: 0, z: 0 }, { x: 4, z: 0 })).toBeCloseTo(1)
    expect(distanceToSegment({ x: -1, z: 0 }, { x: 0, z: 0 }, { x: 4, z: 0 })).toBeCloseTo(1)
  })

  it('supports horizontal, vertical, and diagonal finite lanes', () => {
    expect(isPointInPowerLane({ x: 0, z: 1 }, { x: 0, z: -2 }, { x: 0, z: 2 }, 0.3)).toBe(true)
    expect(isPointInPowerLane({ x: 1, z: 1 }, { x: 0, z: 0 }, { x: 2, z: 2 }, 0.1)).toBe(true)
    expect(isPointInPowerLane({ x: 2, z: 0 }, { x: 0, z: 0 }, { x: 0, z: 2 }, 0.3)).toBe(false)
  })

  it('turns a click into the legacy full-width horizontal lane', () => {
    expect(resolvePowerLine({ x: 2, z: 3 }, { x: 2.1, z: 3 }, 20)).toEqual({
      start: { x: -10, z: 3 }, end: { x: 10, z: 3 },
    })
  })

  it('keeps a deliberate drag unchanged', () => {
    const start = { x: -2, z: -1 }
    const end = { x: 3, z: 4 }
    expect(resolvePowerLine(start, end, 20)).toEqual({ start, end })
  })

  it('pushes a strafe target perpendicular to an oriented lane', () => {
    const displacement = powerKnockback('strafe', { id: 2, kind: 'grunt', x: 1, z: 0.2 }, { x: 0, z: 0 }, 1, { x: 2, z: 0 })
    expect(displacement.x).toBeCloseTo(0)
    expect(displacement.z).toBeCloseTo(0.16)
  })
})
