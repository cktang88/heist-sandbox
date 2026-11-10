import { cellHash } from '../noise'

/** A repeatable 0..1 number for one thing (a room id, a column) and one question about it (`salt`). */
export function roll(id: number, salt: number): number {
  return cellHash(id, salt, 911)
}

export function pickBy<T>(items: readonly T[], id: number, salt: number): T {
  return items[Math.floor(roll(id, salt) * items.length) % items.length]
}
