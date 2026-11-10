import { describe, expect, it } from 'vitest'
import { C4_BLAST, explode } from './explosions'
import { idleInput, type Input } from './input'
import { GROUND } from './level'
import { createRng } from './rng'
import { stepWorld } from './step'
import { tileAt } from './tiles'
import { centerOf } from './types'
import { createWorld, type World } from './world'

const FRAME = 1 / 60

function run(world: World, seconds: number, input: (frame: number) => Partial<Input> = () => ({})): void {
  const frames = Math.round(seconds / FRAME)
  for (let frame = 0; frame < frames; frame += 1) {
    stepWorld(world, { ...idleInput({ x: world.player.x + 5, y: world.player.y }), ...input(frame) }, FRAME)
  }
}

/** Puts the player on the street, well away from every guard. */
function onStreet(world: World, x: number): void {
  Object.assign(world.player, { x, y: GROUND - 1.7, vx: 0, vy: 0 })
  run(world, 0.2)
}

describe('heist', () => {
  it('kills a player who drops from the plane without a parachute', () => {
    const world = createWorld(1)
    run(world, 4)
    expect(world.status).toBe('dead')
  })

  it('lands safely when the parachute is opened', () => {
    const world = createWorld(1)
    run(world, 12, (frame) => ({ jumpHeld: frame > 20 }))
    expect(world.status).toBe('playing')
    expect(world.player.hp).toBe(100)
    expect(world.player.onGround).toBe(true)
  })

  it('blows a hole in the ground with C4', () => {
    const world = createWorld(1)
    explode(world, { x: 30.5, y: GROUND + 0.5 }, C4_BLAST)
    expect(tileAt(world.grid, 30, GROUND)).toBe('air')
    expect(world.stats.tilesDestroyed).toBeGreaterThan(10)
  })

  it('picks the front door open by holding interact', () => {
    const world = createWorld(1)
    world.guards = []
    onStreet(world, 68.2)
    expect(tileAt(world.grid, 70, GROUND - 1)).toBe('door')
    run(world, 2, () => ({ interact: true }))
    expect(tileAt(world.grid, 70, GROUND - 1)).toBe('air')
    expect(tileAt(world.grid, 70, GROUND - 3)).toBe('air')
  })

  it('gets spotted by a guard who is facing the player, and the alarm follows', () => {
    const world = createWorld(1)
    const guard = world.guards.find((other) => other.homeX === 64)!
    world.guards = [guard]
    guard.facing = -1
    onStreet(world, 58)
    run(world, 1.5)
    expect(guard.state).toBe('alert')
    expect(world.stats.timesSpotted).toBe(1)
    run(world, 4)
    expect(world.alarm).toBe(true)
  })

  it('sends an alerted guard up a ladder after the player', () => {
    const world = createWorld(1)
    const guard = world.guards.find((other) => other.homeX === 64)!
    world.guards = [guard]
    Object.assign(guard, { x: 72, state: 'alert', awareness: 1, lostSeconds: 99, target: { x: 90, y: GROUND - 8 } })
    Object.assign(world.player, { x: 5, y: GROUND - 1.7, hp: 1e6 })
    world.alarm = true
    const climbed = () => GROUND - (guard.y + guard.h)
    let highest = 0
    for (let frame = 0; frame < 60 * 15; frame += 1) {
      guard.target = { x: 90, y: GROUND - 8 }
      stepWorld(world, idleInput(), FRAME)
      highest = Math.max(highest, climbed())
    }
    expect(highest).toBeGreaterThan(5)
  })

  it('calls armoured backup when the alarm rings', () => {
    const world = createWorld(1)
    const before = world.guards.length
    world.guards[0].state = 'alert'
    world.guards[0].alertSeconds = 99
    world.guards[0].target = { x: 0, y: 0 }
    Object.assign(world.player, { x: 5, y: GROUND - 1.7, hp: 1e6 })
    run(world, 0.1)
    expect(world.alarm).toBe(true)
    expect(world.guards.filter((guard) => guard.armored).length).toBe(3)
    expect(world.guards.length).toBe(before + 3)
  })

  it('takes down an unaware guard silently from behind', () => {
    const world = createWorld(1)
    const guard = world.guards.find((other) => other.homeX === 64)!
    world.guards = [guard]
    guard.facing = -1
    onStreet(world, centerOf(guard).x + 0.8)
    run(world, FRAME, () => ({ interactPressed: true }))
    expect(guard.state).toBe('dead')
    expect(world.alarm).toBe(false)
  })

  it('climbs the basement ladder up to the ground floor', () => {
    const world = createWorld(1)
    world.guards = []
    Object.assign(world.player, { x: 77.15, y: GROUND + 3, vx: 0, vy: 0 })
    run(world, 2, () => ({ up: true }))
    expect(world.player.y + world.player.h).toBeLessThan(GROUND)
    run(world, 1, () => ({ right: true }))
    expect(world.player.onGround).toBe(true)
    expect(world.player.x).toBeGreaterThan(78)
  })

  it('fires a spread of pellets from the shotgun and kicks the gun', () => {
    const world = createWorld(1)
    world.guards = []
    onStreet(world, 30)
    run(world, FRAME, () => ({ selectTool: 2, firePressed: true }))
    expect(world.projectiles.length).toBe(9)
    expect(world.player.kick).toBeGreaterThan(0.5)
    expect(new Set(world.projectiles.map((shot) => shot.vy.toFixed(3))).size).toBeGreaterThan(5)
  })

  it('reloads an empty magazine from spare rounds', () => {
    const world = createWorld(1)
    world.guards = []
    onStreet(world, 30)
    const spare = world.player.ammo[0]
    run(world, 4, (frame) => ({ firePressed: frame % 2 === 0 }))
    expect(world.player.mags[0]).toBeLessThan(12)
    run(world, 0.1, () => ({ reloadPressed: true }))
    expect(world.player.reload).toBeGreaterThan(0)
    run(world, 1.2)
    expect(world.player.mags[0]).toBe(12)
    expect(world.player.ammo[0]).toBeLessThan(spare)
  })

  it('allows one extra jump in mid-air', () => {
    const world = createWorld(1)
    world.guards = []
    onStreet(world, 30)
    run(world, FRAME, () => ({ jumpPressed: true }))
    run(world, 0.25)
    const before = world.player.vy
    run(world, FRAME, () => ({ jumpPressed: true }))
    expect(world.player.vy).toBeLessThan(before - 5)
    run(world, FRAME, () => ({ jumpPressed: true }))
    expect(world.player.airJumps).toBe(0)
  })

  it('wins when the loot reaches the extraction zone', () => {
    const world = createWorld(1)
    world.guards = []
    world.player.hasLoot = true
    onStreet(world, world.extraction.x + 2)
    expect(world.status).toBe('won')
  })

  it('survives a minute of random button mashing without breaking', () => {
    const world = createWorld(3)
    const rng = createRng(99)
    run(world, 60, (frame) => ({
      left: rng() < 0.3, right: rng() < 0.6, up: rng() < 0.2, down: rng() < 0.2,
      jumpPressed: frame === 20 || rng() < 0.03, fire: rng() < 0.5, firePressed: rng() < 0.1,
      interact: rng() < 0.3, interactPressed: rng() < 0.05, detonatePressed: rng() < 0.02, focus: rng() < 0.2,
      selectTool: rng() < 0.05 ? Math.floor(rng() * 8) : null,
      jumpHeld: rng() < 0.4,
      aim: { x: world.player.x + (rng() - 0.5) * 20, y: world.player.y + (rng() - 0.5) * 20 },
    }))
    expect(Number.isFinite(world.player.x)).toBe(true)
    expect(Number.isFinite(world.player.y)).toBe(true)
  })
})
