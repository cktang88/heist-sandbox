import { describe, expect, it } from 'vitest'
import { costInReferenceUnits } from './benchmark'
import { elevatorRefuses, groundStop, shaftOf } from './elevators'
import { explode, ROCKET_BLAST } from './explosions'
import { idleInput, type Input } from './input'
import { feetOf, type Guard } from './security/model'
import { stepWorld } from './step'
import { createWorld, type World } from './world'

/**
 * The whole site playing together: every system stepping at once on the big complex.
 * These are slower than unit tests; each covers a full heist situation from start to end.
 */

const FRAME = 1 / 60

function play(world: World, seconds: number, input: Partial<Input> = {}, each?: () => boolean | void): void {
  for (let frame = 0; frame < Math.round(seconds / FRAME); frame += 1) {
    stepWorld(world, { ...idleInput({ x: world.player.x + 5, y: world.player.y }), ...input }, FRAME)
    if (each?.()) return
  }
}

/** Puts the player's feet at a spot, standing still. */
function placePlayer(world: World, x: number, feetY: number): void {
  Object.assign(world.player, { x: x - world.player.w / 2, y: feetY - world.player.h - 0.01, vx: 0, vy: 0, chute: false })
}

const storeyOf = (world: World, feetY: number) => Math.round((world.groundY - feetY) / 6)

