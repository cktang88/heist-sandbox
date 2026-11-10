import { describe, expect, it } from 'vitest'
import { fillTiles } from '../tiles'
import { flashViews, grenadeViews, smokeBetween, smokeCells, throwGrenade } from './hazards'
import { addGuard, bareWorld, box, run } from './testWorld'

const FLOOR = 15

function room() {
  const world = bareWorld(50, 20)
  fillTiles(world.grid, 1, FLOOR, 48, 18, 'concrete')
  return world
}

describe('grenades', () => {
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
