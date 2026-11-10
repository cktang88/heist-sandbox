import type { Mesh } from 'three'
import { describe, expect, it, vi } from 'vitest'
import type { ElevatorCar } from '../../../game/elevators'
import { buildElevator } from './elevator'

/** The floor indicator is painted on a canvas; a context that ignores every call is enough here. */
const quietContext = new Proxy({}, { get: () => () => ({ addColorStop() {} }), set: () => true })
vi.stubGlobal('document', { createElement: () => ({ getContext: () => quietContext, width: 0, height: 0 }) })

const shaft = { id: 0, building: 'tower', x: 10, w: 4, stops: [60, 54, 48, 42, 36], doorSide: 1 as const }

function car(y: number, cut: boolean): ElevatorCar {
  return {
    shaft: 0, y, targetStop: null, doorsOpen: false, locked: false, stop: null, moving: false, released: false, forced: false,
    dwell: 0, riders: [], floorTiles: [], doorTiles: [], cut,
  }
}

/** The main cable runs down the middle of the shaft, a little behind the walking lane. */
const mainCable = (group: { children: unknown[] }) => (group.children as Mesh[]).find((mesh) => mesh.position.z === -1)!

describe('elevator', () => {
  it('stops drawing the cable down to the car once it is cut', () => {
    const rig = buildElevator(shaft)
    rig.update(car(60, false), 60, () => true, 1 / 60)
    const whole = mainCable(rig.group).scale.y
    rig.update(car(60, true), 60, () => true, 1 / 60)
    expect(mainCable(rig.group).scale.y).toBeLessThan(3)
    expect(whole).toBeGreaterThan(20)
  })
})
