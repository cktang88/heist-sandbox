import type { TimeOfDay } from '../../game/site'
import { hexToRgb, nearestIndex, oklab, PALETTE } from '../style/palette'
import { displayed, sceneColourFor, vignetteAt, type Vec3 } from './pipeline'

/**
 * The pixel backdrop is painted in palette indices, not colours: its texture holds an index per texel and the
 * shader looks the colour up in a small table. The table holds, for each palette colour, the scene colour
 * that the frame's tone mapping and grade turn back into exactly that palette colour (see pipeline.ts),
 * once per vignette strength, so even the darkened corners of the screen land on clean palette colours.
 */

/** Index into `PALETTE`. */
export type Ink = number

/** The palette's ramps, dark to light (see style/palette.ts), so a colour can be stepped lighter or darker. */
const RAMPS: readonly (readonly [number, number])[] = [[0, 11], [12, 20], [21, 23], [24, 29], [30, 33], [34, 37], [38, 41], [42, 44]]

/** The same hue one step lighter (positive) or darker, staying inside its ramp. */
export function step(ink: Ink, by: number): Ink {
  const [first, last] = RAMPS.find(([a, b]) => ink >= a && ink <= b) ?? [ink, ink]
  return Math.min(last, Math.max(first, ink + by))
}

const LAB = PALETTE.map((hex) => oklab(...hexToRgb(hex)))

/** The palette colour closest to a display colour (0..1 channels). */
export function nearestInk(display: Vec3): Ink {
  return nearestIndex(oklab(...display), LAB)
}

/** Vignette strengths the table covers, from none to the corner of the screen (the shader picks the nearest). */
export const TABLE_ROWS = 12

/** The weakest vignette factor on screen (the corners) for a time of day. */
export function cornerVignette(time: TimeOfDay): number {
  return vignetteAt(0, 0, time)
}

export function rowVignette(row: number, time: TimeOfDay): number {
  return 1 - (row / (TABLE_ROWS - 1)) * (1 - cornerVignette(time))
}

/**
 * The largest nudge the palette pass's ordered dither gives a channel (see style/pixelFinish.ts: about
 * half of `dither` times 0.45 plus the value). Kept in step with the `pixel` look's dither strength.
 */
const DITHER = 0.05

/** The palette pass rounds each channel to its look-up cube's steps before finding the nearest colour. */
const LUT_STEPS = 31

function snapped(display: Vec3): Ink {
  return nearestInk(display.map((c) => Math.round(Math.min(1, Math.max(0, c)) * LUT_STEPS) / LUT_STEPS) as Vec3)
}

/** True if a scene colour shows as `ink` across a whole row of the table, whatever the dither adds. */
function holds(scene: Vec3, ink: Ink, time: TimeOfDay, row: number): boolean {
  const halfRow = (1 - cornerVignette(time)) / (TABLE_ROWS - 1) / 2
  for (const vignette of [rowVignette(row, time) - halfRow, rowVignette(row, time) + halfRow]) {
    const shown = displayed(scene, time, Math.min(1, vignette))
    for (const nudge of [-1, 0, 1]) {
      if (snapped(shown.map((c) => c + nudge * 0.47 * DITHER * (0.45 + c)) as Vec3) !== ink) return false
    }
  }
  return true
}

type Entry = { scene: Vec3; ink: Ink }

/** Solved entries per time of day, kept for the session: a look switch or a new heist reuses them. */
const solved = new Map<TimeOfDay, { exact: Map<number, Vec3>; shown: Map<number, Entry> }>()

/**
 * The scene colour for `ink` in `row`, or for its darker stand-in when it cannot be shown cleanly. Once a
 * colour has stepped down toward the corners it stays down, so the vignette reads as clean rings.
 */
function entry(ink: Ink, row: number, time: TimeOfDay): Entry {
  let known = solved.get(time)
  if (!known) solved.set(time, (known = { exact: new Map(), shown: new Map() }))
  const key = row * PALETTE.length + ink
  const cached = known.shown.get(key)
  if (cached) return cached
  const target = row > 0 ? Math.min(ink, entry(ink, row - 1, time).ink) : ink
  let result: Entry
  if (target !== ink) result = entry(target, row, time)
  else {
    // The row above is only a little less dark: its answer is the best place to start from.
    const scene = sceneColourFor(hexToRgb(PALETTE[ink]), time, rowVignette(row, time), known.exact.get(key - PALETTE.length))
    known.exact.set(key, scene)
    const darker = step(ink, -1)
    result = holds(scene, ink, time, row) || darker === ink ? { scene, ink } : entry(darker, row, time)
  }
  known.shown.set(key, result)
  return result
}

/**
 * Scene colours, RGBA float, `PALETTE.length` wide and `TABLE_ROWS` tall (row r is for vignette factor
 * `rowVignette(r)`), filled in for the inks a backdrop uses. Where a colour cannot be shown cleanly (too
 * bright to survive the vignette, or too close to its neighbour for the dither), the next darker colour
 * of its ramp stands in, so a darkened corner shows a clean step instead of a dithered smear.
 */
export function colourTable(time: TimeOfDay, inks: Iterable<Ink>): Float32Array {
  const data = new Float32Array(PALETTE.length * TABLE_ROWS * 4)
  for (const ink of new Set(inks)) {
    for (let row = 0; row < TABLE_ROWS; row += 1) data.set([...entry(ink, row, time).scene, 1], (row * PALETTE.length + ink) * 4)
  }
  return data
}

/** The palette colour a table entry shows as at the middle of its row (for tests). */
export function landsOn(table: Float32Array, ink: Ink, row: number, time: TimeOfDay): Ink {
  const at = (row * PALETTE.length + ink) * 4
  return snapped(displayed([table[at], table[at + 1], table[at + 2]], time, rowVignette(row, time)))
}
