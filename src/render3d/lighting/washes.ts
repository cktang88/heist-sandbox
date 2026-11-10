import type { Lamp } from '../../game/site'
import { isSolidAt, type Grid } from '../../game/tiles'
import { ALARM_WASH_GROW, FIXTURE_SPECS } from './fixtureSpecs'

/**
 * Where each lamp's fake pool of light may fall on the wall behind it: the open space around the lamp, out to the
 * nearest wall, floor and ceiling, so the glow never bleeds into the next room. Worked out lazily, per lamp, and
 * forgotten whenever the level changes shape.
 */
export class WashBounds {
  /** Per lamp: left, top, right, bottom in game tiles (y down). */
  readonly rect: Float32Array
  private readonly known: Uint8Array
  private version = -1

  constructor(private readonly lamps: readonly Lamp[]) {
    this.rect = new Float32Array(lamps.length * 4)
    this.known = new Uint8Array(lamps.length)
  }

  /** Makes sure lamp `index` has bounds for the grid as it is now; read them from `rect` afterwards. */
  ensure(grid: Grid, index: number): void {
    if (grid.version !== this.version) {
      this.known.fill(0)
      this.version = grid.version
    }
    if (this.known[index]) return
    this.known[index] = 1
    const lamp = this.lamps[index]
    const spec = FIXTURE_SPECS[lamp.fixture]
    // Room for the bigger alarm pool, so it is never cut off with a hard edge.
    const grow = lamp.fixture === 'emergency' ? ALARM_WASH_GROW : 1
    const half = (spec.washSize * grow) / 2
    const column = Math.floor(lamp.x)
    const row = Math.floor(lamp.y + Math.max(0, spec.washDrop))
    const at = index * 4
    this.rect[at] = Math.max(lamp.x - half, scan(grid, column, row, -1, 0, half + 1) + 1)
    this.rect[at + 2] = Math.min(lamp.x + half, scan(grid, column, row, 1, 0, half + 1))
    const tall = spec.washTall * grow + Math.abs(spec.washDrop)
    this.rect[at + 1] = Math.max(lamp.y - tall, scan(grid, column, Math.floor(lamp.y), 0, -1, tall + 1) + 1)
    this.rect[at + 3] = Math.min(lamp.y + tall, scan(grid, column, Math.floor(lamp.y), 0, 1, tall + 1))
  }
}

/** Walks from a tile in a direction and returns the coordinate of the first solid tile (or the limit). */
function scan(grid: Grid, column: number, row: number, dx: number, dy: number, limit: number): number {
  for (let step = 1; step <= limit; step += 1) {
    const x = column + dx * step
    const y = row + dy * step
    if (isSolidAt(grid, x, y)) return dx !== 0 ? x : y
  }
  return dx !== 0 ? column + dx * (limit + 1) : row + dy * (limit + 1)
}
