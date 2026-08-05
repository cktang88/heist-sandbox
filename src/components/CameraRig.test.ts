import { describe, expect, it } from 'vitest'
import { MAX_ZOOM_FACTOR, MIN_ZOOM_FACTOR, cameraPanAfterDrag, clampCameraPan, clampZoomFactor, fitMapZoom, zoomFactorAfterWheel } from './CameraRig'

describe('camera zoom', () => {
  it('fits larger maps farther away', () => {
    expect(fitMapZoom(1200, 700, 28, 18)).toBeLessThan(fitMapZoom(1200, 700, 18, 12))
  })

  it('zooms in and out with bounded wheel input', () => {
    expect(zoomFactorAfterWheel(1, -100)).toBeGreaterThan(1)
    expect(zoomFactorAfterWheel(1, 100)).toBeLessThan(1)
    expect(clampZoomFactor(99)).toBe(MAX_ZOOM_FACTOR)
    expect(clampZoomFactor(0)).toBe(MIN_ZOOM_FACTOR)
  })

  it('moves the field with a right or middle drag and keeps the camera near the map', () => {
    const map = { width: 20, depth: 10 }
    expect(cameraPanAfterDrag({ x: 0, z: 0 }, 100, -50, 50, map)).toEqual({ x: -2, z: 1.35 })
    expect(clampCameraPan({ x: 100, z: -100 }, map)).toEqual({ x: 7.6, z: -3.8 })
  })
})
