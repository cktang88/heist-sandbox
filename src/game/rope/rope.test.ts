import { describe, expect, it } from 'vitest'
import { explode } from '../explosions'
import { GUNS } from '../guns'
import { igniteAt } from '../hazards/hazards'
import { bareWorld } from '../hazards/testWorld'
import { idleInput, type Input } from '../input'
import { fireShot } from '../projectiles'
import { stepWorld } from '../step'
import { fillTiles, isSolidAt, tileAt } from '../tiles'
import { actionIndex } from '../toolDefs'
import type { World } from '../world'

const FRAME = 1 / 60
const ROOF = 12
const EDGE = 20
const ROPE = EDGE + 1

/**
 * A solid block whose flat roof (row 12) ends at column 20, over a street on row 28. Inside, a room on rows 17-21
 * with a window in the outer wall on rows 18-20.
 */
function building(): World {
  const world = bareWorld(60, 30)
  fillTiles(world.grid, 1, ROOF, EDGE, 27, 'concrete')
  fillTiles(world.grid, 5, 17, EDGE - 1, 21, 'air')
  fillTiles(world.grid, EDGE, 18, EDGE, 20, 'glass')
  const player = world.player
  Object.assign(player, { x: EDGE + 0.3 - player.w / 2, y: ROOF - player.h - 0.001, vx: 0, vy: 0, onGround: true })
  return world
}

function run(world: World, seconds: number, input: Partial<Input> = {}): void {
  for (let frame = 0; frame < Math.round(seconds / FRAME); frame += 1) {
    stepWorld(world, { ...idleInput({ x: world.player.x + 5, y: world.player.y + 1 }), ...input }, FRAME)
  }
}

function tieRope(world: World): void {
  world.player.tool = actionIndex('rope')
  run(world, FRAME, { firePressed: true, aim: { x: EDGE + 4, y: ROOF } })
}

function ropeRows(world: World): number {
  let rows = 0
  for (let y = 0; y < world.grid.height; y += 1) if (tileAt(world.grid, ROPE, y) === 'ladder') rows += 1
  return rows
}

describe('rope', () => {
  it('ties off at a roof edge and hangs down the face of the building to the street', () => {
    const world = building()
    const ammo = world.player.ammo[actionIndex('rope')]
    tieRope(world)
    expect(world.player.ammo[actionIndex('rope')]).toBe(ammo - 1)
    expect(tileAt(world.grid, ROPE, ROOF - 1)).toBe('ladder')
    expect(tileAt(world.grid, ROPE, 27)).toBe('ladder')
    expect(world.ropes).toHaveLength(1)
  })

  it('is not used up where there is no drop to hang it in', () => {
    const world = building()
    world.player.x = 10
    const ammo = world.player.ammo[actionIndex('rope')]
    tieRope(world)
    expect(world.player.ammo[actionIndex('rope')]).toBe(ammo)
    expect(world.ropes).toHaveLength(0)
  })

  it('lets the player climb down, hang at any height, and climb back up', () => {
    const world = building()
    tieRope(world)
    run(world, 0.2)
    expect(world.player.onLadder).toBe(true)
    expect(world.player.y + world.player.h).toBeCloseTo(ROOF, 1)
    run(world, 0.8, { down: true })
    const hanging = world.player.y
    expect(hanging).toBeGreaterThan(ROOF + 2)
    run(world, 1)
    expect(world.player.y).toBeCloseTo(hanging, 5)
    expect(world.player.onGround).toBe(false)
    run(world, 0.3, { up: true })
    expect(world.player.y).toBeLessThan(hanging - 1)
  })

  it('lets the player shoot out a window while hanging and swing in through it', () => {
    const world = building()
    tieRope(world)
    const player = world.player
    Object.assign(player, { x: ROPE + 0.15, y: 20.9 - player.h, vx: 0, vy: 0, onLadder: true, tool: 0 })
    run(world, 0.5)
    for (const row of [19, 20]) {
      for (let shot = 0; shot < 2; shot += 1) run(world, 0.25, { firePressed: true, aim: { x: EDGE - 1, y: row + 0.5 } })
    }
    expect([19, 20].some((row) => isSolidAt(world.grid, EDGE, row))).toBe(false)
    expect(player.onLadder).toBe(true)
    run(world, 1, { left: true })
    expect(player.x).toBeLessThan(EDGE - 1)
    expect(player.onGround).toBe(true)
    expect(player.y + player.h).toBeCloseTo(22, 1)
  })

  it('leaves the hanging player open to guards’ fire', () => {
    const world = building()
    tieRope(world)
    const player = world.player
    Object.assign(player, { x: ROPE + 0.15, y: 16, vx: 0, vy: 0, onLadder: true })
    const hp = player.hp
    fireShot(world, { x: 40, y: 16.8 }, { x: -1, y: 0 }, { ...GUNS.rifle!.shot, fromPlayer: false, spread: 0 })
    run(world, 0.5)
    expect(player.hp).toBeLessThan(hp)
  })

  it('is cut by an explosion at the anchor, dropping whoever hangs on it', () => {
    const world = building()
    tieRope(world)
    const player = world.player
    Object.assign(player, { x: ROPE + 0.15, y: 16, vx: 0, vy: 0, onLadder: true })
    explode(world, { x: 10, y: ROOF - 0.5 }, { radius: 12, tileDamage: 0, bodyDamage: 0 })
    run(world, 0.2)
    expect(ropeRows(world)).toBe(0)
    expect(world.ropes).toHaveLength(0)
    expect(player.onLadder).toBe(false)
    expect(player.y).toBeGreaterThan(16.2)
  })

  it('burns through when fire reaches the knot', () => {
    const world = building()
    tieRope(world)
    igniteAt(world, { x: EDGE + 0.5, y: ROOF - 0.5 }, 0.8)
    run(world, 0.2)
    expect(ropeRows(world)).toBe(0)
  })

  it('drops the length below a strand that is shot through', () => {
    const world = building()
    tieRope(world)
    fillTiles(world.grid, ROPE, 20, ROPE, 20, 'air')
    run(world, FRAME)
    expect(tileAt(world.grid, ROPE, 19)).toBe('ladder')
    expect(tileAt(world.grid, ROPE, 21)).toBe('air')
    expect(world.ropes[0].bottom).toBe(19)
  })
})
