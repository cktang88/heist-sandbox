import { describe, expect, it } from 'vitest'
import { idleInput } from '../input'
import { boxHitsSolid } from '../physics'
import { movePlayer } from '../player'
import { tileAt } from '../tiles'
import { createWorld, type World } from '../world'
import { stepGrapple } from './grapple'
import { cutThrough, windowAt, type WindowSpot } from './windows'

const SEEDS = [1, 2, 3, 4]
const FRAME = 1 / 60

type Facade = { building: string; wall: number; outside: 1 | -1; top: number; bottom: number }

/** The outer walls of every building in the complex, from the building outlines the generator records. */
function facades(world: World): Facade[] {
  const walls: Facade[] = []
  for (const shell of world.interiors) {
    if (shell.kind !== 'room') continue
    const room = world.rooms.find((candidate) => candidate.x > shell.x && candidate.x < shell.x + shell.w && candidate.floorY <= shell.y + shell.h && candidate.floorY > shell.y)
    if (!room) continue
    const bottom = shell.y + shell.h
    walls.push({ building: room.building, wall: shell.x, outside: -1, top: shell.y, bottom })
    walls.push({ building: room.building, wall: shell.x + shell.w - 1, outside: 1, top: shell.y, bottom })
  }
  return walls
}

/** Each run of glass down an outer wall, with the window spot seen from outside (null when it cannot be used). */
function windowsOf(world: World, facade: Facade): { row: number; spot: WindowSpot | null }[] {
  const found: { row: number; spot: WindowSpot | null }[] = []
  for (let row = facade.top; row < facade.bottom; row += 1) {
    if (tileAt(world.grid, facade.wall, row) !== 'glass' || tileAt(world.grid, facade.wall, row - 1) === 'glass') continue
    const spot = windowAt(world, facade.wall, row, (-facade.outside) as 1 | -1)
    found.push({ row, spot: spot && spot.footing ? spot : null })
  }
  return found
}

/**
 * Cuts the glass, climbs through and lets him settle, checking every frame once the vault is over (the vault itself
 * is an animation that ignores the tiles) that he is never inside a solid tile.
 */
function vaultAndSettle(world: World, spot: WindowSpot): boolean {
  cutThrough(world, spot)
  for (let frame = 0; frame < 60; frame += 1) {
    const input = idleInput({ x: world.player.x + spot.side * 5, y: world.player.y })
    movePlayer(world.grid, world.player, input, FRAME, world.stairwells)
    stepGrapple(world, input, FRAME)
    if (!world.player.mantle && boxHitsSolid(world.grid, world.player)) return false
  }
  return true
}

function placeBeside(world: World, spot: WindowSpot): void {
  const player = world.player
  const x = spot.side > 0 ? spot.x - player.w - 0.02 : spot.x + 1.02
  Object.assign(player, { x, y: spot.bottom + 1.5 - player.h, vx: 0, vy: 0, onGround: false, onLadder: true, hp: 1e6, mantle: null })
}

describe('windows in the complex', () => {
  it('most outer-wall windows can be climbed into, and the vault never leaves him inside a wall', () => {
    const report: string[] = []
    for (const seed of SEEDS) {
      const world = createWorld(seed, 'complex')
      world.guards = []
      const counts = new Map<string, { windows: number; enterable: number }>()
      const usable: WindowSpot[] = []
      for (const facade of facades(world)) {
        const entry = counts.get(facade.building) ?? { windows: 0, enterable: 0 }
        for (const { spot } of windowsOf(world, facade)) {
          entry.windows += 1
          if (!spot) continue
          entry.enterable += 1
          usable.push(spot)
        }
        counts.set(facade.building, entry)
      }
      report.push(`seed ${seed}: ` + [...counts].map(([name, { windows, enterable }]) => `${name} ${enterable}/${windows}`).join(', '))
      const total = [...counts.values()].reduce((sum, entry) => sum + entry.windows, 0)
      expect(usable.length / total).toBeGreaterThan(0.7)

      // Every eighth usable window: in from outside, then back out again.
      for (const spot of usable.filter((_, index) => index % 8 === 0)) {
        placeBeside(world, spot)
        expect(vaultAndSettle(world, spot)).toBe(true)
        const player = world.player
        expect(player.onGround || player.onLadder).toBe(true)
        expect((player.x + player.w / 2 - spot.x - 0.5) * spot.side).toBeGreaterThan(0)
        const back = windowAt(world, spot.x, spot.top, (-spot.side) as 1 | -1)
        expect(back).not.toBeNull()
        expect(vaultAndSettle(world, back!)).toBe(true)
      }
    }
    console.log(report.join('\n'))
  })
})
