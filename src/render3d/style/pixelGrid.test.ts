import { describe, expect, it } from 'vitest'
import { pixelGrid, snapToGrid } from './pixelGrid'

describe('pixel grid', () => {
  it('uses a whole number of screen pixels per art pixel, close to the asked art height', () => {
    expect(pixelGrid(1920, 1080, 360, 24).scale).toBe(3)
    expect(pixelGrid(1280, 720, 360, 24).scale).toBe(2)
    expect(pixelGrid(2560, 1440, 540, 24).scale).toBe(3)
    expect(pixelGrid(300, 200, 360, 24).scale).toBe(1)
  })

  it('keeps exactly the 2D camera’s 24 tiles from top to bottom of the screen, so mouse aim stays exact', () => {
    for (const [width, height] of [[1920, 1080], [1366, 768], [1000, 1001]]) {
      const grid = pixelGrid(width, height, 360, 24)
      expect((height / grid.scale) * grid.unit).toBeCloseTo(24, 9)
      // The target covers the screen plus at least one art pixel on every side.
      expect(grid.width * grid.scale).toBeGreaterThanOrEqual(width + 2 * grid.scale)
      expect(grid.height * grid.scale).toBeGreaterThanOrEqual(height + 2 * grid.scale)
    }
  })
})

describe('camera snapping', () => {
  it('moves the camera in whole art pixels and hands back the remainder', () => {
    const unit = 24 / 360
    for (const x of [0, 0.01, 10.033, -7.77, 123.456]) {
      const snap = snapToGrid(x, -x * 2, unit)
      expect(Math.abs(snap.residualX)).toBeLessThanOrEqual(0.5)
      expect(Math.abs(snap.residualY)).toBeLessThanOrEqual(0.5)
      expect(snap.x).toBeCloseTo(snap.cellX * unit, 9)
      expect(snap.x + snap.residualX * unit).toBeCloseTo(x, 9)
      expect(snap.y + snap.residualY * unit).toBeCloseTo(-x * 2, 9)
    }
  })

  it('keeps static things on the same art pixels while the view glides', () => {
    const unit = 24 / 360
    // A wall at world x = 5 seen from two nearby camera positions lands on art pixels a whole number apart.
    const a = snapToGrid(3.01, 0, unit)
    const b = snapToGrid(3.04, 0, unit)
    const column = (snap: typeof a) => (5 - snap.x) / unit
    expect(column(a) - Math.round(column(a))).toBeCloseTo(column(b) - Math.round(column(b)), 9)
  })
})
