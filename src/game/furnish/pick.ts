import type { Rng } from '../rng'
import { randomInt } from '../rng'
import { propSpec, type PropKind } from '../propCatalog'
import type { Prop } from '../site'

export function pickFrom<T>(rng: Rng, items: readonly T[]): T {
  return items[randomInt(rng, 0, items.length - 1)]
}

export function shuffled<T>(rng: Rng, items: readonly T[]): T[] {
  const out = [...items]
  for (let index = out.length - 1; index > 0; index -= 1) {
    const other = randomInt(rng, 0, index)
    ;[out[index], out[other]] = [out[other], out[index]]
  }
  return out
}

export function between(rng: Rng, low: number, high: number): number {
  return low + rng() * (high - low)
}

/** Positions sit on a quarter-tile grid so layouts stay tidy without packing loosely. */
export function snap(value: number, step = 0.25): number {
  return Math.round(value / step) * step
}

/** Left and right edges of a prop. `x` is the column of its centre, drawn at x + 0.5. */
export function extent(prop: { kind: PropKind; x: number }): { left: number; right: number } {
  const half = propSpec(prop.kind).w / 2
  return { left: prop.x + 0.5 - half, right: prop.x + 0.5 + half }
}

export function hasCover(prop: Prop): boolean {
  const spec = propSpec(prop.kind)
  return spec.mount === 'floor' && spec.cover !== 'none'
}
