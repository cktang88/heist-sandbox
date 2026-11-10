/** A small seeded generator (mulberry32): the same seed always lays out the same city. */
export type Rng = {
  /** 0..1 */
  next(): number
  range(min: number, max: number): number
  chance(odds: number): boolean
  pick<T>(items: readonly T[]): T
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0 || 0x2f6b1d3
  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    range: (min, max) => min + next() * (max - min),
    chance: (odds) => next() < odds,
    pick: (items) => items[Math.floor(next() * items.length) % items.length],
  }
}

/** Repeatable 0..1 value for a window or a light, so the painter and the light list agree without sharing state. */
export function hash3(a: number, b: number, c: number): number {
  let value = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1274126177)) | 0
  value = Math.imul(value ^ (value >>> 13), 1274126177)
  value ^= value >>> 16
  return (value >>> 0) / 4294967296
}
