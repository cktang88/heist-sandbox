import { describe, expect, it } from 'vitest'
import type { Level } from '../site'
import {
  deviceProblems, dropZone, fixtureProblems, guardProblems, propProblems, reachable, reachedRoom, reachedSpot, roomProblems, siteFor,
} from './audit'

/** Odd and even seeds: even ones are mirrored, and must pass the same checks. */
const SEEDS = [1, 2, 3, 4, 5, 12, 13, 18]
const sites = new Map<string, Level>()
function site(seed: number, kind: 'complex' | 'outpost' = 'complex'): Level {
  const key = `${kind}:${seed}`
  if (!sites.has(key)) sites.set(key, siteFor(seed, kind))
  return sites.get(key)!
}

/** The bottom landing of the tower's main stairs, at street level: where the security force musters. */
function towerStairs(level: Level): { x: number; y: number } {
  const well = level.stairwells.find((candidate) => candidate.building === 'tower')!
  return { x: Math.floor(well.leftX), y: level.groundY }
}

const roomName = (level: Level, id: number) => {
  const room = level.rooms[id]
  return `${room.kind} ${room.id} (${room.building}:${room.storey} x${room.x}-${room.x + room.w - 1})`
}

describe('the generated complex', () => {
  it.each(SEEDS)('seed %i puts every prop where it can physically be', (seed) => {
    expect(propProblems(site(seed))).toEqual([])
  })

  it.each(SEEDS)('seed %i puts every lamp, device, pickup and guard where it can be', (seed) => {
    expect(fixtureProblems(site(seed))).toEqual([])
  })

  it.each(SEEDS)('seed %i furnishes and lights every room, with the lights on a switch or fuse box', (seed) => {
    expect(roomProblems(site(seed))).toEqual([])
  })

  it.each(SEEDS)('seed %i wires every device to something that uses it', (seed) => {
    expect(deviceProblems(site(seed))).toEqual([])
  })

  it.each(SEEDS)('seed %i posts guards in their rooms on routes a calm guard can walk', (seed) => {
    expect(guardProblems(site(seed))).toEqual([])
  })

  it.each(SEEDS)('seed %i lets the player reach every room from the drop zone', (seed) => {
    const level = site(seed)
    const seen = reachable(level, dropZone(level), 'player')
    expect(level.rooms.filter((room) => !reachedRoom(level, seen, room)).map((room) => roomName(level, room.id))).toEqual([])
  })

  it.each(SEEDS)('seed %i lets an alerted guard reach every room and every post from the tower stairs, without elevators', (seed) => {
    const level = site(seed)
    const seen = reachable(level, towerStairs(level), 'guard')
    expect(level.rooms.filter((room) => !reachedRoom(level, seen, room)).map((room) => roomName(level, room.id))).toEqual([])
    expect(level.guards.filter((guard) => !reachedSpot(level, seen, guard.x, guard.y)).map((guard) => `${guard.role} at ${guard.x},${guard.y}`)).toEqual([])
  })

  it.each(SEEDS)('seed %i can be won: from the drop to the loot, and from the loot to the van', (seed) => {
    const level = site(seed)
    expect(reachedSpot(level, reachable(level, dropZone(level), 'player'), level.loot.x, level.loot.y)).toBe(true)
    const back = reachable(level, level.loot, 'player')
    const { extraction: van } = level
    const out = Array.from({ length: van.w }, (_, index) => van.x + index).some((x) => reachedSpot(level, back, x, van.y + van.h))
    expect(out).toBe(true)
  })
})

describe('the outpost', () => {
  it.each([1, 2, 3, 4, 5, 8])('seed %i puts every lamp and prop where it can be, and can be won', (seed) => {
    const level = site(seed, 'outpost')
    expect(propProblems(level)).toEqual([])
    expect(fixtureProblems(level)).toEqual([])
    expect(reachedSpot(level, reachable(level, dropZone(level), 'player'), level.loot.x, level.loot.y)).toBe(true)
  })
})
