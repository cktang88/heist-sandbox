/** Repeatable 0..1 value for a lattice point. */
function lattice(x: number, y: number, seed: number): number {
  let value = (x * 374761393 + y * 668265263 + seed * 362437) | 0
  value = (value ^ (value >>> 13)) * 1274126177
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296
}

/** Smooth noise that wraps every `period` cells, so textures built from it tile without seams. */
export function tileNoise(u: number, v: number, period: number, seed: number): number {
  const x = u * period
  const y = v * period
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const wrap = (value: number) => ((value % period) + period) % period
  const a = lattice(wrap(x0), wrap(y0), seed)
  const b = lattice(wrap(x0 + 1), wrap(y0), seed)
  const c = lattice(wrap(x0), wrap(y0 + 1), seed)
  const d = lattice(wrap(x0 + 1), wrap(y0 + 1), seed)
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
}

/** Several layers of noise at rising detail: the usual recipe for natural-looking grain. */
export function fractalNoise(u: number, v: number, period: number, seed: number, layers = 5): number {
  let total = 0
  let weight = 0.5
  let scale = period
  for (let layer = 0; layer < layers; layer += 1) {
    total += tileNoise(u, v, scale, seed + layer * 17) * weight
    weight *= 0.5
    scale *= 2
  }
  return total / (1 - Math.pow(0.5, layers))
}

export function cellHash(x: number, y: number, seed: number): number {
  return lattice(x, y, seed)
}
