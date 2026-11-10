import { describe, expect, it } from 'vitest'
import type { Vec } from '../../game/types'
import { captiveNeck, draggedCollar, stackShoulder, type Act } from './acts'
import { BONES, poseHuman, type Motion, type Skeleton } from './pose'
import { ARM_REACH } from './rig'

const STAND: Motion = { x: 10, feetY: 20, facing: 1, vx: 0, vy: 0, onGround: true, mode: 'normal', aim: 0, kick: 0, clock: 0.7 }
const FLOOR = STAND.feetY - BONES.ankle
const gap = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y)
const posed = (act: Act, extra: Partial<Motion> = {}): Skeleton => poseHuman({ ...STAND, ...extra, act })

/** One of every act, facing both ways, with the extra motion each needs. */
const SAMPLES: [Act, Partial<Motion>][] = [
  [{ kind: 'hang', line: { x: 12, y: 14 }, reel: 1 }, { onGround: false, vx: 4 }],
  [{ kind: 'rope', x: 10.2 }, { mode: 'ladder' }],
  [{ kind: 'vault', t: 0.5, edge: { x: 10.6, y: 19 } }, {}],
  [{ kind: 'punch', t: 0.08 }, {}],
  [{ kind: 'kick', t: 0.13 }, {}],
  [{ kind: 'drag', grip: { x: 10.7, y: 19.1 } }, { vx: 2 }],
  [{ kind: 'hostage', neck: captiveNeck({ x: 10.55, y: 20 }, 1) }, {}],
  [{ kind: 'captive' }, { held: null }],
  [{ kind: 'throw', t: 0.1 }, { held: 'frag', aim: -0.5 }],
  [{ kind: 'plant', t: 0.15, at: { x: 10.9, y: 19.7 } }, { held: 'c4' }],
  [{ kind: 'work', at: { x: 10.6, y: 19.1 }, how: 'kneel' }, {}],
  [{ kind: 'work', at: { x: 10.6, y: 19 }, how: 'hunch' }, {}],
  [{ kind: 'work', at: { x: 10.6, y: 17.4 }, how: 'reach' }, {}],
  [{ kind: 'slide' }, { vx: 7, mode: 'crouch' }],
  [{ kind: 'surrender' }, { held: null }],
  [{ kind: 'restrained' }, { held: null }],
  [{ kind: 'cower' }, { held: null }],
  [{ kind: 'blindFire' }, { mode: 'crouch', aim: -0.2 }],
  [{ kind: 'duck' }, { mode: 'crouch', held: 'rifle' }],
  [{ kind: 'reload', t: 0.4 }, { held: 'rifle' }],
  [{ kind: 'dive', t: 0.1 }, { onGround: false }],
  [{ kind: 'dive', t: 0.6 }, {}],
  [{ kind: 'dive', t: 0.95 }, {}],
  [{ kind: 'blinded', how: 'wild' }, {}],
  [{ kind: 'blinded', how: 'stumble' }, {}],
  [{ kind: 'blinded', how: 'cover' }, {}],
  [{ kind: 'dragged', byX: 9.2 }, { held: null }],
  [{ kind: 'dragging', at: draggedCollar({ x: 10.8, y: 20 }, 10) }, { vx: -1.5 }],
  [{ kind: 'shield' }, { mode: 'crouch' }],
  [{ kind: 'stack', at: stackShoulder({ x: 10.7, y: 20 }, 1) }, { mode: 'crouch', held: 'rifle' }],
  [{ kind: 'radio' }, { alert: false }],
  [{ kind: 'torch' }, {}],
  [{ kind: 'scan' }, { alert: false }],
]

const points = (body: Skeleton): Vec[] => [
  body.hip, body.shoulder, body.head, body.grip, ...[...body.legs, ...body.arms].flatMap((limb) => [limb.root, limb.joint, limb.end]),
]

