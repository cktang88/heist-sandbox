import { describe, expect, it } from 'vitest'
import { idleInput, type Input } from '../input'
import { movePlayer, createPlayer, type Player } from '../player'
import { createGrid, fillTiles, type Grid } from '../tiles'
import { emitMovementNoise } from './footsteps'
import { addGuard, addWall, arena, GROUND as ARENA_GROUND } from '../security/testArena'

const FRAME = 1 / 60
const FLOOR = 15

/** A flat test room: floor on row 15, open sky above. */
function room(): Grid {
  const grid = createGrid(60, 20)
  fillTiles(grid, 0, FLOOR, 59, 19, 'concrete')
  return grid
}

function standingAt(x: number, feet = FLOOR): Player {
  const player = createPlayer({ x, y: feet - 1.6 - 0.01 })
  player.onGround = true
  return player
}

const feetOf = (player: Player) => player.y + player.h

function run(grid: Grid, player: Player, seconds: number, input: (frame: number) => Partial<Input> = () => ({})): void {
  const frames = Math.round(seconds / FRAME)
  for (let frame = 0; frame < frames; frame += 1) {
    movePlayer(grid, player, { ...idleInput({ x: player.x + 5, y: player.y }), ...input(frame) }, FRAME)
  }
}

describe('crouching', () => {
  it('lowers the body to 0.9 with the feet in place, and creeps at under half speed', () => {
    const grid = room()
    const player = standingAt(10)
    run(grid, player, 0.1)
    run(grid, player, 1, () => ({ crouch: true, right: true }))
    expect(player.crouching).toBe(true)
    expect(player.h).toBeCloseTo(0.9)
    expect(feetOf(player)).toBeCloseTo(FLOOR, 1)
    expect(player.vx).toBeCloseTo(9 * 0.45, 1)
    run(grid, player, 0.1)
    expect(player.crouching).toBe(false)
    expect(player.h).toBeCloseTo(1.6)
  })

  it('cannot stand up under a low ceiling, and stands once out from under it', () => {
    const grid = room()
    fillTiles(grid, 12, 0, 20, FLOOR - 2, 'concrete')
    const player = standingAt(8)
    run(grid, player, 0.1)
    run(grid, player, 1.5, () => ({ crouch: true, right: true }))
    expect(player.x).toBeGreaterThan(13)
    run(grid, player, 0.2)
    expect(player.crouching).toBe(true)
    run(grid, player, 3, () => ({ right: true }))
    expect(player.x).toBeGreaterThan(21)
    expect(player.crouching).toBe(false)
  })

  it('is silent, while running thuds a footstep every stride', () => {
    const grid = room()
    const sneaking = standingAt(5)
    run(grid, sneaking, 2, () => ({ crouch: true, right: true }))
    expect(sneaking.footfalls).toEqual([])
    const running = standingAt(5)
    run(grid, running, 0.6, () => ({ right: true }))
    expect(running.footfalls.length).toBeGreaterThanOrEqual(1)
    expect(running.footfalls[0].radius).toBeCloseTo(4)
    expect(running.footfalls[0].hard).toBe(false)
  })
})

describe('sliding', () => {
  it('turns a crouch at a run into a short fast slide that fits under a one-tile gap', () => {
    const grid = room()
    fillTiles(grid, 20, 0, 23, FLOOR - 2, 'concrete')
    const player = standingAt(9)
    run(grid, player, 1, () => ({ right: true }))
    run(grid, player, FRAME, () => ({ right: true, crouch: true }))
    expect(player.slide).toBeGreaterThan(0)
    expect(player.h).toBeCloseTo(0.9)
    expect(player.vx).toBeGreaterThan(9)
    run(grid, player, 0.3, () => ({ right: true }))
    expect(player.slide).toBeGreaterThan(0)
    run(grid, player, 0.4, () => ({ right: true }))
    expect(player.slide).toBe(0)
    run(grid, player, 1, () => ({ right: true }))
    expect(player.x).toBeGreaterThan(24)
  })

  it('does not happen from a standstill', () => {
    const grid = room()
    const player = standingAt(6)
    run(grid, player, 0.1, () => ({ crouch: true }))
    expect(player.slide).toBe(0)
    expect(player.crouching).toBe(true)
  })
})

