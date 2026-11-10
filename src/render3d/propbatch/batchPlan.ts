import { BatchedMesh, Matrix4, type BufferGeometry, type Material } from 'three'

/**
 * Collects everything one material draws in one region, then makes a single `BatchedMesh` of it: each distinct
 * shape is stored once, each prop that uses it is an instance, and three culls instances one by one before
 * drawing whatever is left in one call. Hiding a prop switches its instances off.
 */

/** A mirror across x. Mirrored props use a mirrored copy of their shape (see `mirror.ts`) and this undoes it. */
export const MIRROR = new Matrix4().makeScale(-1, 1, 1)

/** One instance of a prop: its id in the batch, and where it sits relative to the prop's own placement. */
export type Instance = { id: number; local: Matrix4 }

export type BatchedProps = { mesh: BatchedMesh; instances: Map<number, Instance[]> }

const scratch = new Matrix4()

export class BatchPlan {
  private geometries = new Map<string, BufferGeometry>()
  private uses: { shape: string; local: Matrix4; prop: number }[] = []

  /** Whether the whole batch throws shadows: true as soon as one part added to it should. */
  castShadow = false

  constructor(readonly material: Material) {}

  /** Adds one use of a shape; `make` is only called the first time this batch sees `shape`. */
  add(shape: string, make: () => BufferGeometry, local: Matrix4, prop: number): void {
    if (!this.geometries.has(shape)) this.geometries.set(shape, make())
    this.uses.push({ shape, local, prop })
  }

  build(placementOf: (prop: number) => Matrix4): BatchedProps {
    let vertices = 0
    let indices = 0
    for (const geometry of this.geometries.values()) {
      vertices += geometry.attributes.position.count
      indices += geometry.index ? geometry.index.count : 0
    }
    const mesh = new BatchedMesh(this.uses.length, vertices, Math.max(indices, 1), this.material)
    const ids = new Map<string, number>()
    for (const [shape, geometry] of this.geometries) ids.set(shape, mesh.addGeometry(geometry))
    const instances = new Map<number, Instance[]>()
    for (const { shape, local, prop } of this.uses) {
      const id = mesh.addInstance(ids.get(shape)!)
      mesh.setMatrixAt(id, scratch.multiplyMatrices(placementOf(prop), local))
      const list = instances.get(prop) ?? instances.set(prop, []).get(prop)!
      list.push({ id, local })
    }
    // Opaque instances are drawn in any order; sorting only matters for see-through ones.
    mesh.sortObjects = this.material.transparent
    mesh.castShadow = this.castShadow
    mesh.receiveShadow = true
    mesh.matrixAutoUpdate = false
    mesh.computeBoundingBox()
    mesh.computeBoundingSphere()
    return { mesh, instances }
  }
}

export function showInstances(batch: BatchedProps, prop: number, visible: boolean): void {
  for (const { id } of batch.instances.get(prop) ?? []) batch.mesh.setVisibleAt(id, visible)
}