describe('the whole site', () => {
  it('a quiet run: take down the vault guard, cut the camera, take the gold and get out without the alert level moving', () => {
    const world = createWorld(1, 'complex')
    world.player.hp = 1e6
    const vault = world.rooms.find((room) => room.kind === 'vault')!
    const heavy = world.guards.find((guard) => guard.role === 'heavy' && guard.roomId === vault.id)!
    const camera = world.devices.find((device) => device.kind === 'camera' && device.roomId === vault.id)!
    // Behind the heavy, who faces into the vault.
    placePlayer(world, feetOf(heavy).x - heavy.facing * 0.9, vault.floorY)
    play(world, FRAME)
    expect(world.prompt).toBe('E: take down')
    play(world, FRAME, { interact: true, interactPressed: true })
    expect(heavy.mode).toBe('dead')

    placePlayer(world, camera.x + 0.5, vault.floorY)
    play(world, 1.3, { interact: true })
    expect(camera.disabled).toBe(true)

    const toLoot = world.loot.x > world.player.x ? { right: true } : { left: true }
    play(world, 6, toLoot, () => world.player.hasLoot)
    expect(world.player.hasLoot).toBe(true)

    // The route out of the building is the player's business; arrive on the street beside the van and walk in.
    const zone = world.extraction
    const fromRight = zone.x < world.grid.width / 2
    placePlayer(world, fromRight ? zone.x + zone.w + 1.5 : zone.x - 1.5, world.groundY)
    play(world, 3, fromRight ? { left: true } : { right: true }, () => world.status !== 'playing')

    expect(world.status).toBe('won')
    expect(world.security.log).toEqual([])
    expect(world.security.level).toBe(0)
    expect(world.stats.timesSpotted).toBe(0)
    expect(world.guards.filter((guard) => guard.mode !== 'calm' && guard.mode !== 'dead')).toEqual([])
  })

  it('a loud run: a blast near guards raises the site, guards converge on the last known position by the stairs, the response team comes and the elevators are held', () => {
    const world = createWorld(1, 'complex')
    world.player.hp = 1e6
    const room = world.rooms.filter((candidate) => candidate.building === 'tower' && candidate.storey === 6 && candidate.kind !== 'stairwell').sort((a, b) => b.w - a.w)[0]
    const spot = { x: room.x + room.w / 2, y: room.floorY }
    placePlayer(world, spot.x, spot.y)
    world.lamps.push({ x: spot.x, y: room.floorY - 3, fixture: 'floodlight', color: 0xffffff, radius: 10, strength: 2, hung: false })
    const startFloors = world.guards.map((guard) => storeyOf(world, guard.home.y))
    const responderCount = () => world.guards.filter((guard) => guard.armored && guard.role === 'patrol').length
    play(world, 0.5)

    explode(world, { x: spot.x + 6, y: room.floorY - 3 }, ROCKET_BLAST)
    play(world, 5)
    expect(world.security.level).toBeGreaterThanOrEqual(2)
    for (const car of world.elevatorCars) expect(elevatorRefuses(world, car)).toBe(true)

    // Guards come to look and find the player standing in the light.
    const climbed = new Set<Guard>()
    play(world, 40, {}, () => {
      for (const guard of world.guards) if (guard.stairs) climbed.add(guard)
      return world.security.level >= 3
    })
    expect(world.security.level).toBeGreaterThanOrEqual(3)
    expect(world.alarm).toBe(true)
    expect(responderCount()).toBe(3)
    const lastKnown = world.security.lastKnown!
    expect(storeyOf(world, lastKnown.y + 1)).toBe(6)

    // He slips away; the force converges on where he was last seen.
    placePlayer(world, world.extraction.x + 1, world.groundY)
    let mostNear = 0
    let respondersArrived = false
    play(world, 60, {}, () => {
      for (const guard of world.guards) if (guard.stairs) climbed.add(guard)
      const near = world.guards.filter((guard) => guard.mode !== 'dead' && Math.abs(feetOf(guard).y - room.floorY) < 0.5 && Math.abs(feetOf(guard).x - lastKnown.x) < 20)
      mostNear = Math.max(mostNear, near.length)
      respondersArrived ||= near.some((guard) => guard.armored && guard.role === 'patrol')
    })
    const fromOtherFloors = [...climbed].filter((guard) => startFloors[world.guards.indexOf(guard)] !== 6)
    expect(mostNear).toBeGreaterThanOrEqual(5)
    expect(fromOtherFloors.length).toBeGreaterThanOrEqual(3)
    expect(respondersArrived).toBe(true)
    // Recalled to the street storey and held there.
    for (const car of world.elevatorCars) {
      expect(car.moving).toBe(false)
      expect(car.stop).toBe(groundStop(world, shaftOf(world, car)))
    }
  })

  it.each([1, 2])('seed %i: a minute of the whole site with the player idle stays calm, every guard on post or route, and runs fast', (seed) => {
    const world = createWorld(seed, 'complex')
    world.player.hp = 1e6
    const zone = world.extraction
    placePlayer(world, zone.x + zone.w / 2, world.groundY)
    const lastMoved = world.guards.map(() => ({ at: feetOf(world.guards[0]), since: 0 }))
    world.guards.forEach((guard, index) => (lastMoved[index] = { at: feetOf(guard), since: 0 }))
    const offFloorSince = world.guards.map(() => -1)
    const problems: string[] = []

    const check = () => {
      world.guards.forEach((guard, index) => {
        const feet = feetOf(guard)
        const name = `guard ${index} (${guard.role}, ${guard.mode}) at ${feet.x.toFixed(1)},${feet.y.toFixed(1)}`
        if (!Number.isFinite(feet.x) || !Number.isFinite(feet.y) || feet.y > world.grid.height) problems.push(`${name} is lost`)
        if (guard.mode === 'dead') problems.push(`${name} died`)
        if (Math.abs(feet.x - lastMoved[index].at.x) + Math.abs(feet.y - lastMoved[index].at.y) > 0.3) lastMoved[index] = { at: feet, since: world.clock }
        const walking = guard.role === 'patrol' && guard.mode === 'calm' && guard.wait <= 0
        if (walking && world.clock - lastMoved[index].since > 20) problems.push(`${name} has walked into something for 20 s`)
        const away = Math.abs(feet.y - guard.home.y) > 1.5 && !guard.stairs
        offFloorSince[index] = away ? (offFloorSince[index] < 0 ? world.clock : offFloorSince[index]) : -1
        if (offFloorSince[index] >= 0 && world.clock - offFloorSince[index] > 20) problems.push(`${name} has left his floor`)
      })
    }

    for (let second = 0; second < 60; second += 1) {
      play(world, 1)
      check()
      if (problems.length > 0) break
    }
    expect(problems).toEqual([])
    // Guards' own footsteps, doors and radio chatter never set colleagues investigating each other.
    expect(world.guards.filter((guard) => guard.mode !== 'calm').map((guard) => `${guard.role} ${guard.mode} ${guard.interest?.kind}`)).toEqual([])
    expect(world.security.level).toBe(0)
    expect(world.status).toBe('playing')
    // A frame of the whole idle site costs a few reference workloads (benchmark.ts); budget well above that.
    expect(costInReferenceUnits(() => stepWorld(world, idleInput(), FRAME), 30, 6)).toBeLessThan(10)
  })
})