describe('ledges', () => {
  it.each([2, 3])('climbs onto a %i-tile wall by jumping at it', (height) => {
    const grid = room()
    fillTiles(grid, 20, FLOOR - height, 45, FLOOR - 1, 'concrete')
    const player = standingAt(18.5)
    let climbed = false
    run(grid, player, 1.2, (frame) => {
      climbed ||= player.mantle !== null
      return { right: true, jumpPressed: frame === 0 }
    })
    expect(climbed).toBe(true)
    expect(player.mantle).toBeNull()
    expect(player.onGround).toBe(true)
    expect(feetOf(player)).toBeCloseTo(FLOOR - height, 1)
    expect(player.x).toBeGreaterThan(20)
  })

  it('takes about a third of a second to pull up', () => {
    const grid = room()
    fillTiles(grid, 20, FLOOR - 3, 25, FLOOR - 1, 'concrete')
    const player = standingAt(18.5)
    let frames = 0
    run(grid, player, 1.2, (frame) => {
      if (player.mantle) frames += 1
      return { right: true, jumpPressed: frame === 0 }
    })
    expect(frames * FRAME).toBeGreaterThan(0.25)
    expect(frames * FRAME).toBeLessThan(0.45)
  })

  it('lets go when down is pressed', () => {
    const grid = room()
    fillTiles(grid, 20, FLOOR - 3, 25, FLOOR - 1, 'concrete')
    const player = standingAt(18.5)
    run(grid, player, 0.2, (frame) => ({ right: true, jumpPressed: frame === 0 }))
    expect(player.mantle).not.toBeNull()
    run(grid, player, 1, () => ({ down: true }))
    expect(player.mantle).toBeNull()
    expect(feetOf(player)).toBeCloseTo(FLOOR, 1)
    expect(player.x).toBeLessThan(20)
  })

  it('squeezes into a crawl space crouched when there is no room to stand on the ledge', () => {
    const grid = room()
    fillTiles(grid, 20, FLOOR - 3, 30, FLOOR - 1, 'concrete')
    fillTiles(grid, 20, 0, 30, FLOOR - 5, 'concrete')
    const player = standingAt(17)
    run(grid, player, 1.2, (frame) => ({ right: true, jumpPressed: frame === 0 }))
    expect(feetOf(player)).toBeCloseTo(FLOOR - 3, 1)
    expect(player.crouching).toBe(true)
    run(grid, player, 1, () => ({ right: true }))
    expect(player.x).toBeGreaterThan(22)
  })

  it('does not grab anything without pushing toward the wall', () => {
    const grid = room()
    fillTiles(grid, 20, FLOOR - 3, 25, FLOOR - 1, 'concrete')
    const player = standingAt(19.25)
    let grabbed = false
    run(grid, player, 1, (frame) => {
      grabbed ||= player.mantle !== null
      return { jumpPressed: frame === 0 }
    })
    expect(grabbed).toBe(false)
  })
})

describe('jumping', () => {
  it('still jumps just after running off an edge (coyote time)', () => {
    const grid = createGrid(60, 30)
    fillTiles(grid, 0, FLOOR, 20, 29, 'concrete')
    const player = standingAt(17)
    let airborne = 0
    run(grid, player, 1, () => {
      if (!player.onGround) airborne += 1
      return { right: true, jumpPressed: airborne === 3 }
    })
    expect(player.airJumps).toBe(1)
    expect(feetOf(player)).toBeLessThan(FLOOR + 3)
  })

  it('keeps a jump pressed just before landing and jumps on touchdown', () => {
    const grid = room()
    const player = standingAt(10, FLOOR - 3)
    player.onGround = false
    player.airJumps = 0
    let pressedAt = -1
    let jumped = false
    run(grid, player, 1, (frame) => {
      const nearlyDown = pressedAt < 0 && feetOf(player) > FLOOR - 0.25 && player.vy > 0
      if (nearlyDown) pressedAt = frame
      if (pressedAt >= 0 && player.vy < -10) jumped = true
      return { jumpPressed: nearlyDown }
    })
    expect(pressedAt).toBeGreaterThan(0)
    expect(jumped).toBe(true)
  })

  it('lands hard and loud after a long drop', () => {
    const grid = room()
    const player = standingAt(10, FLOOR - 8)
    player.onGround = false
    player.hp = 1e6
    run(grid, player, 1.5)
    const landing = player.footfalls.find((footfall) => footfall.hard)
    expect(landing).toBeDefined()
    expect(landing!.radius).toBeGreaterThan(6)
  })

  it('slips sideways into a narrow hatch instead of bumping its edge', () => {
    const grid = room()
    fillTiles(grid, 0, FLOOR - 4, 59, FLOOR - 4, 'concrete')
    fillTiles(grid, 20, FLOOR - 4, 20, FLOOR - 4, 'air')
    const player = standingAt(19.75)
    run(grid, player, 0.2, (frame) => ({ jumpPressed: frame === 0 }))
    expect(feetOf(player)).toBeLessThan(FLOOR - 2)
  })
})

describe('footstep noise', () => {
  it('reaches nearby guards and the speakers', () => {
    const world = arena()
    const guard = addGuard(world, 30, -1)
    world.player.footfalls.push({ x: 28, y: ARENA_GROUND, radius: 4, hard: false })
    emitMovementNoise(world)
    expect(world.player.footfalls).toEqual([])
    expect(world.sounds.some((sound) => sound.kind === 'footstep')).toBe(true)
    expect(guard.state).toBe('suspicious')
    expect(guard.interest?.at.x).toBe(28)
  })

  it('is stopped by a wall between the feet and the guard', () => {
    const world = arena()
    const guard = addGuard(world, 30, -1)
    addWall(world, 29)
    world.player.footfalls.push({ x: 28, y: ARENA_GROUND, radius: 4, hard: false })
    emitMovementNoise(world)
    expect(guard.state).toBe('patrol')
  })

  it('makes no sound at all while crouching, however far the player goes', () => {
    const grid = room()
    const player = standingAt(10)
    run(grid, player, 2, () => ({ right: true, crouch: true }))
    expect(player.x).toBeGreaterThan(15)
    expect(player.footfalls).toEqual([])
  })
})
