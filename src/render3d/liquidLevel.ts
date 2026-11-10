/**
 * Standing liquid is simulated cell by cell, each with its own depth, so drawn cell by cell it rose in stair-steps.
 * Water finds its level: each unbroken run of wet cells along one row is drawn at the run's mean depth (its volume
 * spread evenly), so a pool reads as one flat surface and keeps the amount of liquid it holds.
 */
export type LiquidCell = { x: number; y: number; depth: number }

/** Depth to draw for each cell, keyed like the input (by index). */
export function levelDepths(cells: readonly LiquidCell[]): Float32Array {
  const order = cells.map((_, index) => index).sort((a, b) => cells[a].y - cells[b].y || cells[a].x - cells[b].x)
  const level = new Float32Array(cells.length)
  let start = 0
  while (start < order.length) {
    let end = start + 1
    let total = cells[order[start]].depth
    while (end < order.length && cells[order[end]].y === cells[order[start]].y && cells[order[end]].x === cells[order[end - 1]].x + 1) {
      total += cells[order[end]].depth
      end += 1
    }
    const mean = total / (end - start)
    for (let index = start; index < end; index += 1) level[order[index]] = mean
    start = end
  }
  return level
}
