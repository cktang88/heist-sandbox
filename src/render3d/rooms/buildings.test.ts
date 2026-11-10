import { describe, expect, it } from 'vitest'
import { COMPLEX_GROUND, createComplex } from '../../game/complex/complex'
import { tileAt } from '../../game/tiles'
import { buildingsOf } from './buildings'
import { finishOf } from './finishes'

describe('buildingsOf', () => {
  const site = createComplex(3)
  const buildings = buildingsOf(site.rooms, site.interiors, site.groundY)

  it('finds the tower, depot and quarters with their outside walls', () => {
    expect(buildings.map((building) => building.name).sort()).toEqual(['depot', 'quarters', 'tower'])
    const tower = buildings.find((building) => building.name === 'tower')!
    expect([tower.left, tower.right]).toEqual([86, 186])
    expect(tower.storeys).toBeGreaterThanOrEqual(20)
    for (const column of [tower.left, tower.right]) expect(tileAt(site.grid, column, tower.roofRow - 1)).not.toBe('air')
    expect(tower.groundRow).toBe(COMPLEX_GROUND)
  })
})

describe('finishOf', () => {
  it('finishes every indoor room kind the complex makes, and leaves outdoor areas to the exterior dressing', () => {
    for (const room of createComplex(5).rooms) {
      const outdoor = room.kind === 'street' || room.kind === 'yard' || room.kind === 'rooftop'
      expect(finishOf(room.kind) === undefined).toBe(outdoor)
    }
  })
})
