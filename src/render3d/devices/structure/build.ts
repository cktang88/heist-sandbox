import { BoxGeometry, Float32BufferAttribute, type BufferGeometry } from 'three'

/**
 * Helpers for static geometry merged into one mesh: boxes are collected into a list, then merged once.
 * All coordinates are 3D (y up). Boxes carry a white vertex colour so the level's wall materials, which tint by vertex colour, show their texture.
 */
export function slab(list: BufferGeometry[], x0: number, y0: number, x1: number, y1: number, z0: number, z1: number): void {
  const box = new BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0))
  box.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
  list.push(white(box))
}

/** A straight bar from (ax, ay) to (bx, by) at depth `z`, `thick` across and `deep` front to back. */
export function bar(list: BufferGeometry[], ax: number, ay: number, bx: number, by: number, z: number, thick: number, deep: number): void {
  const length = Math.hypot(bx - ax, by - ay)
  const box = new BoxGeometry(length, thick, deep)
  box.rotateZ(Math.atan2(by - ay, bx - ax))
  box.translate((ax + bx) / 2, (ay + by) / 2, z)
  list.push(white(box))
}

function white(geometry: BufferGeometry): BufferGeometry {
  geometry.setAttribute('color', new Float32BufferAttribute(new Float32Array(geometry.attributes.position.count * 3).fill(1), 3))
  return geometry
}

/** How a storey is written on signs and indicators: basements as B1, B2…, street level as G. */
export function storeyLabel(storey: number): string {
  return storey < 0 ? `B${-storey}` : storey === 0 ? 'G' : String(storey)
}