describe('acts', () => {
  it('keeps every bone at its length with no NaN in any pose, facing either way', () => {
    for (const [act, extra] of SAMPLES) {
      for (const facing of [1, -1] as const) {
        const body = posed(act, { ...extra, facing })
        for (const point of points(body)) expect(Number.isFinite(point.x) && Number.isFinite(point.y), act.kind).toBe(true)
        expect(Number.isFinite(body.lean + body.look + body.gunAngle + body.hands[0] + body.hands[1] + body.feet[0] + body.feet[1])).toBe(true)
        for (const leg of body.legs) {
          expect(gap(leg.root, leg.joint), act.kind).toBeCloseTo(BONES.upperLeg, 3)
          expect(gap(leg.joint, leg.end), act.kind).toBeCloseTo(BONES.lowerLeg, 3)
        }
        for (const arm of body.arms) {
          expect(gap(arm.root, arm.joint), act.kind).toBeCloseTo(BONES.upperArm, 3)
          expect(gap(arm.joint, arm.end), act.kind).toBeCloseTo(BONES.forearm, 3)
        }
        // No body part sinks into the floor.
        for (const point of points(body)) expect(point.y, act.kind).toBeLessThanOrEqual(STAND.feetY + 1e-6)
      }
    }
  })

  it('keeps the feet on the floor for poses done standing or kneeling', () => {
    const grounded: Act['kind'][] = ['punch', 'drag', 'hostage', 'captive', 'surrender', 'cower', 'reload', 'radio', 'torch', 'scan', 'shield', 'stack']
    for (const [act, extra] of SAMPLES.filter(([sample]) => grounded.includes(sample.kind))) {
      const body = posed(act, { ...extra, vx: 0 })
      for (const leg of body.legs) expect(leg.end.y, act.kind).toBeCloseTo(FLOOR, 2)
    }
    const kick = posed({ kind: 'kick', t: 0.13 })
    expect(kick.legs[1].end.y).toBeCloseTo(FLOOR, 2)
    expect(kick.legs[0].end.y).toBeLessThan(FLOOR - 0.6)
    expect(kick.legs[0].end.x).toBeGreaterThan(kick.hip.x + 0.5)
    for (const how of ['kneel'] as const) {
      const body = posed({ kind: 'work', at: { x: 10.6, y: 19.1 }, how })
      expect(Math.max(...body.legs.map((leg) => leg.joint.y))).toBeGreaterThan(FLOOR - 0.15)
    }
  })

  it('puts the hands where the act says: the line, the prop, the captive, the collar, the shoulder in front', () => {
    const line = { x: 12, y: 14 }
    const hang = posed({ kind: 'hang', line, reel: 0 }, { onGround: false, held: 'rifle' })
    for (const arm of hang.arms) {
      const toLine = Math.atan2(line.y - arm.root.y, line.x - arm.root.x)
      const toHand = Math.atan2(arm.end.y - arm.root.y, arm.end.x - arm.root.x)
      expect(Math.abs(toLine - toHand)).toBeLessThan(0.02)
    }
    expect(hang.armed).toBe(false)
    const aimed = posed({ kind: 'hang', line, reel: 0 }, { onGround: false, held: 'pistol', aim: 0.3 })
    expect(aimed.armed).toBe(true)
    expect(Math.abs(aimed.gunAngle - 0.3)).toBeLessThan(0.2)

    const reachable: [Act, Vec, number][] = [
      [{ kind: 'drag', grip: { x: 10.7, y: 19.1 } }, { x: 10.7, y: 19.1 }, 0],
      [{ kind: 'hostage', neck: captiveNeck({ x: 10.55, y: 20 }, 1) }, captiveNeck({ x: 10.55, y: 20 }, 1), 1],
      [{ kind: 'dragging', at: draggedCollar({ x: 10.8, y: 20 }, 10) }, draggedCollar({ x: 10.8, y: 20 }, 10), 0],
      [{ kind: 'stack', at: stackShoulder({ x: 10.7, y: 20 }, 1) }, stackShoulder({ x: 10.7, y: 20 }, 1), 1],
      [{ kind: 'work', at: { x: 10.6, y: 19 }, how: 'hunch' }, { x: 10.6, y: 19 }, 0],
    ]
    for (const [act, target, arm] of reachable) {
      const body = posed(act, act.kind === 'stack' ? { mode: 'crouch', held: 'rifle' } : {})
      expect(gap(body.arms[arm].end, target), act.kind).toBeLessThan(0.06)
    }
  })

  it('reaches a thrown arm out along the aim at release', () => {
    const body = posed({ kind: 'throw', t: 0.1 }, { held: 'frag', aim: -0.5 })
    const arm = body.arms[0]
    expect(gap(arm.root, arm.end)).toBeGreaterThan(ARM_REACH * 0.85)
    expect(Math.abs(Math.atan2(arm.end.y - arm.root.y, arm.end.x - arm.root.x) + 0.5)).toBeLessThan(0.25)
    expect(body.armed).toBe(false)
  })

  it('raises the hands above the head in surrender and hides them behind the back when tied', () => {
    const up = posed({ kind: 'surrender' }, { held: null })
    for (const arm of up.arms) expect(arm.end.y).toBeLessThan(up.head.y)
    const tied = posed({ kind: 'restrained' }, { held: null })
    for (const arm of tied.arms) expect(arm.end.x).toBeLessThan(tied.hip.x)
    expect(tied.hip.y).toBeGreaterThan(STAND.feetY - 0.6)
  })

  it('lays a diving man flat on the floor mid-dive and has him up on a knee by the end', () => {
    const flat = posed({ kind: 'dive', t: 0.6 })
    expect(Math.abs(flat.shoulder.y - flat.hip.y)).toBeLessThan(0.1)
    expect(flat.head.y).toBeGreaterThan(STAND.feetY - 0.5)
    const up = posed({ kind: 'dive', t: 1 })
    expect(up.head.y).toBeLessThan(STAND.feetY - 1)
  })

  it('carries the ballistic shield out in front on the off arm', () => {
    const body = posed({ kind: 'shield' }, { mode: 'crouch' })
    expect(body.offHand?.item).toBe('shield')
    expect(body.offHand!.at.x).toBeGreaterThan(body.shoulder.x + 0.3)
    expect(gap(body.arms[1].end, body.offHand!.at)).toBeLessThan(0.12)
    expect(body.armed).toBe(true)
  })
})
