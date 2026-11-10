import { describe, expect, it } from 'vitest'
import { markLampShot } from '../ballistics/lampState'
import { scrapeNoise } from '../guards'
import { throwGrenade } from '../hazards/hazards'
import { openDoor } from '../interact'
import { emitNoise } from '../noise'
import { fillTiles, setTile } from '../tiles'
import type { World } from '../world'
import { feetOf, setMode } from './model'
import { addDevice, addGuard, addLamp, addRoom, arena, GROUND, putPlayer, run, runListening } from './testArena'
import { DISCOVERY } from './tuning'

const saidAny = (lines: string[], words: string[]) => lines.some((line) => words.some((word) => line.includes(word)))

/** A wall at x 50 with a shut, locked door in it. */
function doorAt50(world: World): void {
  fillTiles(world.grid, 50, GROUND - 6, 50, GROUND - 4, 'brick')
  fillTiles(world.grid, 50, GROUND - 3, 50, GROUND - 1, 'door')
}

describe('things out of place', () => {
  it('a door the player picked open is noticed, called in as a forced lock, and searched around', () => {
    const world = arena()
    putPlayer(world, 140)
    doorAt50(world)
    const guard = addGuard(world, 45, 1)
    run(world, 0.5)
    openDoor(world.grid, { x: 50, y: GROUND - 1 })
    const lines = runListening(world, 20)
    expect(saidAny(lines, ['picked', 'forced', 'Scratches'])).toBe(true)
    expect(world.security.level).toBe(2)
    expect(world.security.log.some((line) => line.includes('forced lock'))).toBe(true)
    expect(guard.mode).toBe('searching')
  })

  it('a door a guard opened himself is not reported by his colleagues', () => {
    const world = arena()
    putPlayer(world, 140)
    doorAt50(world)
    const walker = addGuard(world, 46, 1, 'patrol')
    walker.route = [{ x: 46.5, y: GROUND }, { x: 56.5, y: GROUND }]
    const watcher = addGuard(world, 44, 1)
    run(world, 30)
    expect(world.security.level).toBe(0)
    expect(watcher.mode).toBe('calm')
  })

  it('a camera cut a while ago shows as a dead feed to whoever watches the monitors, and someone is sent', () => {
    const world = arena()
    putPlayer(world, 140)
    addRoom(world, { kind: 'security', building: 'b', x: 2, w: 20, floorY: GROUND })
    addGuard(world, 10, 1, 'operator')
    const spare = addGuard(world, 40, 1, 'patrol')
    spare.route = [{ x: 35.5, y: GROUND }, { x: 45.5, y: GROUND }]
    const camera = addDevice(world, { kind: 'camera', x: 70, y: GROUND - 5, facing: -1, roomId: 0 })
    camera.disabled = true
    run(world, DISCOVERY.cameraFaultSeconds - 2)
    expect(world.security.level).toBe(0)
    run(world, 4)
    expect(world.security.log.some((line) => line.includes('camera feed'))).toBe(true)
    expect(world.security.level).toBe(1)
    expect(spare.interest?.kind).toBe('order')
  })

  it('finding the gold gone is radioed in at once and confirms an intruder', () => {
    const world = arena()
    putPlayer(world, 140)
    addLamp(world, 40)
    Object.assign(world.loot, { x: 40, y: GROUND - 0.8, taken: true })
    addGuard(world, 34, 1)
    const lines = runListening(world, 5)
    expect(saidAny(lines, ['vault', 'gold', 'Vault'])).toBe(true)
    expect(world.security.level).toBeGreaterThanOrEqual(3)
  })

  it('a parachute coming down is seen from far off, even at night, and reported', () => {
    const world = arena()
    putPlayer(world, 20, GROUND - 14)
    world.player.chute = true
    addGuard(world, 40, -1)
    const lines = runListening(world, 4, { jumpHeld: true })
    expect(saidAny(lines, ['Parachute', 'chute', 'sky'])).toBe(true)
    expect(world.security.level).toBeGreaterThanOrEqual(2)
  })

  it('a rope down the facade is reported, and a guard who reaches its knot cuts it', () => {
    const world = arena()
    putPlayer(world, 140)
    fillTiles(world.grid, 60, GROUND - 10, 80, GROUND - 1, 'concrete')
    for (let y = GROUND - 11; y <= GROUND - 1; y += 1) setTile(world.grid, 81, y, 'ladder')
    world.ropes.push({ x: 81, top: GROUND - 11, bottom: GROUND - 1, anchor: { x: 80, y: GROUND - 10 } })
    addGuard(world, 70, 1, 'post', GROUND - 10)
    const lines = runListening(world, 15, {}, () => world.ropes.length === 0)
    expect(saidAny(lines, ['rope', 'Rope', 'tied'])).toBe(true)
    expect(world.ropes.length).toBe(0)
    expect(world.security.level).toBe(2)
  })

  it('a smoke grenade\'s screen gets one guard to look; he knows a canister when he sees one and starts searching', () => {
    const world = arena()
    putPlayer(world, 140)
    const guard = addGuard(world, 38, 1)
    const other = addGuard(world, 36, 1)
    throwGrenade(world, 'smoke', { x: 46, y: GROUND - 1 }, { x: 0, y: 1 })
    const lines = runListening(world, 35, {}, () => guard.mode === 'searching' || other.mode === 'searching')
    expect(saidAny(lines, ['smoke canister', 'Smoke grenade'])).toBe(true)
    expect([guard, other].filter((one) => one.mode === 'searching').length).toBe(1)
  })

  it('a lamp shot out is noticed by a guard nearby, like a dark circuit', () => {
    const world = arena()
    putPlayer(world, 140)
    addLamp(world, 40)
    const guard = addGuard(world, 36, 1)
    markLampShot(world, world.lamps[0])
    const lines = runListening(world, 1)
    expect(guard.interest?.kind).toBe('lightsOut')
    expect(saidAny(lines, ['shot the light', 'shot out', 'that lamp'])).toBe(true)
  })

  it('furniture scraping sends one guard to look, and he says what it sounded like', () => {
    const world = arena()
    putPlayer(world, 140)
    const guards = [40, 42].map((x) => addGuard(world, x, 1))
    scrapeNoise(world, { x: 46, y: GROUND - 0.5 })
    const lines = runListening(world, 0.5)
    expect(guards.filter((guard) => guard.mode === 'noticed').length).toBe(1)
    expect(saidAny(lines, ['furniture', 'scraping', 'dragging'])).toBe(true)
  })

  it('a thrown clatter far from the player pulls a rookie over, but a veteran on edge turns the other way', () => {
    const world = arena()
    putPlayer(world, 20)
    const rookie = addGuard(world, 40, 1, 'post', GROUND, 'rookie')
    emitNoise(world, { x: 50, y: GROUND - 0.5 }, 14)
    run(world, 0.2)
    expect(rookie.interest?.kind).toBe('noise')

    const other = arena()
    putPlayer(other, 20)
    const veteran = addGuard(other, 40, 1, 'post', GROUND, 'veteran')
    setMode(veteran, 'caution')
    emitNoise(other, { x: 50, y: GROUND - 0.5 }, 14)
    const lines = runListening(other, 0.5)
    expect(veteran.interest).toBeNull()
    expect(veteran.facing).toBe(-1)
    expect(saidAny(lines, ['Nice try', 'Old trick', 'Throwing things'])).toBe(true)
    expect(Math.abs(feetOf(veteran).x - 40)).toBeLessThan(1)
  })
})
