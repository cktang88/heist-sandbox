import { describe, expect, it } from 'vitest'
import { nextHop } from './nav'
import type { Stairwell } from './site'
import { climbStairs, findLanding, landingX, stairPoint, type OnStairs } from './stairs'
import type { Body } from './types'

const well: Stairwell = { id: 0, building: 'test', leftX: 10, rightX: 20, stops: [100, 94, 88, 82] }

describe('stairs', () => {
  it('zigzags between the left and right landings', () => {
    expect(landingX(well, 0)).toBe(10)
    expect(landingX(well, 1)).toBe(20)
    expect(stairPoint(well, 0.5)).toEqual({ x: 15, y: 97 })
    expect(stairPoint(well, 1.5)).toEqual({ x: 15, y: 91 })
  })

  it('finds the landing someone is standing at', () => {
    expect(findLanding([well], 10.3, 100)?.stop).toBe(0)
    expect(findLanding([well], 20, 94.2)?.stop).toBe(1)
    expect(findLanding([well], 15, 100)).toBeNull()
  })

  it('climbs one flight and stops at the next landing', () => {
    const body: Body = { x: 0, y: 0, w: 0.7, h: 1.6, vx: 0, vy: 0, onGround: true }
    const on: OnStairs = { well: 0, u: 0 }
    let frames = 0
    while (climbStairs(body, on, well, 1, false, 1 / 60) && frames < 600) frames += 1
    expect(on.u).toBe(1)
    expect(body.y + body.h).toBeCloseTo(94)
    expect(frames).toBeGreaterThan(30)
  })

  it('carries on through landings while the climber keeps going', () => {
    const body: Body = { x: 0, y: 0, w: 0.7, h: 1.6, vx: 0, vy: 0, onGround: true }
    const on: OnStairs = { well: 0, u: 0 }
    let frames = 0
    while (climbStairs(body, on, well, 1, true, 1 / 60) && frames < 2000) frames += 1
    expect(on.u).toBe(3)
  })

  it('plans a route: walk to the landing, then take the stairs, then walk to the goal', () => {
    expect(nextHop([well], { x: 30, y: 100 }, { x: 5, y: 88 })).toEqual({ kind: 'walk', x: 10 })
    expect(nextHop([well], { x: 10.2, y: 100 }, { x: 5, y: 88 })).toMatchObject({ kind: 'stairs', stop: 0, direction: 1 })
    expect(nextHop([well], { x: 20, y: 88 }, { x: 5, y: 88 })).toEqual({ kind: 'walk', x: 5 })
    expect(nextHop([well], { x: 20, y: 60 }, { x: 5, y: 88 })).toEqual({ kind: 'none' })
  })
})
