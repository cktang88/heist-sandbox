import { Matrix4, Mesh, type BufferGeometry, type Group, type Material } from 'three'
import { deinterleaveGeometry, mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * A scanned model often comes in many pieces (a desk in nine, a row of books in forty) that share a material or two.
 * Pieces with the same material are joined once per model, so each material of a model costs one batch.
 */

export type ScanPiece = { geometry: BufferGeometry; material: Material }

const joined = new WeakMap<Group, ScanPiece[]>()

export function scanPieces(scene: Group): ScanPiece[] {
  const known = joined.get(scene)
  if (known) return known
  scene.updateMatrixWorld(true)
  const toScene = new Matrix4().copy(scene.matrixWorld).invert()
  const byMaterial = new Map<Material, BufferGeometry[]>()
  scene.traverse((object) => {
    if (!(object instanceof Mesh) || Array.isArray(object.material)) return
    const geometry: BufferGeometry = object.geometry.clone()
    // Batches copy attributes value by value, so interleaved glTF buffers are split apart first.
    deinterleaveGeometry(geometry)
    geometry.applyMatrix4(new Matrix4().multiplyMatrices(toScene, object.matrixWorld))
    const list = byMaterial.get(object.material) ?? byMaterial.set(object.material, []).get(object.material)!
    list.push(geometry)
  })
  const pieces: ScanPiece[] = []
  for (const [material, geometries] of byMaterial) {
    const whole = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries)
    if (whole) pieces.push({ geometry: whole, material })
    else for (const geometry of geometries) pieces.push({ geometry, material })
  }
  joined.set(scene, pieces)
  return pieces
}
