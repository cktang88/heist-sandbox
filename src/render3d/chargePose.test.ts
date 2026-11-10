import { describe, expect, it } from 'vitest'
import type { Charge } from '../game/charges'
import { chargePose } from './chargePose'
import { BACK } from './levelMesh'

const charge = (stuck: Charge['stuck'], face?: { x: number; y: number }): Charge =>
  ({ x: 10.8, y: 20.8, w: 0.4, h: 0.4, vx: 0, vy: 0, onGround: false, fuse: null, stuck, face })

describe('chargePose', () => {
  it('puts a charge pressed on the back wall against that wall, not in the walking lane', () => {
    const pose = chargePose(charge('backWall', { x: 0, y: 0 }))
    expect(pose.z - pose.sz / 2).toBeGreaterThan(BACK)
    expect(pose.z - pose.sz / 2).toBeLessThan(BACK + 0.1)
  })

  it('lays a charge on a side wall flat against the wall face, light outward', () => {
    // Stuck to a wall on its left (face points right, away from the wall at x = 10.8).
    const pose = chargePose(charge({ x: 10, y: 21 }, { x: 1, y: 0 }))
    expect(pose.x - pose.sx / 2).toBeCloseTo(10.8)
    expect(pose.sx).toBeLessThan(pose.sy)
    expect(pose.light.x).toBeGreaterThan(pose.x)
  })

  it('hangs a charge from a ceiling, flat against it', () => {
    // Ceiling above at y = 20.8 (game, y down), so the block's top in 3D is at -20.8.
    const pose = chargePose(charge({ x: 11, y: 20 }, { x: 0, y: 1 }))
    expect(pose.y + pose.sy / 2).toBeCloseTo(-20.8)
    expect(pose.sy).toBeLessThan(pose.sx)
    expect(pose.light.y).toBeLessThan(pose.y)
  })

  it('ignores a stale face once the charge has come loose', () => {
    const pose = chargePose(charge(null, { x: 1, y: 0 }))
    expect(pose.x).toBeCloseTo(11)
    expect(pose.y).toBeCloseTo(-21)
  })
})
