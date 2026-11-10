import { describe, expect, it } from 'vitest'
import { explode } from '../explosions'
import { propById } from '../hazards/props'
import { gasAt } from '../hazards/smoke'
import { createWorld } from '../world'
import { liquidVolume } from './liquid'
import { runAll } from './testKit'

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8]

describe('accidents waiting to happen', () => {
  const worlds = SEEDS.map((seed) => {
    const world = createWorld(seed, 'complex')
    runAll(world, 1 / 60)
    return world
  })

  it('each site gets its own faults from its seed, the same every time', () => {
    const kinds = worlds.map((world) => world.systems.faults.map((fault) => fault.kind).join(','))
    expect(new Set(kinds).size).toBeGreaterThan(2)
    const again = createWorld(SEEDS[2], 'complex')
    runAll(again, 1 / 60)
    expect(again.systems.faults.map((fault) => [fault.kind, fault.x, fault.y])).toEqual(worlds[2].systems.faults.map((fault) => [fault.kind, fault.x, fault.y]))
  })

  it('a dripping pipe makes a puddle, a gas ring fills its corner with gas, a loose fitting comes down at a bang', () => {
    const withFault = (kind: string) => {
      const world = worlds.find((candidate) => candidate.systems.faults.some((fault) => fault.kind === kind))!
      const fault = world.systems.faults.find((candidate) => candidate.kind === kind)!
      // The player walks up to it, which wakes it.
      Object.assign(world.player, { x: fault.x, y: fault.y + 2 })
      return world
    }
    const leaky = withFault('leak')
    const gassy = withFault('gasRing')
    const loose = withFault('looseFitting')
    runAll(leaky, 20)
    expect(liquidVolume(leaky, 'water')).toBeGreaterThan(0.3)
    runAll(gassy, 10)
    const ring = gassy.systems.faults.find((fault) => fault.kind === 'gasRing')!
    expect(gasAt(gassy, Math.floor(ring.x), Math.floor(ring.y) - 1) + gasAt(gassy, Math.floor(ring.x), Math.floor(ring.y))).toBeGreaterThan(0)
    const fitting = loose.systems.faults.find((fault) => fault.kind === 'looseFitting')!
    explode(loose, { x: fitting.x + 6, y: fitting.y + 3 }, { radius: 1, tileDamage: 0, bodyDamage: 0 })
    runAll(loose, 0.3)
    expect(loose.systems.faults.some((fault) => fault.kind === 'looseFitting')).toBe(false)
    expect(loose.systems.dropped.has(fitting.lamp ?? propById(loose, fitting.prop)!)).toBe(true)
  })
})
