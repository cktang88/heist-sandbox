import { describe, expect, it } from 'vitest'
import { findUnsupported, stepCollapse } from './collapse'
import { hurtGuard } from './guards'
import { propBox } from './hazards/props'
import { addProp } from './hazards/testWorld'
import { throwGrenade } from './hazards/hazards'
import { throwFrag } from './frag/frag'
import { throwCharge } from './charges'
import { loosen } from './physprops/state'
import { boxHitsSolid } from './physics'
import { createRagdoll, stepRagdoll } from './ragdoll'
import { createRng } from './rng'
import { hurtTile } from './destruction'
import { explode, ROCKET_BLAST } from './explosions'
import { idleInput } from './input'
import { createLevel } from './level'
import { stepWorld } from './step'
import { createGrid, fillTiles, isSolidAt, setTile, tileAt } from './tiles'
import { createWorld, type World } from './world'

describe('collapse', () => {
  it.each([1, 2, 3, 42])('leaves the untouched level of seed %i standing', (seed) => {
    expect(findUnsupported(createLevel(seed).grid)).toEqual([])
  })

  it('finds tiles cut off from the ground', () => {
    const grid = createGrid(6, 6)
    fillTiles(grid, 0, 5, 5, 5, 'bedrock')
    fillTiles(grid, 2, 1, 2, 4, 'brick')
    expect(findUnsupported(grid)).toEqual([])
    setTile(grid, 2, 3, 'air')
    expect(findUnsupported(grid).length).toBe(2)
  })

  it('never drops the reinforced frame, even a beam whose slab and walls are all gone, but a cut-off beam holds nothing up', () => {
    const grid = createGrid(8, 8)
    fillTiles(grid, 0, 7, 7, 7, 'bedrock')
    fillTiles(grid, 1, 2, 6, 2, 'concrete')
    setTile(grid, 3, 2, 'reinforced')
    fillTiles(grid, 1, 3, 1, 6, 'brick')
    // Walls and slab gone: the beam stays where it is; the slab beside it falls.
    fillTiles(grid, 1, 3, 1, 6, 'air')
    setTile(grid, 2, 2, 'air')
    setTile(grid, 5, 2, 'air')
    const loose = findUnsupported(grid).map((index) => [index % 8, Math.floor(index / 8)])
    expect(loose).toEqual([[1, 2], [4, 2], [6, 2]])
  })

  it('rubble that lands on a cut-off piece of frame breaks up instead of hanging there unsupported', () => {
    const world = createWorld(1)
    world.guards = []
    world.grid = createGrid(8, 12)
    fillTiles(world.grid, 0, 11, 7, 11, 'bedrock')
    setTile(world.grid, 3, 6, 'reinforced')
    setTile(world.grid, 3, 2, 'brick')
    Object.assign(world.player, { x: 6, y: 9, hp: 1e6 })
    world.structureChanged = true
    for (let frame = 0; frame < 120; frame += 1) stepWorld(world, idleInput(), 1 / 60)
    expect(world.falling).toEqual([])
    expect(tileAt(world.grid, 3, 5)).toBe('air')
    expect(findUnsupported(world.grid)).toEqual([])
  })

  it('a tile dropping slowly onto someone breaks up instead of setting solid around them', () => {
    const world = createWorld(1)
    world.grid = createGrid(10, 12)
    fillTiles(world.grid, 0, 10, 9, 11, 'bedrock')
    // The player stands on the floor; a loose tile hangs just above his head; a guard lies dead beside him.
    Object.assign(world.player, { x: 4.15, y: 10 - world.player.h - 0.001, vx: 0, vy: 0, hp: 1e6 })
    world.guards = [world.guards[0]]
    const body = world.guards[0]
    world.falling.push({ x: 4, y: world.player.y - 1.3, vy: 0, kind: 'concrete' })
    hurtGuard(world, body, 1e6, { x: 0, y: 0 })
    body.ragdoll = createRagdoll({ x: 7.5, y: 10 }, { x: 0, y: 0 }, createRng(1))
    for (const point of body.ragdoll.points) point.y = Math.max(point.y, 9.6)
    world.falling.push({ x: 7, y: 6, vy: 0, kind: 'concrete' })
    for (let frame = 0; frame < 90; frame += 1) {
      stepCollapse(world, 1 / 60)
      stepRagdoll(world.grid, body.ragdoll, 1 / 60)
    }
    expect(world.falling).toEqual([])
    expect(boxHitsSolid(world.grid, world.player)).toBe(false)
    for (const point of body.ragdoll.points) expect(isSolidAt(world.grid, point.x, point.y)).toBe(false)
  })

  it('rubble coming down on a grenade, a frag or a C4 charge lying on the floor breaks up on it', () => {
    const world = createWorld(1)
    world.guards = []
    world.grid = createGrid(12, 12)
    fillTiles(world.grid, 0, 10, 11, 11, 'bedrock')
    Object.assign(world.player, { x: 10, y: 10 - world.player.h - 0.001, hp: 1e6 })
    throwGrenade(world, 'smoke', { x: 2.5, y: 9.8 }, { x: 0, y: 1 })
    throwFrag(world, { x: 4.5, y: 9.8 }, { x: 0, y: 1 })
    throwCharge(world, { x: 6.5, y: 9.8 }, { x: 0, y: 1 })
    for (const thrown of [...world.hazards.grenades, ...world.frags, ...world.charges]) Object.assign(thrown, { vx: 0, vy: 0, y: 10 - thrown.h - 0.001 })
    for (const x of [2, 4, 6]) world.falling.push({ x, y: 3, vy: 0, kind: 'concrete' })
    for (let frame = 0; frame < 90; frame += 1) stepCollapse(world, 1 / 60)
    expect(world.falling).toEqual([])
    for (const thrown of [...world.hazards.grenades, ...world.frags, ...world.charges]) expect(boxHitsSolid(world.grid, thrown)).toBe(false)
  })

  it('rubble coming down on a piece of furniture breaks up on it instead of burying it', () => {
    const world = createWorld(1)
    world.guards = []
    world.props = []
    world.grid = createGrid(10, 12)
    fillTiles(world.grid, 0, 10, 9, 11, 'bedrock')
    Object.assign(world.player, { x: 1, y: 10 - world.player.h - 0.001, hp: 1e6 })
    const desk = addProp(world, 'desk', 5, 10)
    // An extinguisher thrown off its wall, lying on the floor: a wall prop, but loose now.
    const extinguisher = addProp(world, 'fireExtinguisher', 8, 9.2)
    loosen(world, extinguisher)
    for (let x = 4; x <= 8; x += 1) world.falling.push({ x, y: 3, vy: 0, kind: 'concrete' })
    for (let frame = 0; frame < 90; frame += 1) stepCollapse(world, 1 / 60)
    for (const prop of [desk, extinguisher]) {
      const box = propBox(prop)
      expect(boxHitsSolid(world.grid, { x: box.x + 0.05, y: box.y + 0.05, w: box.w - 0.1, h: box.h - 0.1 })).toBe(false)
    }
  })

  it('keeps a duct hanging from the slab above when the door it rests on is opened, and drops it when the slab goes', () => {
    const grid = createGrid(12, 9)
    fillTiles(grid, 0, 8, 11, 8, 'bedrock')
    fillTiles(grid, 0, 1, 0, 7, 'reinforced')
    // A slab on row 1 held by the left wall, a duct on row 3, and a door under the duct's far end.
    fillTiles(grid, 0, 1, 8, 1, 'concrete')
    fillTiles(grid, 4, 3, 8, 3, 'duct')
    fillTiles(grid, 8, 4, 8, 7, 'door')
    fillTiles(grid, 8, 4, 8, 7, 'air')
    expect(findUnsupported(grid)).toEqual([])
    fillTiles(grid, 4, 1, 8, 1, 'air')
    expect(findUnsupported(grid).length).toBe(5)
  })

  it('opening every door a duct passes over on the complex never brings a duct down', () => {
    const world = createWorld(1, 'complex')
    let opened = 0
    for (let y = 0; y < world.grid.height; y += 1) {
      for (let x = 0; x < world.grid.width; x += 1) {
        if (tileAt(world.grid, x, y) !== 'duct') continue
        for (let below = y + 1; below <= y + 3; below += 1) {
          if (tileAt(world.grid, x, below) !== 'door') continue
          setTile(world.grid, x, below, 'air')
          opened += 1
        }
      }
    }
    expect(opened).toBeGreaterThan(10)
    const loose = findUnsupported(world.grid).map((index) => tileAt(world.grid, index % world.grid.width, Math.floor(index / world.grid.width)))
    expect(loose.filter((kind) => kind === 'duct')).toEqual([])
  })

  it('drops a cut-off chunk and lets it land as tiles again', () => {
    const world = createWorld(1)
    world.guards = []
    Object.assign(world.player, { x: 5, y: 37, hp: 1e6 })
    // A free-standing pillar on the street, then knock out its base.
    for (let y = 34; y <= 39; y += 1) setTile(world.grid, 40, y, 'brick')
    hurtTile(world, 40, 39, 1000)
    hurtTile(world, 40, 38, 1000)
    for (let frame = 0; frame < 120; frame += 1) stepWorld(world, idleInput(), 1 / 60)
    expect(world.falling.length).toBe(0)
    expect(tileAt(world.grid, 40, 39)).toBe('brick')
    expect(tileAt(world.grid, 40, 36)).toBe('brick')
    expect(tileAt(world.grid, 40, 35)).toBe('air')
  })
})

