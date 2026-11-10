import { describe, expect, it } from 'vitest'
import { addGuard } from '../hazards/testWorld'
import { idleInput } from '../input'
import { boxHitsSolid } from '../physics'
import { fillTiles, tileAt } from '../tiles'
import type { World } from '../world'
import { onLine } from './state'
import { buildingWorld, FLOOR, FRAME, ROOF, run, shootAt, standAt, STREET, WALL, WINDOW_BOTTOM, WINDOW_TOP } from './testWorld'
import { findWindow, readWindowTap, smashThrough, windowAction } from './windows'

const OUTSIDE = WALL - 1

/** On a rope hanging down the outside wall, level with the window. */
function onRope(): World {
  const world = buildingWorld()
  fillTiles(world.grid, OUTSIDE, ROOF, OUTSIDE, STREET - 1, 'ladder')
  standAt(world, OUTSIDE + 0.5, FLOOR - 0.5)
  Object.assign(world.player, { onGround: false, onLadder: true })
  run(world, FRAME)
  return world
}

/** On the grapple line from the roof edge, reeled up beside the window. */
function onGrappleLine(): World {
  const world = buildingWorld()
  standAt(world, 28, STREET)
  shootAt(world, { x: WALL + 0.02, y: ROOF + 0.3 })
  while (world.player.y + world.player.h > FLOOR - 0.6) run(world, FRAME, { up: true })
  run(world, 0.5)
  return world
}

function glassLeft(world: World): number {
  let panes = 0
  for (let y = WINDOW_TOP; y <= WINDOW_BOTTOM; y += 1) if (tileAt(world.grid, WALL, y) === 'glass') panes += 1
  return panes
}

function insideOnFloor(world: World): boolean {
  const player = world.player
  return player.onGround && Math.abs(player.y + player.h - FLOOR) < 0.05 && player.x > WALL + 0.9 && !boxHitsSolid(world.grid, player)
}

