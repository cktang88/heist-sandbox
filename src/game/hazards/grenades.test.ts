import { describe, expect, it } from 'vitest'
import { idleInput } from '../input'
import { stepWorld } from '../step'
import { fillTiles } from '../tiles'
import { stepGrenades } from './grenades'
import { flashViews, grenadeViews, smokeBetween, smokeCells, throwGrenade } from './hazards'
import { addGuard, bareWorld, box, run } from './testWorld'

const FLOOR = 15

function room() {
  const world = bareWorld(50, 20)
  fillTiles(world.grid, 1, FLOOR, 48, 18, 'concrete')
  return world
}

describe('grenades', () => {
  it('does not spawn a grenade inside a slab when the thrower crosses the stairs', () => {
    const world = room()
    throwGrenade(world, 'smoke', { x: 10, y: FLOOR + 0.1 }, { x: 1, y: -0.3 }, 'guard')
    expect(world.hazards.grenades).toHaveLength(0)
    throwGrenade(world, 'smoke', { x: 10, y: FLOOR - 1 }, { x: 1, y: -0.3 }, 'guard')
    expect(world.hazards.grenades).toHaveLength(1)
  })

  it('flies, bounces and rolls to rest before it pops', () => {
    const world = room()
    throwGrenade(world, 'smoke', { x: 10, y: 12 }, { x: 1, y: -0.3 })
    run(world, 1)
    const [view] = grenadeViews(world)
    expect(view.kind).toBe('smoke')
    expect(view.x).toBeGreaterThan(14)
    expect(view.y).toBeLessThan(FLOOR)
    expect(view.y).toBeGreaterThan(FLOOR - 1)
  })

  it('rolls to a stop at the same spot whatever the frame rate', () => {
    const stopsAt = (fps: number) => {
      const world = room()
      throwGrenade(world, 'smoke', { x: 10, y: FLOOR - 0.2 }, { x: 1, y: 0 })
      const [grenade] = world.hazards.grenades
      // Lying on the floor, rolling.
      Object.assign(grenade, { y: FLOOR - grenade.h - 0.001, vx: 6, vy: 0, onGround: true, fuse: 9 })
      for (let frame = 0; frame < fps; frame += 1) stepGrenades(world, 1 / fps)
      return grenade.x
    }
    const at60 = stopsAt(60)
    expect(at60).toBeGreaterThan(10)
    for (const fps of [30, 144, 240]) expect(Math.abs(stopsAt(fps) - at60)).toBeLessThan(0.15)
  })

  it('flashbang blinds a guard facing it more than one facing away, and nobody behind a wall', () => {
    const world = room()
    fillTiles(world.grid, 28, 8, 28, FLOOR - 1, 'concrete')
    const facing = addGuard(world, 16, FLOOR, 1)
    const away = addGuard(world, 24, FLOOR, 1)
    const hidden = addGuard(world, 31, FLOOR, -1)
    throwGrenade(world, 'flash', { x: 20.5, y: FLOOR - 1 }, { x: 0, y: 1 })
    run(world, 1.4)
    expect(facing.blindSeconds).toBe(0)
    run(world, 0.2)
    expect(flashViews(world).length).toBe(1)
    expect(world.sounds.some((sound) => sound.kind === 'flashbang')).toBe(true)
    expect(facing.blindSeconds).toBeGreaterThan(2)
    expect(away.blindSeconds).toBeGreaterThan(0.5)
    expect(facing.blindSeconds).toBeGreaterThan(away.blindSeconds * 2)
    expect(facing.deafSeconds).toBeGreaterThan(2)
    expect(hidden.blindSeconds).toBe(0)
    expect(hidden.deafSeconds).toBe(0)
    expect(facing.hp).toBeGreaterThan(80)
    run(world, 1)
    expect(flashViews(world).length).toBe(0)
  })

  it('the player\'s flash blindness and deafness wear off, and repeated flashes never add up past one point-blank flash', () => {
    const world = room()
    Object.assign(world.player, { x: 20, y: FLOOR - world.player.h - 0.01, vx: 0, vy: 0 })
    let longest = 0
    for (let bang = 0; bang < 5; bang += 1) {
      throwGrenade(world, 'flash', { x: 20.35, y: FLOOR - 1 }, { x: 0, y: 1 })
      for (let frame = 0; frame < 100; frame += 1) {
        stepWorld(world, idleInput({ x: 30, y: FLOOR - 1 }), 1 / 60)
        longest = Math.max(longest, world.player.blindSeconds, world.player.deafSeconds)
      }
    }
    expect(longest).toBeGreaterThan(0.5)
    expect(longest).toBeLessThanOrEqual(2)
    for (let frame = 0; frame < 180; frame += 1) stepWorld(world, idleInput({ x: 30, y: FLOOR - 1 }), 1 / 60)
    expect(world.player.blindSeconds).toBe(0)
    expect(world.player.deafSeconds).toBe(0)
  })

  it('smoke grenade blooms into a room-wide cloud that later clears', () => {
    const world = bareWorld(40, 20)
    box(world, 5, 5, 34, 9)
    throwGrenade(world, 'smoke', { x: 18, y: 8 }, { x: 0, y: 1 })
    const across = () => smokeBetween(world, { x: 12, y: 8.5 }, { x: 24, y: 8.5 })
    run(world, 1)
    expect(across()).toBe(0)
    run(world, 1.8)
    expect(world.sounds.some((sound) => sound.kind === 'smokePop')).toBe(true)
    expect(across()).toBeGreaterThan(0.6)
    const thick = smokeCells(world).filter((cell) => cell.density > 0.5 && cell.y === 8).map((cell) => cell.x)
    const width = Math.max(...thick) - Math.min(...thick) + 1
    expect(width).toBeGreaterThanOrEqual(8)
    expect(width).toBeLessThanOrEqual(16)
    expect(smokeCells(world).every((cell) => !cell.toxic)).toBe(true)
    run(world, 12)
    expect(across()).toBeGreaterThan(0.6)
    run(world, 15)
    expect(across()).toBeLessThan(0.3)
  })
})
