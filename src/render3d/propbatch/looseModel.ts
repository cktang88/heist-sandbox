import { Group, Mesh } from 'three'
import { loadModel } from '../assets'
import type { Recipe } from './recipe'

/**
 * A stand-alone model of one prop, rebuilt from its recipe so it looks exactly like its batched copy. Used for the
 * few props that move (dragged, kicked over, thrown, falling), which cannot stay in a static batch.
 */
export function modelFromRecipe(recipe: Recipe, castShadow: boolean): Group {
  const model = new Group()
  for (const part of recipe.parts) {
    const mesh = new Mesh(part.geometry, part.material)
    mesh.matrixAutoUpdate = false
    mesh.matrix.copy(part.matrix)
    mesh.castShadow = castShadow && part.castShadow
    mesh.receiveShadow = true
    model.add(mesh)
  }
  for (const scan of recipe.scans) {
    loadModel(scan.url).then((scene) => {
      scene.matrixAutoUpdate = false
      scene.matrix.copy(scan.matrix)
      scene.traverse((child) => {
        child.castShadow = castShadow
      })
      model.add(scene)
    }).catch(() => undefined)
  }
  return model
}
