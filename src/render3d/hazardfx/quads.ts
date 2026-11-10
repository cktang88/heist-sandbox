import { DynamicDrawUsage, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, PlaneGeometry, type ShaderMaterial } from 'three'
import type { Vec } from '../../game/types'

/** A pool of camera-facing quads drawn in one call. Each frame the owner fills `data` and sets `count`. */
export type QuadPool = { mesh: Mesh; data: Record<string, Float32Array>; cap: number; commit(count: number): void }

/**
 * Builds the pool. `attributes` names each per-quad value and how many floats it holds.
 * The quad itself spans -0.5..0.5 in x and y; the shader places and sizes it.
 */
export function createQuadPool(cap: number, attributes: Record<string, number>, material: ShaderMaterial): QuadPool {
  const geometry = new InstancedBufferGeometry()
  const plane = new PlaneGeometry(1, 1)
  geometry.index = plane.index
  geometry.setAttribute('position', plane.getAttribute('position'))
  geometry.setAttribute('uv', plane.getAttribute('uv'))
  const data: Record<string, Float32Array> = {}
  for (const [name, size] of Object.entries(attributes)) {
    data[name] = new Float32Array(cap * size)
    const attribute = new InstancedBufferAttribute(data[name], size)
    attribute.setUsage(DynamicDrawUsage)
    geometry.setAttribute(name, attribute)
  }
  geometry.instanceCount = 0
  const mesh = new Mesh(geometry, material)
  // The shader moves the quads anywhere, so the mesh's own bounds mean nothing.
  mesh.frustumCulled = false
  return {
    mesh, data, cap,
    commit(count) {
      geometry.instanceCount = count
      mesh.visible = count > 0
      if (count === 0) return
      for (const name of Object.keys(attributes)) {
        const attribute = geometry.getAttribute(name) as InstancedBufferAttribute
        attribute.clearUpdateRanges()
        attribute.addUpdateRange(0, count * attributes[name])
        attribute.needsUpdate = true
      }
    },
  }
}

/**
 * Picks up to `cap` cells, nearest to the view first, into `out` (a reused list of indices).
 * Sorting happens only when there are more cells than fit, so a small fire costs almost nothing.
 */
export function nearestCells(cells: readonly Vec[], view: Vec, reach: Vec, cap: number, out: number[]): number {
  out.length = 0
  for (let index = 0; index < cells.length; index += 1) {
    const cell = cells[index]
    if (Math.abs(cell.x - view.x) < reach.x && Math.abs(cell.y - view.y) < reach.y) out.push(index)
  }
  if (out.length > cap) {
    const gap = (index: number) => Math.abs(cells[index].x - view.x) + Math.abs(cells[index].y - view.y)
    out.sort((a, b) => gap(a) - gap(b))
    out.length = cap
  }
  return out.length
}

/** Repeatable 0..1 value for a tile, so each cell keeps its own look from frame to frame. */
export function cellSeed(x: number, y: number): number {
  const value = Math.sin(Math.floor(x) * 127.1 + Math.floor(y) * 311.7) * 43758.5453
  return value - Math.floor(value)
}

/** Writes one quad's values into a per-quad array without allocating. */
export function put4(array: Float32Array, slot: number, a: number, b: number, c: number, d: number): void {
  const at = slot * 4
  array[at] = a
  array[at + 1] = b
  array[at + 2] = c
  array[at + 3] = d
}

export function put3(array: Float32Array, slot: number, a: number, b: number, c: number): void {
  const at = slot * 3
  array[at] = a
  array[at + 1] = b
  array[at + 2] = c
}