describe('window entry', () => {
  it('offers to break in from a rope outside, smashes the glass loudly and lands him on the floor inside', () => {
    const world = onRope()
    const guard = addGuard(world, 36, FLOOR, 1)
    expect(windowAction(world)?.prompt).toContain('E: break window and climb in')
    expect(windowAction(world)?.prompt).toContain('Hold E: cut glass')
    smashThrough(world, findWindow(world)!)
    expect(glassLeft(world)).toBe(0)
    expect(world.sounds.some((sound) => sound.kind === 'glass')).toBe(true)
    expect(world.effects.flashes.some((flash) => flash.kind === 'noise' && flash.radius >= 10)).toBe(true)
    expect(world.player.onLadder).toBe(false)
    run(world, 0.3)
    expect(guard.mode).not.toBe('calm')
    expect(world.player.mantle).not.toBeNull()
    run(world, 0.7)
    expect(insideOnFloor(world)).toBe(true)
  })

  it('cannot shoot during the vault', () => {
    const world = onRope()
    smashThrough(world, findWindow(world)!)
    world.player.tool = 0
    const rounds = world.player.mags[0]
    run(world, 0.3, { fire: true, firePressed: true })
    expect(world.player.mags[0]).toBe(rounds)
  })

  it('a quick tap smashes, a held E cuts the glass almost silently', () => {
    const tapped = onRope()
    putOnOffer(tapped)
    readWindowTap(tapped, { ...idleInput(), interactPressed: true, interact: true })
    tapped.clock += 0.1
    readWindowTap(tapped, idleInput())
    expect(glassLeft(tapped)).toBe(0)
    expect(tapped.sounds.some((sound) => sound.kind === 'glass')).toBe(true)

    const cut = onRope()
    const guard = addGuard(cut, 34, FLOOR, 1)
    const action = windowAction(cut)!
    expect(action.hold).toBe(3)
    action.run()
    expect(glassLeft(cut)).toBe(0)
    expect(cut.sounds.some((sound) => sound.kind === 'glass')).toBe(false)
    expect(cut.effects.flashes.some((flash) => flash.kind === 'noise')).toBe(false)
    run(cut, 1)
    expect(guard.mode).toBe('calm')
    expect(insideOnFloor(cut)).toBe(true)
  })

  it('a held E that is let go early does not smash once it has gone on past a tap', () => {
    const world = onRope()
    putOnOffer(world)
    readWindowTap(world, { ...idleInput(), interactPressed: true, interact: true })
    world.clock += 1
    readWindowTap(world, idleInput())
    expect(glassLeft(world)).toBe(3)
  })

  it('climbs out again onto the rope', () => {
    const world = onRope()
    windowAction(world)!.run()
    run(world, 1)
    expect(windowAction(world)?.prompt).toBe('E: climb out')
    windowAction(world)!.run()
    run(world, 1)
    expect(world.player.onLadder).toBe(true)
    expect(world.player.x).toBeLessThan(WALL)
    expect(boxHitsSolid(world.grid, world.player)).toBe(false)
  })

  it('warns when there is nothing outside to hold on to', () => {
    const world = buildingWorld()
    standAt(world, WALL + 1.5, FLOOR)
    run(world, FRAME)
    expect(windowAction(world)?.prompt).toContain('E: break window and jump')
    smashThrough(world, findWindow(world)!)
    run(world, 2)
    expect(world.player.x).toBeLessThan(WALL)
    expect(world.player.y + world.player.h).toBeCloseTo(STREET, 1)
  })

  it('goes in from the grapple line, leaves the hook in place and takes the line again on the way out', () => {
    const world = onGrappleLine()
    expect(onLine(world.grapple)).toBe(true)
    expect(windowAction(world)?.prompt).toContain('climb in')
    windowAction(world)!.run()
    expect(world.grapple.phase).toBe('parked')
    run(world, 1)
    expect(insideOnFloor(world)).toBe(true)
    expect(windowAction(world)?.prompt).toBe('E: climb out')
    windowAction(world)!.run()
    run(world, 1)
    expect(onLine(world.grapple)).toBe(true)
    expect(world.player.x).toBeLessThan(WALL)
  })

  it.each([['the grapple line', onGrappleLine], ['a rope', onRope]])('holding E on %s cuts the glass and climbs in', (_, setUp) => {
    const world = setUp()
    run(world, FRAME)
    expect(world.prompt).toContain('Hold E: cut glass')
    run(world, 3.2, { interact: true })
    expect(glassLeft(world)).toBe(0)
    expect(world.sounds.some((sound) => sound.kind === 'glass')).toBe(false)
    run(world, 1)
    expect(insideOnFloor(world)).toBe(true)
  })

  it('lets go of the line with E when no window is in reach', () => {
    const world = buildingWorld()
    standAt(world, 28, STREET)
    shootAt(world, { x: WALL + 0.02, y: ROOF + 0.3 })
    run(world, 0.5, { up: true })
    const action = windowAction(world)!
    expect(action.prompt).toBe('E: let go')
    action.run()
    expect(onLine(world.grapple)).toBe(false)
  })

  it('crashes through glass when swung into it fast, and is cut a little', () => {
    const world = buildingWorld()
    standAt(world, WALL - 1, FLOOR - 1.1)
    Object.assign(world.player, { onGround: false })
    Object.assign(world.grapple, { fling: 0.7, vel: { x: 13, y: -2 }, lastVel: { x: 13, y: -2 }, body: { x: world.player.x, y: world.player.y } })
    run(world, 0.8)
    expect(glassLeft(world)).toBeLessThan(3)
    expect(world.player.hp).toBeLessThan(1e6)
    expect(world.player.x).toBeGreaterThan(WALL + 0.9)
    expect(boxHitsSolid(world.grid, world.player)).toBe(false)
  })

  it('crashes through a skylight when dropped onto it', () => {
    const world = buildingWorld()
    fillTiles(world.grid, 40, ROOF + 1, 42, FLOOR - 6, 'air')
    fillTiles(world.grid, 40, ROOF, 42, ROOF, 'glass')
    standAt(world, 41.5, 3)
    run(world, 1.5)
    expect(tileAt(world.grid, 41, ROOF)).toBe('air')
    expect(world.player.y + world.player.h).toBeCloseTo(FLOOR, 1)
  })

  it('walking past at a run does not break the window', () => {
    const world = buildingWorld()
    standAt(world, 45, FLOOR)
    run(world, 1.5, { left: true })
    expect(glassLeft(world)).toBe(3)
  })
})

/** Puts the window action on offer, as `interact.ts` does each frame when it is the best thing to do. */
function putOnOffer(world: World): void {
  world.prompt = windowAction(world)!.prompt
}
