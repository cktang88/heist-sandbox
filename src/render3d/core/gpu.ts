import { BufferGeometry, Mesh, MeshBasicMaterial, type Camera, type Object3D, type Scene, type Texture, type WebGLRenderer } from 'three'

/**
 * Lets layers prepare what they build before it is first drawn: shaders compiled and textures uploaded while the
 * object is still hidden, so neither happens in the middle of a frame of play.
 *
 * Layers are not handed the renderer, so an empty mesh that is always drawn (it has no triangles, so it costs one
 * skipped call) picks up the renderer, scene and camera in its `onBeforeRender` on every frame.
 */
type Target = { renderer: WebGLRenderer; scene: Scene; camera: Camera }

let target: Target | null = null
let pending = 0

/** One per level: until the new level's first frame is drawn, nothing counts as ready. */
export function createGpuProbe(): Mesh {
  target = null
  const probe = new Mesh(new BufferGeometry(), new MeshBasicMaterial({ colorWrite: false, depthWrite: false }))
  probe.frustumCulled = false
  probe.onBeforeRender = (renderer, scene, camera) => {
    if (scene.isScene) target = { renderer, scene: scene as Scene, camera }
  }
  return probe
}

/** True once the renderer has been seen (after the first drawn frame). */
export function gpuReady(): boolean {
  return target !== null
}

/**
 * Compiles every shader `object` needs for the real scene's lights, and uploads its textures, then calls `done`.
 * Before the first frame there is nothing to compile against, so `done` is called at once (the renderer's own warm-up
 * covers what exists then).
 */
export function prepare(object: Object3D, done: () => void): void {
  if (!target) {
    done()
    return
  }
  const { renderer, scene, camera } = target
  object.traverse((child) => {
    const material = (child as Mesh).material
    if (!material) return
    for (const one of Array.isArray(material) ? material : [material]) {
      for (const value of Object.values(one)) if ((value as Texture | null)?.isTexture) renderer.initTexture(value as Texture)
    }
  })
  pending += 1
  const finish = () => {
    pending -= 1
    done()
  }
  void renderer.compileAsync(object, camera, scene).then(finish, finish)
}

/** Objects still waiting for their shaders: the loading screen stays up until there are none. */
export function preparesPending(): number {
  return pending
}
