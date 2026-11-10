import { describe, expect, it } from 'vitest'
import { hexToRgb, PALETTE } from '../style/palette'
import { STYLES } from '../style/styles'
import { TILES_TALL } from '../style/cameraRig'
import { ATLAS_SIZE } from './atlas'
import type { LayerName } from './frame'
import { MOODS, type MoodName } from './moods'
import { displayed, sceneColourFor } from './pipeline'
import { packLayers, pixelSheets, texelAt, DESIGN_LINES } from './pixelFrame'
import { PIXEL_MOODS, type PixelMood } from './pixelMoods'
import { colourTable, landsOn, nearestInk, step, TABLE_ROWS, type Ink } from './pixelPalette'

const WIDTH = 300
const GROUND = -164
const MOOD_NAMES = Object.keys(MOODS) as MoodName[]

/** Every ink a mood asks for by name. */
function inksOf(mood: PixelMood): Ink[] {
  const layers = (Object.keys(mood.layers) as LayerName[]).flatMap((name) => {
    const { wall, back, rim, glass, haze } = mood.layers[name]
    return [wall, back, rim, haze, ...(glass === null ? [] : [glass]), ...mood.warm[name], ...mood.cold[name]]
  })
  const { stars, disc, clouds, rain } = mood
  return [
    ...layers,
    ...mood.sky.map(([, ink]) => ink),
    ...(stars ? [stars.ink, stars.bright] : []),
    ...(disc ? [disc.body, disc.rim, disc.halo] : []),
    clouds.body,
    clouds.edge,
    ...(rain === null ? [] : [rain]),
  ]
}

describe('pixel backdrop sizes', () => {
  it('paint one texel per art pixel of the pixel look, at every layer depth', () => {
    expect(DESIGN_LINES).toBe(STYLES.pixel.finish.kind === 'pixel' ? STYLES.pixel.finish.artHeight : 0)
    expect(texelAt(0)).toBeCloseTo(TILES_TALL / DESIGN_LINES)
    for (const sheet of pixelSheets(WIDTH, GROUND)) expect(sheet.texel).toBeCloseTo(texelAt(sheet.z))
  })

  it('fit all three layers of the complex into one atlas, every column placed exactly once', () => {
    const sheets = pixelSheets(WIDTH, GROUND)
    const pieces = packLayers(sheets, ATLAS_SIZE)
    expect(pieces).not.toBeNull()
    sheets.forEach((sheet, layer) => {
      const mine = (pieces ?? []).filter((piece) => piece.layer === layer).sort((a, b) => a.x - b.x)
      let next = 0
      for (const piece of mine) {
        expect(piece.x).toBe(next)
        expect(piece.atlasX + piece.w).toBeLessThanOrEqual(ATLAS_SIZE)
        expect(piece.atlasY + sheet.height).toBeLessThanOrEqual(ATLAS_SIZE)
        next += piece.w
      }
      expect(next).toBe(sheet.width)
    })
    // No two pieces overlap.
    const boxes = (pieces ?? []).map((piece) => ({ ...piece, h: sheets[piece.layer].height }))
    for (const a of boxes) {
      for (const b of boxes) {
        if (a === b) continue
        const apart = a.atlasX + a.w <= b.atlasX || b.atlasX + b.w <= a.atlasX || a.atlasY + a.h <= b.atlasY || b.atlasY + b.h <= a.atlasY
        expect(apart).toBe(true)
      }
    }
  })

  it('give up (so the soft backdrop is used) when the layers cannot fit', () => {
    expect(packLayers([{ width: 5000, height: 1500 }, { width: 5000, height: 1500 }], ATLAS_SIZE)).toBeNull()
  })
})

describe('pixel backdrop colours', () => {
  it('are found again by running the frame forward from the scene colour worked out for them', () => {
    for (const time of ['night', 'day'] as const) {
      for (const hex of ['#1d2330', '#4a556c', '#a6aec0', '#b5591b', '#781e61']) {
        const target = hexToRgb(hex)
        const shown = displayed(sceneColourFor(target, time), time)
        shown.forEach((channel, index) => expect(Math.abs(channel - target[index])).toBeLessThan(0.01))
      }
    }
  })

  it('land squarely on the palette colour each mood was designed with, in the middle of the screen', () => {
    for (const name of MOOD_NAMES) {
      const mood = PIXEL_MOODS[name]
      const inks = inksOf(mood)
      const table = colourTable(mood.time, inks)
      for (const ink of inks) expect([name, PALETTE[ink], landsOn(table, ink, 0, mood.time)]).toEqual([name, PALETTE[ink], ink])
    }
  })

  it('step down cleanly toward the darkened corners, never back up', () => {
    for (const time of ['night', 'day'] as const) {
      const inks = PALETTE.map((_, index) => index)
      const table = colourTable(time, inks)
      // Only colours that can be shown at all (a few of the darkest cannot get past the grade's lift).
      for (const ink of inks.filter((index) => landsOn(table, index, 0, time) === index)) {
        const rows = Array.from({ length: TABLE_ROWS }, (_, row) => landsOn(table, ink, row, time))
        for (let row = 1; row < TABLE_ROWS; row += 1) expect(rows[row]).toBeLessThanOrEqual(rows[row - 1])
        // Always the same hue: a stand-in comes from the same ramp.
        for (const shown of rows) expect(step(shown, 100)).toBe(step(ink, 100))
      }
    }
  })

  it('keep the layers apart in value: by day the far city is palest; by night the near blocks are darkest', () => {
    const lightness = (ink: Ink) => hexToRgb(PALETTE[ink]).reduce((sum, channel) => sum + channel, 0)
    const day = PIXEL_MOODS.overcast.layers
    expect(lightness(day.far.wall)).toBeGreaterThan(lightness(day.mid.wall))
    expect(lightness(day.mid.wall)).toBeGreaterThan(lightness(day.near.wall))
    for (const name of ['night', 'wet', 'moonlit'] as const) {
      const night = PIXEL_MOODS[name].layers
      expect(lightness(night.near.wall)).toBeLessThan(lightness(night.mid.wall))
      expect(lightness(night.mid.wall)).toBeLessThan(lightness(night.far.wall))
    }
  })

  it('map light colours to the palette colour nearest to them', () => {
    expect(nearestInk(hexToRgb('#ff2a1a'))).toBe(44)
    expect(nearestInk(hexToRgb(PALETTE[28]))).toBe(28)
  })
})
