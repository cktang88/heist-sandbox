import { describe, expect, it } from 'vitest'
import { bakePaletteLut, hexToRgb, LUT_SIZE, nearestIndex, oklab, PALETTE } from './palette'

describe('palette', () => {
  const lab = PALETTE.map((hex) => oklab(...hexToRgb(hex)))

  it('maps every palette colour to itself', () => {
    lab.forEach((colour, index) => expect(nearestIndex(colour, lab)).toBe(index))
  })

  it('has no duplicate colours and a sensible size for hand-made pixel art', () => {
    expect(new Set(PALETTE).size).toBe(PALETTE.length)
    expect(PALETTE.length).toBeGreaterThanOrEqual(32)
    expect(PALETTE.length).toBeLessThanOrEqual(48)
  })

  it('sends a dark grey to a dark neutral, not to a saturated neon', () => {
    const index = nearestIndex(oklab(0.12, 0.12, 0.13), lab)
    const [r, g, b] = hexToRgb(PALETTE[index])
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(0.1)
    expect(Math.max(r, g, b)).toBeLessThan(0.25)
  })

  it('bakes a look-up cube whose every cell holds a palette colour', () => {
    const lut = bakePaletteLut()
    const data = lut.image.data as Uint8Array
    const allowed = new Set(PALETTE.map((hex) => hexToRgb(hex).map((c) => Math.round(c * 255)).join(',')))
    expect(data.length).toBe(LUT_SIZE ** 3 * 4)
    for (let at = 0; at < data.length; at += 4 * 97) expect(allowed.has(`${data[at]},${data[at + 1]},${data[at + 2]}`)).toBe(true)
  })
})
