import { describe, expect, it } from 'vitest'
import { idleInput, type Input } from '../input'
import type { Level, Room } from '../site'
import { stepWorld } from '../step'
import { tileAt, type Grid } from '../tiles'
import { createWorld, type World } from '../world'
import { createComplex } from './complex'
import { ductRowAt } from './ducts'

const FRAME = 1 / 60

type FoundDuct = { left: number; right: number; floorY: number; grates: number[]; room: Room }

/** Every duct on the site, read back from the tiles under each room's ceiling. */
function findDucts(grid: Grid, rooms: readonly Room[]): FoundDuct[] {
  const ducts = new Map<string, FoundDuct>()
  for (const room of rooms) {
    for (let x = room.x; x < room.x + room.w; x += 1) {
      const floorY = ductRowAt(grid, x, room.y)
      if (floorY === null) continue
      let [left, right] = [x, x]
      while (ductRowAt(grid, left - 1, room.y) !== null) left -= 1
      while (ductRowAt(grid, right + 1, room.y) !== null) right += 1
      const grates: number[] = []
      for (let column = left; column <= right; column += 1) if (tileAt(grid, column, floorY) === 'air') grates.push(column)
      ducts.set(`${left},${floorY}`, { left, right, floorY, grates, room })
      break
    }
  }
  return [...ducts.values()]
}

function run(world: World, seconds: number, input: (frame: number) => Partial<Input>): void {
  const frames = Math.round(seconds / FRAME)
  for (let frame = 0; frame < frames; frame += 1) {
    stepWorld(world, { ...idleInput({ x: world.player.x + 5, y: world.player.y }), ...input(frame) }, FRAME)
  }
}

describe('ventilation ducts', () => {
  const seeds = [1, 2, 3, 7, 42]

  it.each(seeds)('seed %i runs a 20-45 tile duct on a quarter to three quarters of the tower storeys', (seed) => {
    const level: Level = createComplex(seed)
    const ducts = findDucts(level.grid, level.rooms)
    const towerStoreys = new Set(level.rooms.filter((room) => room.building === 'tower' && room.kind !== 'rooftop').map((room) => room.storey))
    const towerDucts = ducts.filter((duct) => duct.room.building === 'tower')
    expect(towerDucts.length).toBeGreaterThanOrEqual(towerStoreys.size * 0.25)
    expect(towerDucts.length).toBeLessThanOrEqual(towerStoreys.size * 0.75)
    for (const duct of ducts) {
      expect(duct.right - duct.left + 1).toBeGreaterThanOrEqual(20)
      expect(duct.right - duct.left + 1).toBeLessThanOrEqual(45)
      expect(duct.grates).toEqual([duct.left + 2, duct.right - 2])
      for (const x of [duct.left - 1, duct.right + 1]) expect(tileAt(level.grid, x, duct.floorY - 1)).not.toBe('air')
    }
  })

  it.each(seeds)('seed %i keeps ducts out of stair lobbies, the vault and double-height rooms', (seed) => {
    const level = createComplex(seed)
    for (const room of level.rooms) {
      if (room.kind !== 'stairwell' && room.kind !== 'vault' && room.h <= 5) continue
      for (let x = room.x; x < room.x + room.w; x += 1) {
        for (let y = room.y; y < room.floorY; y += 1) expect(tileAt(level.grid, x, y), `${room.kind} ${x},${y}`).not.toBe('duct')
      }
    }
  })

  it('hangs the ceiling lights of the rooms below under the duct floor', () => {
    const level = createComplex(1)
    const duct = findDucts(level.grid, level.rooms)[0]
    const lamps = level.lamps.filter((lamp) => lamp.hung && lamp.x >= duct.left && lamp.x <= duct.right + 1 && lamp.y > duct.floorY - 2 && lamp.y < duct.floorY + 3)
    expect(lamps.length).toBeGreaterThan(0)
    for (const lamp of lamps) {
      expect(lamp.y).toBeGreaterThan(duct.floorY + 1)
      expect(tileAt(level.grid, Math.floor(lamp.x), duct.floorY)).toBe('duct')
    }
  })

  /** The complex with nobody about, and the first duct found. */
  function siteWithDuct(): { world: World; duct: FoundDuct } {
    const world = createWorld(1, 'complex')
    world.guards = []
    world.player.hp = 1e6
    return { world, duct: findDucts(world.grid, world.rooms)[0] }
  }

  it('can be crawled from grate to grate by a crouching player, who drops out at the far grate', () => {
    const { world, duct } = siteWithDuct()
    const [near, far] = duct.grates
    Object.assign(world.player, { x: near + 1.15, y: duct.floorY - 0.91, h: 0.9, crouching: true, vx: 0, vy: 0, onGround: true })
    let reached = world.player.x
    run(world, 12, () => {
      if (world.player.y + world.player.h <= duct.floorY + 0.05) reached = Math.max(reached, world.player.x)
      return { right: true, crouch: true }
    })
    expect(reached).toBeGreaterThan(far - 1)
    expect(world.player.y + world.player.h).toBeGreaterThan(duct.floorY + 2)
  })

  it('can be climbed into through a grate with a double jump and a ledge grab', () => {
    const { world, duct } = siteWithDuct()
    const [near] = duct.grates
    const roomFloor = duct.floorY + 4
    Object.assign(world.player, { x: near - 0.4, y: roomFloor - 1.61, vx: 0, vy: 0, onGround: true })
    run(world, 0.1, () => ({}))
    run(world, 1.5, (frame) => ({ right: frame > 20, jumpPressed: frame === 0 || frame === 20, jumpHeld: false }))
    expect(world.player.y + world.player.h).toBeCloseTo(duct.floorY, 1)
    expect(world.player.crouching).toBe(true)
  })
})
