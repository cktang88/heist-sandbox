import { describe, expect, it } from 'vitest'
import type { Lamp } from '../../game/site'
import { buildLampGrid } from './lampGrid'

const lamp = (x: number, y: number): Lamp => ({ x, y, fixture: 'ceilingPanel', color: 0xffffff, radius: 8, strength: 1, hung: true })

describe('buildLampGrid', () => {
  it('finds exactly the lamps inside a rectangle, across bucket edges', () => {
    const lamps = [lamp(5, 5), lamp(15.9, 5), lamp(16.1, 5), lamp(40, 40), lamp(-3, 2)]
    const out = new Int32Array(10)
    const count = buildLampGrid(lamps).query(0, 0, 20, 10, out)
    expect([...out.slice(0, count)].sort()).toEqual([0, 1, 2])
  })

  it('never writes past the output buffer', () => {
    const lamps = Array.from({ length: 20 }, (_, index) => lamp(index, 1))
    const out = new Int32Array(5)
    expect(buildLampGrid(lamps).query(0, 0, 30, 5, out)).toBe(5)
  })
})
