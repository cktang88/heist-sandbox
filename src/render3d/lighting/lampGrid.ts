import type { Lamp } from '../../game/site'

/** Side of one bucket, in tiles. About a third of the view wide, so a view query touches a handful of buckets. */
const CELL = 16

/**
 * The site's lamps sorted into square buckets by position, so per-frame code only looks at lamps near the view
 * instead of the whole site list.
 */
export type LampGrid = {
  /** Fills `out` with the indices (into the lamp list) of lamps inside the rectangle, and returns how many. */
  query(left: number, top: number, right: number, bottom: number, out: Int32Array): number
}

const grids = new WeakMap<readonly Lamp[], LampGrid>()

/** One grid per lamp list, shared by every part of the renderer that needs it. */
export function lampGridFor(lamps: readonly Lamp[]): LampGrid {
  let grid = grids.get(lamps)
  if (!grid) {
    grid = buildLampGrid(lamps)
    grids.set(lamps, grid)
  }
  return grid
}

export function buildLampGrid(lamps: readonly Lamp[]): LampGrid {
  const buckets = new Map<number, number[]>()
  const keyOf = (column: number, row: number) => column * 65536 + row
  lamps.forEach((lamp, index) => {
    const key = keyOf(Math.floor(lamp.x / CELL), Math.floor(lamp.y / CELL))
    const bucket = buckets.get(key)
    if (bucket) bucket.push(index)
    else buckets.set(key, [index])
  })
  return {
    query(left, top, right, bottom, out) {
      let count = 0
      for (let column = Math.floor(left / CELL); column <= Math.floor(right / CELL); column += 1) {
        for (let row = Math.floor(top / CELL); row <= Math.floor(bottom / CELL); row += 1) {
          const bucket = buckets.get(keyOf(column, row))
          if (!bucket) continue
          for (const index of bucket) {
            const lamp = lamps[index]
            if (lamp.x < left || lamp.x > right || lamp.y < top || lamp.y > bottom || count >= out.length) continue
            out[count] = index
            count += 1
          }
        }
      }
      return count
    },
  }
}
