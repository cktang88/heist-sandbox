import { Matrix4, Mesh, type BufferGeometry, type Group, type Material, type Object3D } from 'three'

/**
 * What a built prop model is made of, with every part's placement relative to the prop's own origin.
 * Prop builders still return ordinary groups (easy to write and read); the batcher only needs this flat list.
 */

/** One drawable piece: a shared geometry (or one range of it) with one material. */
export type Part = { geometry: BufferGeometry; material: Material; matrix: Matrix4; start: number; count: number; castShadow: boolean }

/** A scanned model that loads later; `url` names it in `public/`. */
export type ScanPlacement = { url: string; matrix: Matrix4 }

export type Recipe = { parts: Part[]; scans: ScanPlacement[] }

/** Marks an empty group as the place a scanned model goes (see `scanned` in the prop kit). */
export const SCAN_URL = 'scanUrl'

export function recipeOf(model: Group): Recipe {
  const recipe: Recipe = { parts: [], scans: [] }
  model.updateMatrixWorld(true)
  const toModel = new Matrix4().copy(model.matrixWorld).invert()
  model.traverse((object) => {
    const matrix = new Matrix4().multiplyMatrices(toModel, object.matrixWorld)
    const url: unknown = object.userData[SCAN_URL]
    if (typeof url === 'string') recipe.scans.push({ url, matrix })
    else if (object instanceof Mesh && visibleInModel(object, model)) recipe.parts.push(...partsOf(object, matrix))
  })
  return recipe
}

function visibleInModel(object: Object3D, model: Group): boolean {
  for (let node: Object3D | null = object; node && node !== model; node = node.parent) if (!node.visible) return false
  return true
}

function partsOf(mesh: Mesh, matrix: Matrix4): Part[] {
  const geometry: BufferGeometry = mesh.geometry
  const whole = geometry.index ? geometry.index.count : geometry.attributes.position.count
  const start = geometry.drawRange.start
  const count = Math.min(whole - start, geometry.drawRange.count)
  const castShadow = mesh.castShadow
  if (!Array.isArray(mesh.material)) return [{ geometry, material: mesh.material, matrix, start, count, castShadow }]
  const materials: Material[] = mesh.material
  return geometry.groups.map((group) => ({
    geometry, material: materials[group.materialIndex ?? 0], matrix, start: group.start, count: group.count, castShadow,
  }))
}
