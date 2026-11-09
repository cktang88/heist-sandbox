import { describe, expect, it } from 'vitest'
import { solveJoint } from './ik'

describe('solveJoint', () => {
  it('keeps both bones at their set lengths', () => {
    const root = { x: 0, y: 0 }
    const target = { x: 0.3, y: 0.6 }
    const knee = solveJoint(root, target, 0.4, 0.38, 1)
    expect(Math.hypot(knee.x, knee.y)).toBeCloseTo(0.4)
    expect(Math.hypot(target.x - knee.x, target.y - knee.y)).toBeCloseTo(0.38)
  })

  it('bends the opposite way when asked', () => {
    const one = solveJoint({ x: 0, y: 0 }, { x: 0, y: 0.6 }, 0.4, 0.38, 1)
    const other = solveJoint({ x: 0, y: 0 }, { x: 0, y: 0.6 }, 0.4, 0.38, -1)
    expect(Math.sign(one.x)).toBe(-Math.sign(other.x))
  })

  it('copes with a target that is out of reach', () => {
    const knee = solveJoint({ x: 0, y: 0 }, { x: 5, y: 0 }, 0.4, 0.38, 1)
    expect(Number.isFinite(knee.x) && Number.isFinite(knee.y)).toBe(true)
  })
})
