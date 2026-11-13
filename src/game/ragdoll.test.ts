import { describe, expect, it } from 'vitest'
import { BONES, createRagdoll, isAsleep, pushRagdoll, stepRagdoll, type Ragdoll } from './ragdoll'
import { createRng } from './rng'
import { createGrid, fillTiles, isSolidAt, setTile, type Grid } from './tiles'

describe('ragdoll', () => {
  it('flops to the floor without stretching or sinking into it', () => {
    const grid = createGrid(20, 12)
    fillTiles(grid, 0, 10, 19, 11, 'concrete')
    const ragdoll = createRagdoll({ x: 10, y: 6 }, { x: 6, y: -8 }, createRng(1))
    const lengths = () => BONES.map(([a, b]) => Math.hypot(ragdoll.points[a].x - ragdoll.points[b].x, ragdoll.points[a].y - ragdoll.points[b].y))
    const rest = lengths()
    for (let frame = 0; frame < 240; frame += 1) stepRagdoll(grid, ragdoll, 1 / 60)
    for (const point of ragdoll.points) {
      expect(isSolidAt(grid, point.x, point.y)).toBe(false)
      expect(point.y).toBeGreaterThan(8.5)
    }
    lengths().forEach((length, index) => expect(Math.abs(length - rest[index])).toBeLessThan(0.12))
  })

  it('a body blown down at full speed on slow frames lands on a one-tile slab instead of passing through it', () => {
    const grid = createGrid(20, 24)
    fillTiles(grid, 0, 12, 19, 12, 'concrete')
    fillTiles(grid, 0, 22, 19, 23, 'concrete')
    const ragdoll = createRagdoll({ x: 10, y: 11 }, { x: 0, y: 0 }, createRng(1))
    for (const point of ragdoll.points) point.vy = 40
    for (let frame = 0; frame < 60; frame += 1) stepRagdoll(grid, ragdoll, 1 / 30)
    for (const point of ragdoll.points) expect(point.y).toBeLessThan(12)
  })

  it('a body that starts partly inside a slab (killed on the stairs) steps out of it', () => {
    const grid = createGrid(20, 24)
    fillTiles(grid, 0, 12, 19, 12, 'concrete')
    fillTiles(grid, 0, 22, 19, 23, 'concrete')
    const ragdoll = createRagdoll({ x: 10, y: 13.6 }, { x: 0, y: 0 }, createRng(1))
    for (let frame = 0; frame < 120; frame += 1) stepRagdoll(grid, ragdoll, 1 / 60)
    for (const point of ragdoll.points) expect(isSolidAt(grid, point.x, point.y)).toBe(false)
  })

  it('a body with a wall or door filled in around it (a doorway shut on it) steps out sideways', () => {
    const grid = createGrid(20, 12)
    fillTiles(grid, 0, 10, 19, 11, 'concrete')
    const ragdoll = createRagdoll({ x: 10.3, y: 10 }, { x: 0, y: 0 }, createRng(1))
    fillTiles(grid, 10, 4, 10, 9, 'door')
    for (let frame = 0; frame < 120; frame += 1) stepRagdoll(grid, ragdoll, 1 / 60)
    for (const point of ragdoll.points) expect(isSolidAt(grid, point.x, point.y)).toBe(false)
  })

  it('a body thrown sideways at full speed stops at a one-tile wall', () => {
    const grid = createGrid(30, 12)
    fillTiles(grid, 0, 10, 29, 11, 'concrete')
    fillTiles(grid, 15, 0, 15, 9, 'brick')
    const ragdoll = createRagdoll({ x: 13.5, y: 10 }, { x: 0, y: 0 }, createRng(1))
    for (const point of ragdoll.points) point.vx = 40
    for (let frame = 0; frame < 60; frame += 1) stepRagdoll(grid, ragdoll, 1 / 30)
    for (const point of ragdoll.points) expect(point.x).toBeLessThan(15)
  })

  it('a body blown through the air lands as far away whatever the frame rate', () => {
    const landedAt = (fps: number) => {
      const grid = createGrid(80, 30)
      fillTiles(grid, 0, 28, 79, 29, 'concrete')
      const ragdoll = createRagdoll({ x: 10, y: 28 }, { x: 0, y: 0 }, createRng(1))
      // Thrown up and out by a blast, then left to fly, land and skid to a stop.
      for (const point of ragdoll.points) {
        point.vx = 14
        point.vy = -12
      }
      for (let frame = 0; frame < 4 * fps; frame += 1) stepRagdoll(grid, ragdoll, 1 / fps)
      return ragdoll.points[2].x
    }
    const at60 = landedAt(60)
    expect(at60).toBeGreaterThan(15)
    for (const fps of [30, 120, 144, 240]) expect(Math.abs(landedAt(fps) - at60)).toBeLessThan(0.5)
  })

  describe('sleeping', () => {
    function restingBody(): { grid: Grid; ragdoll: Ragdoll } {
      const grid = createGrid(20, 24)
      fillTiles(grid, 0, 10, 19, 10, 'wood')
      fillTiles(grid, 0, 22, 19, 23, 'concrete')
      const ragdoll = createRagdoll({ x: 10, y: 9.9 }, { x: 0, y: 0 }, createRng(1))
      // Dropped standing, it takes a few seconds to topple over and come to rest.
      for (let frame = 0; frame < 480; frame += 1) stepRagdoll(grid, ragdoll, 1 / 60)
      return { grid, ragdoll }
    }
    const hipY = (ragdoll: Ragdoll) => ragdoll.points[2].y

    it('a body lying still falls asleep and stays exactly where it lay', () => {
      const { grid, ragdoll } = restingBody()
      expect(isAsleep(ragdoll)).toBe(true)
      const before = ragdoll.points.map((point) => ({ ...point }))
      for (let frame = 0; frame < 60; frame += 1) stepRagdoll(grid, ragdoll, 1 / 60)
      expect(ragdoll.points).toEqual(before)
    })

    it('stays asleep when tiles change far away', () => {
      const { grid, ragdoll } = restingBody()
      setTile(grid, 2, 10, 'air')
      setTile(grid, 18, 3, 'brick')
      stepRagdoll(grid, ragdoll, 1 / 60)
      expect(isAsleep(ragdoll)).toBe(true)
    })

    it('wakes and flies when a blast reaches it', () => {
      const { grid, ragdoll } = restingBody()
      const hip = ragdoll.points[2]
      pushRagdoll(ragdoll, { x: hip.x - 1, y: hip.y + 0.5 }, 3, 20)
      expect(isAsleep(ragdoll)).toBe(false)
      const startX = hip.x
      for (let frame = 0; frame < 10; frame += 1) stepRagdoll(grid, ragdoll, 1 / 60)
      expect(hip.x).toBeGreaterThan(startX + 0.3)
    })

    it('ignores a blast that does not reach it', () => {
      const { grid, ragdoll } = restingBody()
      pushRagdoll(ragdoll, { x: 1, y: 2 }, 3, 20)
      stepRagdoll(grid, ragdoll, 1 / 60)
      expect(isAsleep(ragdoll)).toBe(true)
    })

    it('wakes and falls when the floor under it is destroyed', () => {
      const { grid, ragdoll } = restingBody()
      expect(hipY(ragdoll)).toBeLessThan(10)
      fillTiles(grid, 0, 10, 19, 10, 'air')
      for (let frame = 0; frame < 120; frame += 1) stepRagdoll(grid, ragdoll, 1 / 60)
      expect(hipY(ragdoll)).toBeGreaterThan(19)
      for (const point of ragdoll.points) expect(point.y).toBeLessThan(22)
    })

    it('wakes when something moves it from outside', () => {
      const { grid, ragdoll } = restingBody()
      for (const point of ragdoll.points) point.y -= 3
      for (let frame = 0; frame < 60; frame += 1) stepRagdoll(grid, ragdoll, 1 / 60)
      expect(hipY(ragdoll)).toBeGreaterThan(9)
    })
  })
})
