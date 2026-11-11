import { describe, expect, it } from 'vitest'
import { playerShotSpread, resolveAim } from './aiming'
import { GUNS } from './guns'
import { addGuard, addProp, bareWorld } from './hazards/testWorld'
import { idleInput } from './input'
import { fireShot, stepProjectiles } from './projectiles'
import { CLEAR_OF_LANE, fillTiles, setLaneFlags } from './tiles'
import { toolIndex } from './toolDefs'
import { handOf, useTool } from './tools'
import { centerOf, type Vec } from './types'
import type { World } from './world'

function shoot(world: World, aim: Vec, tool: 'pistol' | 'rifle' | 'rocket' = 'pistol'): void {
  world.player.tool = toolIndex(tool)
  useTool(world, { ...idleInput(aim), fire: true, firePressed: true }, 1 / 60)
  for (let frame = 0; frame < 240 && world.projectiles.length; frame += 1) stepProjectiles(world, 1 / 60)
}

describe('cursor-directed player shots', () => {
  it('hits the guard under the cursor without striking a distant cabinet or wall device on the way', () => {
    const world = bareWorld()
    const cabinet = addProp(world, 'filingCabinet', 15, 22)
    const guard = addGuard(world, 32, 22, -1)
    world.devices.push({ id: 0, kind: 'radioRelay', x: 20, y: 21, disabled: false, hacked: false })
    shoot(world, centerOf(guard))
    expect(guard.hp).toBeLessThan(guard.maxHp)
    expect(cabinet.hp).toBeGreaterThan(0)
    expect(cabinet.broken).toBe(false)
    expect(world.devices[0].disabled).toBe(false)
  })

  it('still damages furniture deliberately selected at the cursor', () => {
    const world = bareWorld()
    const cabinet = addProp(world, 'filingCabinet', 20, 22)
    const hp = cabinet.hp
    shoot(world, { x: 20.5, y: 21 })
    expect(cabinet.hp).toBeLessThan(hp)
  })

  it('lands a near-cursor shot on a person even with maximum bloom', () => {
    const world = bareWorld()
    const guard = addGuard(world, 32, 22, -1)
    world.player.bloom = 0.14
    shoot(world, { x: guard.x + guard.w + 0.4, y: guard.y + 0.6 }, 'rifle')
    expect(guard.hp).toBeLessThan(guard.maxHp)
  })

  it('detonates a rocket at the cursor even in open air, passing incidental furniture', () => {
    const world = bareWorld()
    const cabinet = addProp(world, 'filingCabinet', 15, 22)
    const hp = cabinet.hp
    const target = { x: 31.5, y: 20.8 }
    shoot(world, target, 'rocket')
    const blast = world.effects.flashes.find((flash) => flash.kind === 'explosion')
    expect(blast?.x).toBe(target.x)
    expect(blast?.y).toBe(target.y)
    expect(cabinet.hp).toBe(hp)
  })

  it('retains real walls and floors as cover for bullets and rockets', () => {
    for (const tool of ['pistol', 'rocket'] as const) {
      const world = bareWorld()
      fillTiles(world.grid, 15, 17, 15, 21, 'concrete')
      const guard = addGuard(world, 32, 22, -1)
      shoot(world, centerOf(guard), tool)
      expect(guard.hp).toBe(guard.maxHp)
      if (tool === 'rocket') expect(world.effects.flashes.find((f) => f.kind === 'explosion')!.x).toBeLessThan(16)
    }
  })

  it('passes scenery outside the walking lane but can still shoot it deliberately', () => {
    const world = bareWorld()
    fillTiles(world.grid, 15, 17, 15, 21, 'concrete')
    for (let y = 17; y <= 21; y += 1) setLaneFlags(world.grid, 15, y, CLEAR_OF_LANE)
    const guard = addGuard(world, 32, 22, -1)
    shoot(world, centerOf(guard))
    expect(guard.hp).toBeLessThan(guard.maxHp)
    const hp = world.grid.hp[21 * world.grid.width + 15]
    world.player.cooldown = 0
    shoot(world, { x: 15.5, y: 21.5 })
    expect(world.grid.hp[21 * world.grid.width + 15]).toBeLessThan(hp)
  })

  it('cannot send a rocket through a floor to the cursor below it', () => {
    const world = bareWorld()
    world.player.y = 6
    fillTiles(world.grid, 1, 14, 58, 14, 'concrete')
    shoot(world, { x: 30, y: 21 }, 'rocket')
    const blast = world.effects.flashes.find((flash) => flash.kind === 'explosion')!
    expect(blast.y).toBeGreaterThanOrEqual(14)
    expect(blast.y).toBeLessThan(15)
  })

  it('leaves guard fire subject to ordinary cover even if a target is supplied', () => {
    const world = bareWorld()
    const cabinet = addProp(world, 'filingCabinet', 15, 22)
    const hp = cabinet.hp
    fireShot(world, { x: 8, y: 21 }, { x: 1, y: 0 }, { ...GUNS.pistol!.shot, fromPlayer: false, spread: 0, aimPoint: { x: 35, y: 21 } })
    for (let frame = 0; frame < 60; frame += 1) stepProjectiles(world, 1 / 60)
    expect(cabinet.hp).toBeLessThan(hp)
  })
})

describe('forgiving person aiming', () => {
  it('corrects a near miss toward the guard, but ignores distant, hidden, unconscious and dead targets', () => {
    const world = bareWorld()
    const guard = addGuard(world, 30, 22, -1)
    const cursor = { x: guard.x + guard.w + 0.4, y: guard.y + 0.7 }
    expect(resolveAim(world, handOf(world), cursor).guard).toBe(guard)
    for (const state of [{ hiddenIn: 1 }, { hiddenIn: null, out: true }, { out: false, mode: 'dead' as const }]) {
      Object.assign(guard, state)
      expect(resolveAim(world, handOf(world), cursor).guard).toBeNull()
    }
    guard.mode = 'calm'
    expect(resolveAim(world, handOf(world), { x: cursor.x + 2, y: cursor.y }).guard).toBeNull()
  })

  it('does not snap through solid cover and keeps head and body aim distinct', () => {
    const world = bareWorld()
    const guard = addGuard(world, 30, 22, -1)
    const head = { x: guard.x + guard.w / 2, y: guard.y + 0.25 }
    const body = centerOf(guard)
    expect(resolveAim(world, handOf(world), head).point.y).toBeLessThan(resolveAim(world, handOf(world), body).point.y)
    fillTiles(world.grid, 15, 17, 15, 21, 'concrete')
    expect(resolveAim(world, handOf(world), head).guard).toBeNull()
  })

  it('caps single-round error at the cursor, keeps shotgun spread and makes rockets precise', () => {
    expect(Math.tan(playerShotSpread(GUNS.rifle!, 0.14, 40)) * 40).toBeCloseTo(0.18)
    expect(playerShotSpread(GUNS.shotgun!, 0.1, 40)).toBeCloseTo(GUNS.shotgun!.shot.spread + 0.1)
    expect(playerShotSpread(GUNS.rocket!, 0.14, 40)).toBe(0)
  })
})
