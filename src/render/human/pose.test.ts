import { describe, expect, it } from 'vitest'
import type { Vec } from '../../game/types'
import { advanceStride, BONES, HOLDS, poseHuman, type Limb, type Motion, type Skeleton } from './pose'

const STAND: Motion = { x: 10, feetY: 20, facing: 1, vx: 0, vy: 0, onGround: true, mode: 'normal', aim: 0, kick: 0, clock: 0 }
const gap = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y)
const limbs = (body: Skeleton): Limb[] => [...body.legs, ...body.arms]

/** Runs a body along the floor at a steady speed and returns each frame's skeleton. */
function walk(speed: number, frames: number, extra: Partial<Motion> = {}): Skeleton[] {
  const dt = 1 / 60
  let stride = 0
  let x = 10
  const out: Skeleton[] = []
  for (let frame = 0; frame < frames; frame += 1) {
    out.push(poseHuman({ ...STAND, ...extra, x, vx: speed, stride, clock: frame * dt }))
    x += speed * dt
    stride = advanceStride(stride, speed * dt, Math.abs(speed), extra.mode ?? 'normal')
  }
  return out
}

describe('poseHuman', () => {
  it('keeps every bone at its length and never locks a knee or elbow straight', () => {
    const bodies = [...walk(2.4, 90), ...walk(9, 90), ...walk(3, 60, { mode: 'crouch' }), poseHuman({ ...STAND, aim: -1.2 }), poseHuman({ ...STAND, onGround: false, vy: 8 })]
    for (const body of bodies) {
      body.legs.forEach((leg) => {
        expect(gap(leg.root, leg.joint)).toBeCloseTo(BONES.upperLeg, 3)
        expect(gap(leg.joint, leg.end)).toBeCloseTo(BONES.lowerLeg, 3)
      })
      body.arms.forEach((arm) => {
        expect(gap(arm.root, arm.joint)).toBeCloseTo(BONES.upperArm, 3)
        expect(gap(arm.joint, arm.end)).toBeCloseTo(BONES.forearm, 3)
      })
      for (const limb of limbs(body)) {
        const full = gap(limb.root, limb.joint) + gap(limb.joint, limb.end)
        expect(gap(limb.root, limb.end)).toBeLessThan(full * 0.99)
      }
    }
  })

  it('keeps a planted foot still while the body walks or runs over it', () => {
    for (const speed of [2.4, 6, 9]) {
      const bodies = walk(speed, 120)
      let planted = 0
      for (let frame = 1; frame < bodies.length; frame += 1) {
        for (const leg of [0, 1]) {
          const before = bodies[frame - 1].legs[leg].end
          const after = bodies[frame].legs[leg].end
          const onFloor = (foot: Vec) => Math.abs(foot.y - (STAND.feetY - BONES.ankle)) < 1e-6
          if (!onFloor(before) || !onFloor(after)) continue
          planted += 1
          expect(Math.abs(after.x - before.x)).toBeLessThan(1e-6)
        }
      }
      expect(planted).toBeGreaterThan(30)
    }
  })

  it('lifts each foot off the floor in turn when moving', () => {
    const lifted = walk(6, 60).map((body) => body.legs.map((leg) => leg.end.y < STAND.feetY - BONES.ankle - 0.05))
    expect(lifted.some(([near]) => near)).toBe(true)
    expect(lifted.some(([, far]) => far)).toBe(true)
  })

  it('bobs the hips through the stride', () => {
    const heights = walk(2.4, 60).map((body) => body.hip.y)
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(0.01)
  })

  it('points the gun along the aim and the support hand along the barrel', () => {
    for (const aim of [0, -0.8, 0.7, -Math.PI / 2 + 0.1]) {
      const body = poseHuman({ ...STAND, aim, held: 'rifle' })
      expect(Math.abs(body.gunAngle - aim)).toBeLessThan(0.01)
      const toSupport = Math.atan2(body.arms[1].end.y - body.grip.y, body.arms[1].end.x - body.grip.x)
      expect(Math.abs(toSupport - aim)).toBeLessThan(0.2)
      expect(gap(body.arms[1].end, body.grip)).toBeCloseTo(Math.hypot(HOLDS.rifle.support.x, HOLDS.rifle.support.y), 2)
    }
  })

  it('aims the same way when facing left', () => {
    const body = poseHuman({ ...STAND, facing: -1, aim: Math.PI - 0.3, held: 'shotgun' })
    expect(Math.abs(body.gunAngle - (Math.PI - 0.3))).toBeLessThan(0.01)
    expect(body.grip.x).toBeLessThan(body.shoulder.x)
  })

  it('carries the weapon low when calm and raises it when alert', () => {
    const calm = poseHuman({ ...STAND, alert: false, aim: 0 })
    const alert = poseHuman({ ...STAND, alert: true, aim: 0 })
    expect(Math.sin(calm.gunAngle)).toBeGreaterThan(0.7)
    expect(calm.grip.y).toBeGreaterThan(calm.hip.y - 0.1)
    expect(Math.abs(alert.gunAngle)).toBeLessThan(0.02)
    expect(alert.grip.y).toBeLessThan(alert.hip.y - 0.3)
  })

  it('kicks the gun up and the shoulders back on recoil', () => {
    const still = poseHuman({ ...STAND, held: 'rifle' })
    const fired = poseHuman({ ...STAND, held: 'rifle', kick: 1 })
    expect(fired.gunAngle).toBeLessThan(still.gunAngle - 0.1)
    expect(fired.shoulder.x).toBeLessThan(still.shoulder.x)
  })

  it('crouches low with the torso tipped forward', () => {
    const stand = poseHuman(STAND)
    const crouch = poseHuman({ ...STAND, mode: 'crouch' })
    expect(crouch.hip.y - stand.hip.y).toBeGreaterThan(0.2)
    expect(crouch.lean).toBeGreaterThan(stand.lean + 0.2)
  })

  it('squashes on landing and recoils from a hit', () => {
    const stand = poseHuman(STAND)
    expect(poseHuman({ ...STAND, land: 1 }).hip.y).toBeGreaterThan(stand.hip.y + 0.1)
    expect(poseHuman({ ...STAND, flinch: 1 }).lean).toBeLessThan(stand.lean - 0.1)
  })

  it('breathes: standing still is not frozen', () => {
    expect(poseHuman({ ...STAND, clock: 0 }).shoulder.y).not.toBeCloseTo(poseHuman({ ...STAND, clock: 1 }).shoulder.y, 4)
  })

  it('looks where the weapon points, within what a neck can turn on top of the spine', () => {
    expect(poseHuman({ ...STAND, aim: -0.4 }).look).toBeCloseTo(-0.4)
    const up = poseHuman({ ...STAND, aim: -1.5 })
    expect(up.lean).toBeLessThan(-0.2)
    expect(up.look).toBeGreaterThan(-0.75 + up.lean)
  })

  it('puts the rising foot higher on a staircase going up', () => {
    const body = poseHuman({ ...STAND, mode: 'stairs', vx: 5, vy: -4, stride: 0.1 })
    const [near, far] = body.legs.map((leg) => leg.end)
    const front = near.x > far.x ? near : far
    const back = near.x > far.x ? far : near
    expect(front.y).toBeLessThan(back.y)
  })

  it('climbs a ladder with planted hands on the rungs, back to the camera and the gun slung', () => {
    let planted = 0
    for (let step = 0; step < 40; step += 1) {
      const feetY = 30 - step * 0.05
      const body = poseHuman({ ...STAND, mode: 'ladder', onGround: false, feetY, x: 5 })
      expect(body.turn).toBe(1)
      expect(body.armed).toBe(false)
      for (const arm of body.arms) {
        const next = poseHuman({ ...STAND, mode: 'ladder', onGround: false, feetY: feetY - 0.01, x: 5 })
        const still = next.arms[body.arms.indexOf(arm)].end
        if (Math.abs(still.y - arm.end.y) > 1e-9) continue
        planted += 1
        const rung = ((arm.end.y % 0.5) + 0.5) % 0.5
        expect(rung).toBeCloseTo(0.25, 6)
      }
    }
    expect(planted).toBeGreaterThan(20)
  })

  it('reaches up to the risers under a parachute', () => {
    const body = poseHuman({ ...STAND, mode: 'chute', onGround: false, vy: 3 })
    expect(body.arms.every((arm) => arm.end.y < body.head.y)).toBe(true)
  })

  it('holds a throwable cocked back and points with the other hand', () => {
    const body = poseHuman({ ...STAND, held: 'flash', aim: -0.3 })
    expect(body.arms[0].end.y).toBeLessThan(body.shoulder.y)
    expect(body.arms[1].end.x).toBeGreaterThan(body.shoulder.x + 0.25)
  })
})

describe('advanceStride', () => {
  it('stays within one cycle and moves faster for longer distances', () => {
    const short = advanceStride(0.2, 0.1, 3, 'normal')
    const long = advanceStride(0.2, 0.3, 3, 'normal')
    expect(long).toBeGreaterThan(short)
    const wrapped = advanceStride(0.9, 5, 3, 'normal')
    expect(wrapped).toBeGreaterThanOrEqual(0)
    expect(wrapped).toBeLessThan(1)
  })
})
