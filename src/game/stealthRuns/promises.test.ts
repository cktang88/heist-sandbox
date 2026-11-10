import { describe, expect, it } from 'vitest'
import { siteFor } from '../complex/audit'
import { CAMERAS } from '../security/tuning'
import type { Level } from '../site'
import { createWorld } from '../world'
import { quietWaysInto } from '../complex/access'
import { cameraBlindSpots, doorsBlockedByDevices, hidesPerStorey, quietEntries } from './audit'

/**
 * The stealth promises each generated site keeps, checked without playing it (fast). Odd and even seeds: even ones
 * are mirrored. The scripted playthroughs in heist.test.ts show the promises add up to a heist that can be ghosted.
 */

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8]
const sites = new Map<number, Level>()
const site = (seed: number) => sites.get(seed) ?? sites.set(seed, siteFor(seed, 'complex')).get(seed)!

describe('stealth promises of the generated complex', () => {
  it.each(SEEDS)('seed %i: every door can be opened from both sides (no device takes the E key beside it)', (seed) => {
    expect(doorsBlockedByDevices(site(seed))).toEqual([])
  })

  it.each(SEEDS)('seed %i: at least three different quiet ways into the tower', (seed) => {
    const entries = quietEntries(site(seed))
    expect(entries.length, entries.join(', ')).toBeGreaterThanOrEqual(3)
    expect(entries).toContain('sewer hatch')
  })

  it.each(SEEDS)('seed %i: at least two quiet ways into every room the case can be in', (seed) => {
    const world = createWorld(seed, 'complex')
    const short = world.intel.places.map((place) => ({ place, ways: quietWaysInto(world.grid, world.devices, world.rooms[place.roomId!]) })).filter(({ ways }) => ways.length < 2)
    expect(short.map(({ place, ways }) => `${place.kind} on storey ${place.storey}: ${ways.join(', ') || 'none'}`)).toEqual([])
  })

  it.each(SEEDS)('seed %i: places to hide on every storey of the tower', (seed) => {
    const thin = [...hidesPerStorey(site(seed), 'tower')].filter(([, count]) => count < 3)
    expect(thin.map(([storey, count]) => `storey ${storey}: ${count}`)).toEqual([])
  })

  it.each(SEEDS)('seed %i: every camera can be reached and cut from a spot it never sees', (seed) => {
    const level = site(seed)
    const cameras = level.devices.filter((device) => device.kind === 'camera')
    const exposed = cameras.filter((camera) => cameraBlindSpots(level, camera, CAMERAS).length === 0)
    expect(exposed.map((camera) => `camera at ${camera.x},${camera.y}`)).toEqual([])
  })
})
