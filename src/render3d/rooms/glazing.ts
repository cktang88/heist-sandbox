import type { Glazing } from './finishes'

/** A rectangle on a back wall in room-local tiles: x from the room's left edge, y up from its floor. */
export type WallRect = { x0: number; x1: number; y0: number; y1: number }

/** Outer window frames, and the separate panes of glass inside them (the frame shows between panes as mullions). */
export type Windows = { frames: WallRect[]; panes: WallRect[] }

/** Gap between neighbouring panes, where the frame shows through as a mullion or transom. */
const BAR = 0.07

type Shape = {
  /** Width of one window, or 0 for a single strip across the room, and the gap between windows. */
  width: number
  gap: number
  /** Bottom and top of the window above each storey's floor. */
  y0: number
  y1: number
  /** Largest pane size before the glass is split by a mullion or a transom. */
  pane: number
  paneTall: number
}

const SHAPES: Record<Exclude<Glazing, 'curtain' | 'none'>, Shape> = {
  band: { width: 0, gap: 0, y0: 1.2, y1: 3.6, pane: 1.7, paneTall: 3 },
  punched: { width: 1.5, gap: 1.3, y0: 1.3, y1: 3.5, pane: 0.8, paneTall: 3 },
  tall: { width: 1.2, gap: 0.9, y0: 0.5, y1: 4.2, pane: 1.2, paneTall: 2.8 },
  high: { width: 1.6, gap: 1.8, y0: 3.3, y1: 4.15, pane: 1.6, paneTall: 1 },
  louvre: { width: 2, gap: 2, y0: 2.4, y1: 4.2, pane: 2, paneTall: 2 },
}

const STOREY_ROWS = 6

/**
 * Where the windows go on a back wall `width` tiles wide and `height` tall.
 * Double-height rooms get a row of windows per storey (or one wall of glass).
 * `keepClear` is a stretch of wall that must stay solid, such as the lobby's logo wall.
 */
export function windowLayout(glazing: Glazing, width: number, height: number, keepClear?: [number, number]): Windows {
  if (glazing === 'none' || width < 2) return { frames: [], panes: [] }
  const frames: WallRect[] = []
  if (glazing === 'curtain') {
    frames.push({ x0: 0.3, x1: width - 0.3, y0: 0.12, y1: height - 0.3 })
  } else {
    const shape = SHAPES[glazing]
    const storeys = Math.max(1, Math.round((height + 1) / STOREY_ROWS))
    for (let storey = 0; storey < storeys; storey += 1) {
      const base = storey * STOREY_ROWS
      if (shape.width === 0) {
        frames.push({ x0: 0.5, x1: width - 0.5, y0: base + shape.y0, y1: base + shape.y1 })
        continue
      }
      const count = Math.floor((width - 1 + shape.gap) / (shape.width + shape.gap))
      const start = (width - (count * shape.width + (count - 1) * shape.gap)) / 2
      for (let index = 0; index < count; index += 1) {
        const x0 = start + index * (shape.width + shape.gap)
        frames.push({ x0, x1: x0 + shape.width, y0: base + shape.y0, y1: base + shape.y1 })
      }
    }
  }
  const clear = keepClear ? frames.flatMap((frame) => clip(frame, keepClear)) : frames
  const shape = glazing === 'curtain' ? { pane: 2, paneTall: 2.4 } : SHAPES[glazing]
  return { frames: clear, panes: clear.flatMap((frame) => split(frame, shape.pane, shape.paneTall)) }
}

/** Cuts a frame around a stretch of wall that has to stay clear; pieces too narrow to be windows are dropped. */
function clip(frame: WallRect, [from, to]: [number, number]): WallRect[] {
  if (frame.x1 <= from || frame.x0 >= to) return [frame]
  return [{ ...frame, x1: Math.min(frame.x1, from - 0.3) }, { ...frame, x0: Math.max(frame.x0, to + 0.3) }].filter((piece) => piece.x1 - piece.x0 >= 1)
}

function split(frame: WallRect, paneWide: number, paneTall: number): WallRect[] {
  const across = Math.max(1, Math.round((frame.x1 - frame.x0) / paneWide))
  const down = Math.max(1, Math.round((frame.y1 - frame.y0) / paneTall))
  const w = (frame.x1 - frame.x0 - BAR) / across
  const h = (frame.y1 - frame.y0 - BAR) / down
  const panes: WallRect[] = []
  for (let row = 0; row < down; row += 1) {
    for (let column = 0; column < across; column += 1) {
      const x0 = frame.x0 + BAR + column * w
      const y0 = frame.y0 + BAR + row * h
      panes.push({ x0, x1: x0 + w - BAR, y0, y1: y0 + h - BAR })
    }
  }
  return panes
}
