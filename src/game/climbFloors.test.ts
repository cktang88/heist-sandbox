import { describe, expect, it } from 'vitest'
import { idleInput, type Input } from './input'
import { stepWorld } from './step'
import { isSolidAt } from './tiles'
import { actionIndex, toolIndex } from './toolDefs'
import { createWorld, type World } from './world'

/** Going up a storey the loud way: C4 on the ceiling, blast a hole, grapple through it, reel up, step off. */

const FRAME = 1 / 60

function play(world: World, seconds: number, input: Partial<Input> = {}, until?: () => boolean): void {
  for (let frame = 0; frame < Math.round(seconds / FRAME); frame += 1) {
    const feetX = world.player.x + world.player.w / 2
    stepWorld(world, { ...idleInput({ x: feetX + 5, y: world.player.y }), ...input }, FRAME)
    world.player.hp = 1e6
    if (until?.()) return
  }
}

/** A plain office on a middle storey of the tower, with a room directly above it. */
function officeWithRoomAbove(world: World) {
  const rooms = world.rooms.filter((room) => room.kind === 'office' && room.building === 'tower' && room.w >= 20)
  return rooms.find((room) => world.rooms.some((above) => above.floorY === room.floorY - 6 && above.x <= room.x + room.w / 2 && above.x + above.w > room.x + room.w / 2))!
}

/** Does everything up to hanging on the line just above the floor of the storey overhead. Returns that floor's row. */
function climbToHang(): { world: World; upper: number } {
    const world = createWorld(1, 'complex')
    world.guards = []
    const room = officeWithRoomAbove(world)
    const x = Math.floor(room.x + room.w / 2) + 0.5
    const feet = room.floorY
    Object.assign(world.player, { x: x - world.player.w / 2, y: feet - world.player.h - 0.01, vx: 0, vy: 0, hp: 1e6, tool: toolIndex('c4') })
    play(world, 0.3)

    // Thrown straight up from the floor, the charge reaches the ceiling five rows up and sticks there.
    play(world, FRAME, { fire: true, firePressed: true, aim: { x, y: feet - 5.5 } })
    play(world, 1)

    // Step well back, set it off, and come back under the hole.
    play(world, 1.2, { left: true })
    play(world, FRAME, { detonatePressed: true })
    play(world, 1.5)
    play(world, 3, { right: true }, () => world.player.x + world.player.w / 2 >= x - 0.2)
    play(world, 0.3)
    // In a narrow room the blast was close enough to knock him about: wait until he has his feet back.
    play(world, 2, {}, () => world.player.stunSeconds <= 0 && world.player.onGround)

    // Fire the hook up through the hole into the ceiling of the storey above, and reel up.
    world.player.tool = actionIndex('grapple')
    const here = world.player.x + world.player.w / 2
    play(world, FRAME, { fire: true, firePressed: true, aim: { x: here, y: feet - 14 } })
    play(world, 1)
    play(world, 4, { up: true }, () => world.player.y + world.player.h < feet - 6.2)

  return { world, upper: feet - 6 }
}

describe('climbing floors with C4 and the grapple', () => {
  it('throws C4 up onto the ceiling, blasts a hole, grapples through it and ends up hanging above the next floor', () => {
    const world = createWorld(1, 'complex')
    world.guards = []
    const room = officeWithRoomAbove(world)
    const x = Math.floor(room.x + room.w / 2) + 0.5
    const feet = room.floorY
    Object.assign(world.player, { x: x - world.player.w / 2, y: feet - world.player.h - 0.01, vx: 0, vy: 0, hp: 1e6, tool: toolIndex('c4') })
    play(world, 0.3)

    // Thrown straight up from the floor, the charge reaches the ceiling five rows up and sticks there.
    play(world, FRAME, { fire: true, firePressed: true, aim: { x, y: feet - 5.5 } })
    play(world, 1)
    expect(world.charges).toHaveLength(1)
    const stuck = world.charges[0].stuck
    expect(stuck !== 'backWall' && stuck?.y).toBe(feet - 6)

    // Step well back, set it off, and come back under the hole.
    play(world, 1.2, { left: true })
    play(world, FRAME, { detonatePressed: true })
    play(world, 1.5)
    expect(isSolidAt(world.grid, x, feet - 5.5)).toBe(false)
    play(world, 3, { right: true }, () => world.player.x + world.player.w / 2 >= x - 0.2)
    play(world, 0.3)
    // In a narrow room the blast was close enough to knock him about: wait until he has his feet back.
    play(world, 2, {}, () => world.player.stunSeconds <= 0 && world.player.onGround)

    // Fire the hook up through the hole into the ceiling of the storey above, and reel up.
    world.player.tool = actionIndex('grapple')
    const here = world.player.x + world.player.w / 2
    play(world, FRAME, { fire: true, firePressed: true, aim: { x: here, y: feet - 14 } })
    play(world, 1)
    expect(world.grapple.phase).toBe('attached')
    play(world, 4, { up: true }, () => world.player.y + world.player.h < feet - 6.2)
    expect(world.player.y + world.player.h).toBeLessThan(feet - 6)

  })

  it('swings off the line onto the floor above', () => {
    const { world, upper } = climbToHang()
    play(world, 1, { right: true })
    play(world, FRAME, { jumpPressed: true })
    play(world, 0.8, { right: true })
    expect(world.player.onGround).toBe(true)
    expect(Math.round(world.player.y + world.player.h)).toBe(upper)
  })

  it('swings to one side, lets go by firing again, and lands on the floor above further that way', () => {
    const { world, upper } = climbToHang()
    const start = world.player.x
    let far = 0
    // Let go at the far end of the first swing.
    for (let frame = 0; frame < 120; frame += 1) {
      play(world, FRAME, { right: true })
      if (world.player.x - start < far - 0.02) break
      far = Math.max(far, world.player.x - start)
    }
    expect(far).toBeGreaterThan(2.4)
    play(world, FRAME, { fire: true, firePressed: true, right: true })
    play(world, 1, { right: true })
    expect(world.grapple.hanging).toBe(false)
    expect(world.player.onGround).toBe(true)
    expect(Math.round(world.player.y + world.player.h)).toBe(upper)
    expect(world.player.x - start).toBeGreaterThan(3)
  })

  it('pumps the swing left and right to go further than one push', () => {
    const { world } = climbToHang()
    const start = world.player.x
    let far = 0
    let side = 1
    for (let frame = 0; frame < 480; frame += 1) {
      const before = world.grapple.vel.x
      play(world, FRAME, side > 0 ? { right: true } : { left: true })
      // Push the way he is already moving: switch when the swing turns round.
      if (Math.sign(world.grapple.vel.x) !== 0 && Math.sign(world.grapple.vel.x) !== Math.sign(before) && Math.sign(before) !== 0) side = Math.sign(world.grapple.vel.x)
      far = Math.max(far, Math.abs(world.player.x - start))
    }
    expect(far).toBeGreaterThan(3)
  })

  it('lets go straight over the hole and stands on what is left of the floor', () => {
    const { world, upper } = climbToHang()
    play(world, FRAME, { jumpPressed: true })
    play(world, 1.5)
    expect(world.player.onGround).toBe(true)
    expect(Math.round(world.player.y + world.player.h)).toBe(upper)
  })

  it('holds down while letting go and drops back through the hole', () => {
    const { world, upper } = climbToHang()
    play(world, FRAME, { jumpPressed: true, down: true })
    play(world, 1.5, { down: true })
    expect(world.player.y + world.player.h).toBeGreaterThan(upper + 3)
  })
})
