import { describe, expect, it } from 'vitest'
import { explode, ROCKET_BLAST } from '../explosions'
import { boxHitsSolid } from '../physics'
import { fillTiles, setTile, tileAt } from '../tiles'
import { fireGrapple, HOOK_RANGE } from './hook'
import { MAX_LINE } from './line'
import { onLine } from './state'
import { buildingWorld, FRAME, ROOF, run, shootAt, standAt, STREET, WALL } from './testWorld'
import type { World } from '../world'
import { bareWorld } from '../hazards/testWorld'

const BAR = 6

/** Open ground under a long concrete bar on row 6, to hang from and swing under. */
function underBar(): World {
  const world = bareWorld(80, 30)
  fillTiles(world.grid, 5, BAR, 75, BAR, 'concrete')
  standAt(world, 40, 28)
  return world
}

function hangUnderBar(): World {
  const world = underBar()
  shootAt(world, { x: 40.2, y: BAR + 0.5 })
  run(world, 1.2, { up: true })
  run(world, 1)
  return world
}

describe('grappling hook', () => {
  it('bites into a wall it is shot at, and makes a small noise', () => {
    const world = buildingWorld()
    shootAt(world, { x: WALL + 0.5, y: 30 })
    expect(world.grapple.phase).toBe('attached')
    expect(world.grapple.anchor).toEqual({ x: WALL, y: expect.any(Number) })
    expect(world.sounds.some((sound) => sound.kind === 'impact')).toBe(true)
    expect(world.effects.flashes.some((flash) => flash.kind === 'noise' && flash.radius < 6)).toBe(true)
  })

  it('bites into a roof edge', () => {
    const world = buildingWorld()
    standAt(world, 26, STREET)
    shootAt(world, { x: WALL + 0.1, y: ROOF + 0.3 })
    expect(world.grapple.anchor).toEqual({ x: WALL, y: ROOF })
  })

  it('glances off glass and comes back', () => {
    const world = buildingWorld()
    standAt(world, 27, STREET)
    shootAt(world, { x: WALL + 0.1, y: 19.5 })
    expect(world.grapple.phase).toBe('stowed')
    expect(world.grapple.anchor).toBeNull()
    expect(tileAt(world.grid, WALL, 19)).toBe('glass')
  })

  it('falls short of a wall out of range and comes back', () => {
    const world = bareWorld(80, 30)
    standAt(world, 5, 28)
    fillTiles(world.grid, 5 + HOOK_RANGE + 6, 1, 78, 27, 'concrete')
    shootAt(world, { x: 70, y: 27.2 })
    expect(world.grapple.phase).toBe('stowed')
    expect(world.grapple.anchor).toBeNull()
  })

  it('reels him up the face of the building and over the roof edge', () => {
    const world = buildingWorld()
    standAt(world, 28, STREET)
    shootAt(world, { x: WALL + 0.1, y: ROOF + 0.3 })
    run(world, 0.5, { up: true })
    expect(onLine(world.grapple)).toBe(true)
    // About 25 rows up: faster than a ladder (6.5 rows a second), but it takes a few seconds.
    run(world, 1, { up: true })
    expect(world.player.y + world.player.h).toBeGreaterThan(ROOF + 8)
    run(world, 2.5, { up: true })
    run(world, 0.6)
    expect(world.player.onGround).toBe(true)
    expect(world.player.y + world.player.h).toBeCloseTo(ROOF, 1)
    expect(world.player.x).toBeGreaterThan(WALL - 0.2)
    expect(world.grapple.phase).toBe('parked')
  })

  it('pays out and reels in along the line', () => {
    const world = hangUnderBar()
    const high = world.player.y
    run(world, 0.5, { down: true })
    expect(world.player.y).toBeGreaterThan(high + 3)
    expect(world.grapple.length).toBeLessThanOrEqual(MAX_LINE)
    run(world, 0.5, { up: true })
    expect(world.player.y).toBeLessThan(high + 1)
  })

  it('swings with A and D, and a jump off keeps the swing', () => {
    const world = hangUnderBar()
    run(world, 0.5, { down: true })
    expect(onLine(world.grapple)).toBe(true)
    let fastest = 0
    for (let frame = 0; frame < 150; frame += 1) {
      run(world, FRAME, { right: true })
      fastest = Math.max(fastest, world.player.vx)
    }
    expect(fastest).toBeGreaterThan(6)
    // Wait for the swing to come back through the bottom heading right, then jump.
    let frames = 0
    while (!(world.player.vx > 5) && frames < 300) {
      run(world, FRAME, { right: true })
      frames += 1
    }
    const speed = world.player.vx
    run(world, FRAME, { jumpPressed: true, jumpHeld: true })
    expect(world.grapple.phase).toBe('retracting')
    run(world, 0.25)
    expect(world.player.vx).toBeGreaterThan(speed * 0.7)
  })

  it('holding Space through a jump off the line does not show a parachute while the swing still carries him', () => {
    const world = hangUnderBar()
    run(world, 0.5, { down: true })
    for (let frame = 0; frame < 150; frame += 1) run(world, FRAME, { right: true })
    run(world, FRAME, { jumpPressed: true, jumpHeld: true })
    let chuteWhileFlung = 0
    for (let frame = 0; frame < 40; frame += 1) {
      run(world, FRAME, { jumpHeld: true })
      if (world.grapple.fling > 0 && world.player.chute) chuteWhileFlung += 1
    }
    expect(chuteWhileFlung).toBe(0)
  })

  it('lets go when fired again', () => {
    const world = hangUnderBar()
    shootAt(world, { x: 50, y: 10 })
    expect(world.grapple.phase).toBe('stowed')
    run(world, 1.2)
    expect(world.player.onGround).toBe(true)
  })

  it('is cut when the tile it bit is destroyed, and he falls', () => {
    const world = hangUnderBar()
    const anchor = world.grapple.anchor!
    setTile(world.grid, anchor.x, anchor.y, 'air')
    run(world, FRAME)
    expect(world.grapple.phase).toBe('stowed')
    run(world, 0.3)
    expect(world.player.vy).toBeGreaterThan(5)
  })

  it('is cut by a blast at the hook', () => {
    const world = hangUnderBar()
    explode(world, { x: world.grapple.hook.x + 1.5, y: world.grapple.hook.y - 1 }, ROCKET_BLAST)
    run(world, FRAME)
    expect(world.grapple.phase).toBe('stowed')
  })

  it('catches on a corner instead of running through a wall, and never pulls him into it', () => {
    const world = underBar()
    shootAt(world, { x: 40.2, y: BAR + 0.5 })
    run(world, 1, { up: true })
    // A block appears between him and the hook.
    fillTiles(world.grid, 36, 10, 39, 11, 'concrete')
    run(world, 2, { right: true })
    run(world, 2, { left: true, up: true })
    expect(boxHitsSolid(world.grid, world.player)).toBe(false)
  })

  it('is deterministic', () => {
    const play = () => {
      const world = hangUnderBar()
      run(world, 1, { right: true, down: true })
      run(world, FRAME, { jumpPressed: true })
      run(world, 1)
      return [world.player.x, world.player.y, world.rng()]
    }
    expect(play()).toEqual(play())
  })

  it('standing up from a crouch on the line just above the floor does not sink his legs into it', () => {
    const world = underBar()
    run(world, 0.1, { crouch: true })
    shootAt(world, { x: 40.2, y: BAR + 0.5 })
    // Reeled in crouched, then let out again until his feet are just off the floor, on the way up out of a dip.
    run(world, FRAME, { up: true, crouch: true })
    for (let frame = 0; frame < 60 && world.player.y + world.player.h < 28 - 0.6; frame += 1) run(world, FRAME, { down: true, crouch: true })
    expect(onLine(world.grapple)).toBe(true)
    expect(world.player.crouching).toBe(true)
    world.grapple.vel = { x: 0, y: -3 }
    for (let frame = 0; frame < 30; frame += 1) {
      run(world, FRAME)
      expect(boxHitsSolid(world.grid, world.player)).toBe(false)
    }
  })

  it('a hook shot from a ladder does not take his weight while he is still on the ladder', () => {
    const world = underBar()
    fillTiles(world.grid, 40, 10, 40, 27, 'ladder')
    standAt(world, 40.5, 28)
    run(world, 0.5, { up: true })
    expect(world.player.onLadder).toBe(true)
    const hand = { x: world.player.x + world.player.w / 2, y: world.player.y + 0.15 }
    fireGrapple(world, hand, { x: 0, y: -1 })
    for (let frame = 0; frame < 30; frame += 1) {
      run(world, FRAME)
      if (world.player.onLadder) expect(world.grapple.hanging).toBe(false)
    }
    expect(world.grapple.phase).toBe('attached')
  })
})
