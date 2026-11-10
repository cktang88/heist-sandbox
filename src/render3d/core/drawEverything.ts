import type { Camera, Object3D, Scene, WebGLRenderer } from 'three'

/**
 * Draws every object of `root` once, hidden and off-screen ones included, so that the first time any of them comes
 * into view during play its geometry, textures and shaders are already on the GPU. It is done once, on the last
 * frame behind the loading screen; without it, walking into a new part of the site uploaded hundreds of textures and
 * buffers in one frame.
 *
 * Lights are left alone: making a hidden light visible changes the light count, which every shader is built for.
 */
export function drawEverything(renderer: WebGLRenderer, scene: Scene, camera: Camera, root: Object3D): void {
  const changed: { object: Object3D; visible: boolean; culled: boolean }[] = []
  root.traverse((object) => {
    if ((object as { isLight?: boolean }).isLight) return
    if (object.visible && !object.frustumCulled) return
    changed.push({ object, visible: object.visible, culled: object.frustumCulled })
    object.visible = true
    object.frustumCulled = false
  })
  renderer.render(scene, camera)
  for (const { object, visible, culled } of changed) {
    object.visible = visible
    object.frustumCulled = culled
  }
}
