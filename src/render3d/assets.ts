import { Mesh, type Group } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const loader = new GLTFLoader()
const cache = new Map<string, Promise<Group>>()

/**
 * Loads a glTF model from `public/` once and hands out copies that share its geometry and materials.
 * `url` has no leading slash, e.g. `models/barrel/barrel.gltf`.
 */
export function loadModel(url: string): Promise<Group> {
  return loadShared(url).then((scene) => scene.clone(true))
}

/** The loaded model itself, shared by every caller: read it, never change or place it. */
export function loadShared(url: string): Promise<Group> {
  let pending = cache.get(url)
  if (!pending) {
    pending = loader.loadAsync(`${import.meta.env.BASE_URL}${url}`).then((gltf) => {
      gltf.scene.traverse((child) => {
        if (!(child instanceof Mesh)) return
        child.castShadow = true
        child.receiveShadow = true
      })
      return gltf.scene
    })
    cache.set(url, pending)
  }
  return pending
}