describe('floors held by the back wall', () => {
  const FRAME = 1 / 60
  const settle = (world: World, seconds: number) => {
    for (let frame = 0; frame < seconds / FRAME; frame += 1) {
      world.player.hp = 1e6
      stepWorld(world, idleInput({ x: world.player.x, y: world.player.y }), FRAME)
    }
  }
  /** A tower office wide enough for two holes with slab left between them, and nobody else around. */
  const officeFloor = () => {
    const world = createWorld(1, 'complex')
    world.guards = []
    const room = world.rooms.find((candidate) => candidate.building === 'tower' && candidate.storey === 6 && candidate.w >= 18)!
    return { world, room }
  }
  const row = (world: World, y: number, x0: number, x1: number) => {
    const kinds: string[] = []
    for (let x = x0; x <= x1; x += 1) kinds.push(tileAt(world.grid, x, y))
    return kinds
  }

  it('two rockets into a tower floor leave the slab between the holes standing, with the player on it', () => {
    const { world, room } = officeFloor()
    const left = room.x + 3
    const right = room.x + room.w - 4
    const middle = Math.floor((left + right) / 2)
    Object.assign(world.player, { x: middle, y: room.floorY - world.player.h - 0.01, vx: 0, vy: 0 })
    explode(world, { x: left + 0.5, y: room.floorY + 0.5 }, ROCKET_BLAST)
    explode(world, { x: right + 0.5, y: room.floorY + 0.5 }, ROCKET_BLAST)
    expect(tileAt(world.grid, left, room.floorY)).toBe('air')
    expect(tileAt(world.grid, right, room.floorY)).toBe('air')
    // The plain side-on rule would drop the middle: nothing links it to the ground in the cut-open view.
    const width = world.grid.width
    expect(findUnsupported(world.grid).some((index) => index % width === middle && Math.floor(index / width) === room.floorY)).toBe(true)
    settle(world, 2)
    expect(row(world, room.floorY, middle - 2, middle + 2)).not.toContain('air')
    expect(world.player.y + world.player.h).toBeCloseTo(room.floorY, 1)
  })

  it('a storey whose slab is cut away for a long stretch on both sides still comes down', () => {
    const { world, room } = officeFloor()
    const middle = Math.floor(room.x + room.w / 2)
    // Cut the floor and everything under it far beyond the back wall's reach on both sides of a short piece.
    for (let x = middle - 14; x <= middle + 14; x += 1) {
      const from = Math.abs(x - middle) <= 1 ? room.floorY + 1 : room.floorY
      for (let y = from; y <= room.floorY + 5; y += 1) hurtTile(world, x, y, 1e6)
    }
    settle(world, 0.1)
    expect(row(world, room.floorY, middle - 1, middle + 1)).toEqual(['air', 'air', 'air'])
  })
})
