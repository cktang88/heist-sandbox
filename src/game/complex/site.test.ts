import { describe, expect, it } from 'vitest'
import type { Level } from '../site'
import { windowAt } from '../grapple/windows'
import { tileAt } from '../tiles'
import { createWorld } from '../world'
import { createComplex } from './complex'
import { shaftWatchProblems } from './shaftWatch'
import { STOREY } from './kit'
import { CAMERAS } from '../security/tuning'
import { cameraBlindSpots, doorsBlockedByDevices, hidesPerStorey, quietEntries } from '../stealthRuns/audit'
import {
  caseRoomProblems, deviceProblems, dropZone, fixtureProblems, guardProblems, propProblems, reachable, reachedRoom, reachedSpot, roomProblems,
  sewerProblems, siteFor,
} from './audit'

/** Odd and even seeds: even ones are mirrored, and must pass the same checks. */
const SEEDS = Array.from({ length: 40 }, (_, index) => index + 1)
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

  it.each(SEEDS)('seed %i lets the player reach every room, supply and terminal from the drop zone', (seed) => {
    const level = site(seed)
    const seen = reachable(level, dropZone(level), 'player')
    expect(level.rooms.filter((room) => !reachedRoom(level, seen, room)).map((room) => roomName(level, room.id))).toEqual([])
    expect(level.pickups.filter((pickup) => !reachedSpot(level, seen, pickup.x, pickup.y))).toEqual([])
    expect(level.devices.filter((device) => device.kind === 'computer' && !reachedSpot(level, seen, device.x, device.y))).toEqual([])
  })

  it.each(SEEDS)('seed %i lets an alerted guard reach every room, post, patrol point and device from the tower stairs, without elevators', (seed) => {
    const level = site(seed)
    const seen = reachable(level, towerStairs(level), 'guard')
    expect(level.rooms.filter((room) => !reachedRoom(level, seen, room)).map((room) => roomName(level, room.id))).toEqual([])
    const spots = level.guards.flatMap((guard) => [guard, ...(guard.route ?? [])])
    expect(spots.filter((spot) => !reachedSpot(level, seen, spot.x, spot.y)).map((spot) => `${spot.x},${spot.y}`)).toEqual([])
    // Restoring power, raising the alarm, working a terminal or a keypad: each from the floor of its room.
    const floorOf = (device: Level['devices'][number]) => level.rooms[device.roomId!].floorY
    const devices = level.devices.filter((device) => device.kind !== 'camera' && !reachedSpot(level, seen, device.x, floorOf(device)))
    expect(devices.map((device) => `${device.kind} at ${device.x},${device.y}`)).toEqual([])
  })

  it.each(SEEDS)('seed %i leaves every elevator door and shaft maintenance door unwatched: no post in view, no patrol turning beside it', (seed) => {
    const level = site(seed)
    expect(shaftWatchProblems(level.grid, level.elevators, level.guards)).toEqual([])
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

describe('the generated complex, for a quiet player', () => {
  it.each(SEEDS)('seed %i lets every room the case could be in be reached, left for the van, and entered two quiet ways', (seed) => {
    expect(caseRoomProblems(site(seed))).toEqual([])
  })

  it.each(SEEDS)('seed %i joins the sewer from the street manholes to the tower basement', (seed) => {
    expect(sewerProblems(site(seed))).toEqual([])
  })

  it.each(SEEDS)('seed %i offers three quiet ways into the tower, hides on every storey and a blind spot under every camera', (seed) => {
    const level = site(seed)
    const entries = quietEntries(level)
    expect(entries.length, entries.join(', ')).toBeGreaterThanOrEqual(3)
    expect(entries).toContain('sewer hatch')
    expect([...hidesPerStorey(level, 'tower')].filter(([, count]) => count < 3)).toEqual([])
    expect(level.devices.filter((device) => device.kind === 'camera' && cameraBlindSpots(level, device, CAMERAS).length === 0)).toEqual([])
    expect(doorsBlockedByDevices(level)).toEqual([])
  })
})

describe('outer-wall windows', () => {
  it.each([1, 2, 3, 4, 13, 18])('seed %i lets the player climb in through every window from outside', (seed) => {
    const world = createWorld(seed, 'complex')
    const problems: string[] = []
    for (const building of world.interiors.filter((area) => area.kind === 'room' && area.h > STOREY)) {
      for (const [wall, outside] of [[building.x, -1], [building.x + building.w - 1, 1]] as const) {
        for (let row = building.y; row < building.y + building.h; row += 1) {
          if (tileAt(world.grid, wall, row) !== 'glass' || tileAt(world.grid, wall, row - 1) === 'glass') continue
          const spot = windowAt(world, wall, row, -outside as 1 | -1)
          if (!spot?.footing || spot.bottom - spot.top !== 2) problems.push(`window at ${wall},${row}`)
        }
      }
    }
    expect(problems).toEqual([])
  })
})

describe('a mirrored complex', () => {
  it('turns every prop to face the other way, along with guards, devices and elevator doors', () => {
    const [built, flipped] = [createComplex(2), site(2)]
    built.props.forEach((prop, index) => expect(flipped.props[index].flip, prop.kind).toBe(!prop.flip))
    built.guards.forEach((guard, index) => expect(flipped.guards[index].facing).toBe(-guard.facing))
    built.elevators.forEach((shaft, index) => expect(flipped.elevators[index].doorSide).toBe(-shaft.doorSide))
    built.devices.forEach((device, index) => expect(flipped.devices[index].facing).toBe(device.facing === undefined ? undefined : -device.facing))
  })
})

describe('the outpost', () => {
  it.each(SEEDS)('seed %i puts every lamp and prop where it can be, and can be won', (seed) => {
    const level = site(seed, 'outpost')
    expect(propProblems(level)).toEqual([])
    expect(fixtureProblems(level)).toEqual([])
    expect(reachedSpot(level, reachable(level, dropZone(level), 'player'), level.loot.x, level.loot.y)).toBe(true)
    const back = reachable(level, level.loot, 'player')
    const { extraction: van } = level
    expect(Array.from({ length: van.w }, (_, index) => van.x + index).some((x) => reachedSpot(level, back, x, van.y + van.h))).toBe(true)
  })
})
