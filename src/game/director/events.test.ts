import { describe, expect, it } from 'vitest'
import { deviceState } from '../devices/state'
import { stunGuard } from '../guards'
import { surrender } from '../security/fear'
import { feetOf, isActive } from '../security/model'
import { deviceFeet, roomOf } from '../security/places'
import { createRng } from '../rng'
import { EVENTS } from './events/registry'
import { buildingCircuits, fuseBoxOf } from './power'
import { directedWorld, idle, standingAt } from './testWorld'
import type { EventId } from './types'
import { watchSignals } from './watch'

const event = (id: EventId) => EVENTS.find((def) => def.id === id)!
const rng = createRng(7)

describe('director events, each through public game state', () => {
  it('a smoke break sends a patrol up to a roof, and he comes back after his cigarette', () => {
    const world = directedWorld(2, 'complex', [])
    const running = event('smokeBreak').start(world, rng)!
    const smoker = world.guards.find((guard) => guard.station !== null)!
    expect(roomOf(world, smoker.station!)?.kind).toBe('rooftop')
    let done = false
    for (let second = 0; second < 140 && !done; second += 1) {
      idle(world, 1)
      done = running.step(world, 1)
    }
    expect(done).toBe(true)
    expect(running.outcome()).toMatch(/cigarette/)
  })

  it('a smoke break cut short by a knock on the head leaves no errand behind', () => {
    const world = directedWorld(2, 'complex', [])
    const running = event('smokeBreak').start(world, rng)!
    const smoker = world.guards.find((guard) => guard.station !== null)!
    stunGuard(smoker, 2)
    expect(running.step(world, 0.1)).toBe(true)
    expect(running.outcome()).toMatch(/never finished/)
    expect(smoker.station).toBeNull()
  })

  it('a blackout darkens the player\'s building for half a minute, then the power comes back', () => {
    const world = directedWorld(2, 'complex', [])
    const lobby = world.rooms.find((room) => room.building === 'tower' && room.kind === 'office')!
    Object.assign(world.player, standingAt(world, { x: lobby.x + 2, y: lobby.floorY }))
    const running = event('blackout').start(world, rng)!
    const circuits = buildingCircuits(world, 'tower')
    expect(circuits.every((circuit) => world.deadCircuits.has(circuit))).toBe(true)
    running.step(world, 31)
    expect(circuits.some((circuit) => world.deadCircuits.has(circuit))).toBe(false)
  })

  it('a phone call takes the operator out of the security room', () => {
    const world = directedWorld(2, 'complex', [])
    const running = event('phoneCall').start(world, rng)
    expect(running).not.toBeNull()
    const operator = world.guards.find((guard) => guard.station !== null)!
    expect(roomOf(world, feetOf(operator))?.kind).toBe('security')
    expect(roomOf(world, operator.station!)?.kind).not.toBe('security')
  })

  it('a patrol swap trades two patrols\' rounds on different floors', () => {
    const world = directedWorld(2, 'complex', [])
    const homes = world.guards.map((guard) => guard.home)
    event('patrolSwap').start(world, rng)
    const moved = world.guards.filter((guard, index) => guard.home !== homes[index])
    expect(moved).toHaveLength(2)
    expect(moved[0].home).toBe(homes[world.guards.indexOf(moved[1])])
  })

  it('a bored guard only wanders once the player has gone unseen a long while', () => {
    const world = directedWorld(2, 'complex', [])
    expect(event('wanderer').ready(world)).toBe(false)
    idle(world, 105)
    watchSignals(world)
    expect(event('wanderer').ready(world)).toBe(true)
    const running = event('wanderer').start(world, rng)
    expect(running).not.toBeNull()
    const walker = world.guards.find((guard) => guard.station !== null && guard.mode === 'calm')!
    expect(Math.abs(walker.station!.y - walker.home.y)).toBeGreaterThan(1)
  })

  it('two guards meet to chat in a room near the player', () => {
    const world = directedWorld(2, 'complex', [])
    const office = world.rooms.filter((room) => room.building === 'tower' && room.storey === 5 && room.kind !== 'stairwell').sort((a, b) => b.w - a.w)[0]
    Object.assign(world.player, standingAt(world, { x: office.x + 2, y: office.floorY }))
    const running = event('chatter').start(world, createRng(3))
    expect(running).not.toBeNull()
    const pair = world.guards.filter((guard) => guard.station !== null)
    expect(pair).toHaveLength(2)
    expect(Math.abs(pair[0].station!.x - pair[1].station!.x)).toBeLessThan(2)
    expect(Math.abs(pair[0].station!.y - office.floorY)).toBeLessThan(1)
  })

  it('after the first body is reported, guards sweep that floor', () => {
    const world = directedWorld(2, 'complex', [])
    expect(event('sweep').ready(world)).toBe(false)
    const victim = world.guards.find((guard) => guard.role === 'patrol' && roomOf(world, feetOf(guard))?.building === 'tower')!
    victim.hp = 0
    victim.mode = 'dead'
    world.security.reportedBodies.add(world.guards.indexOf(victim))
    expect(event('sweep').ready(world)).toBe(true)
    const searchingBefore = world.guards.filter((guard) => guard.mode === 'searching').length
    expect(event('sweep').start(world, rng)).not.toBeNull()
    expect(world.guards.filter((guard) => guard.mode === 'searching').length).toBeGreaterThan(searchingBefore)
  })

  it('when the guards order the case moved, a courier runs for the new place', () => {
    const world = directedWorld(2, 'complex', [])
    Object.assign(world.intel.move, { ordered: true, to: (world.intel.real + 1) % world.intel.places.length })
    expect(event('courier').ready(world)).toBe(true)
    expect(event('courier').start(world, rng)).not.toBeNull()
    const place = world.intel.places[world.intel.move.to!]
    expect(world.guards.some((guard) => guard.station && Math.abs(guard.station.y - place.floorY) < 0.5)).toBe(true)
  })

  it('a fire that takes hold empties its building floor by floor and unlocks the doors', () => {
    const world = directedWorld(2, 'complex', [])
    const room = world.rooms.find((candidate) => candidate.building === 'tower' && candidate.storey === 6 && candidate.kind === 'office')!
    world.hazards.roomFire.set(room.id, 10)
    expect(event('evacuation').ready(world)).toBe(true)
    const unlocked = deviceState(world).unlockedDoors.size
    const running = event('evacuation').start(world, rng)!
    running.step(world, 30)
    expect(world.guards.filter((guard) => guard.station && Math.abs(guard.station.y - world.groundY) < 0.5).length).toBeGreaterThan(3)
    expect(deviceState(world).unlockedDoors.size).toBeGreaterThan(unlocked)
  })

  it('cutting the power twice brings the engineer to the dead fuse box', () => {
    const world = directedWorld(2, 'complex', [])
    const boxes = world.devices.filter((device) => device.kind === 'fusebox' && device.circuit !== undefined)
    world.deadCircuits.add(boxes[0].circuit!)
    watchSignals(world)
    world.deadCircuits.add(boxes[1].circuit!)
    watchSignals(world)
    expect(world.director.signals.powerCuts).toBe(2)
    expect(event('engineer').ready(world)).toBe(true)
    expect(event('engineer').start(world, rng)).not.toBeNull()
    const tech = world.guards.find((guard) => guard.station !== null)!
    const box = fuseBoxOf(world, [...world.deadCircuits][0])!
    expect(Math.abs(tech.station!.x - (box.x + 0.5))).toBeLessThan(1)
  })

  it('a knocked-out guard who comes round staggers for the alarm button', () => {
    const world = directedWorld(2, 'complex', [])
    const onButtonFloor = (candidate: (typeof world.guards)[number]) => world.devices.some((device) => device.kind === 'alarmButton' && Math.abs(deviceFeet(world, device).y - feetOf(candidate).y) < 1 && Math.abs(device.x - feetOf(candidate).x) < 40)
    const guard = world.guards.find((candidate) => isActive(candidate) && candidate.mode === 'calm' && onButtonFloor(candidate))!
    expect(guard).toBeDefined()
    stunGuard(guard, 45)
    watchSignals(world)
    guard.stunSeconds = 0
    watchSignals(world)
    expect(event('crawler').ready(world)).toBe(true)
    expect(event('crawler').start(world, rng)).not.toBeNull()
    expect(guard.station).not.toBeNull()
  })

  it('a guard who gave up with the intruder over him offers what he knows, then his keycard', () => {
    const world = directedWorld(2, 'complex', [])
    const [first, second] = world.guards.filter((guard) => guard.role === 'patrol' && roomOf(world, feetOf(guard))?.building === 'tower')
    surrender(world, first)
    Object.assign(world.player, standingAt(world, { x: feetOf(first).x + 1, y: feetOf(first).y }))
    expect(event('deal').ready(world)).toBe(true)
    const clues = world.intel.clues.length
    expect(event('deal').start(world, rng)!.outcome()).toMatch(/knew/)
    expect(world.intel.clues.length).toBe(clues + 1)
    world.intel.questioned.add(second)
    surrender(world, second)
    Object.assign(world.player, standingAt(world, { x: feetOf(second).x + 1, y: feetOf(second).y }))
    const unlocked = deviceState(world).unlockedDoors.size
    expect(event('deal').start(world, rng)!.outcome()).toMatch(/keycard/)
    expect(deviceState(world).unlockedDoors.size).toBeGreaterThanOrEqual(unlocked)
  })

  it('a loyal guard who gave up offers his keycard, never "what he knows" only to refuse it', () => {
    const world = directedWorld(2, 'complex', [])
    const guard = world.guards.find((candidate) => candidate.role === 'patrol' && world.people?.byGuard.get(candidate)?.roster)!
    world.people!.byGuard.get(guard)!.traits.push('loyal')
    surrender(world, guard)
    guard.nerve = 0.5
    Object.assign(world.player, standingAt(world, { x: feetOf(guard).x + 1, y: feetOf(guard).y }))
    const clues = world.intel.clues.length
    expect(event('deal').start(world, rng)!.outcome()).toMatch(/keycard/)
    expect(world.intel.clues.length).toBe(clues)
  })
})
