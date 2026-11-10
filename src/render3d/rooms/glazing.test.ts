import { describe, expect, it } from 'vitest'
import type { Glazing } from './finishes'
import { windowLayout, type WallRect } from './glazing'

const inside = (inner: WallRect, outer: WallRect) => inner.x0 >= outer.x0 && inner.x1 <= outer.x1 && inner.y0 >= outer.y0 && inner.y1 <= outer.y1

describe('windowLayout', () => {
  const shapes: Glazing[] = ['band', 'punched', 'tall', 'curtain', 'high', 'louvre']

  it('keeps every window and pane on the wall', () => {
    for (const glazing of shapes) {
      for (const [width, height] of [[8, 5], [17, 5], [29, 11]]) {
        const { frames, panes } = windowLayout(glazing, width, height)
        expect(frames.length).toBeGreaterThan(0)
        const wall = { x0: 0, x1: width, y0: 0, y1: height }
        for (const frame of frames) expect(inside(frame, wall)).toBe(true)
        for (const pane of panes) expect(frames.some((frame) => inside(pane, frame))).toBe(true)
      }
    }
  })

  it('gives a double-height room a row of windows for each storey', () => {
    const single = windowLayout('punched', 16, 5).frames
    const double = windowLayout('punched', 16, 11).frames
    expect(double.length).toBe(single.length * 2)
    expect(Math.max(...double.map((frame) => frame.y1))).toBeGreaterThan(6)
  })

  it('leaves the kept-clear stretch of wall solid', () => {
    for (const glazing of shapes) {
      const { frames } = windowLayout(glazing, 24, 5, [7, 17])
      for (const frame of frames) expect(frame.x1 <= 7 || frame.x0 >= 17).toBe(true)
    }
  })

  it('draws nothing for windowless rooms or slivers of wall', () => {
    expect(windowLayout('none', 20, 5).frames).toEqual([])
    expect(windowLayout('band', 1, 5).frames).toEqual([])
  })
})
