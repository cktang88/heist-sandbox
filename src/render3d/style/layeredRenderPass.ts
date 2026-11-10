import type { OrthographicCamera, PerspectiveCamera, Scene, WebGLRenderer, WebGLRenderTarget } from 'three'
import { Pass } from 'three/examples/jsm/postprocessing/Pass.js'

/**
 * Draws the scene for the orthographic (pixel) look in two layers: first everything behind the building with
 * the usual perspective camera, so the far skyline keeps its size and drifts slower than the level; then the
 * depth is cleared and the building slice is drawn on top with the orthographic camera.
 *
 * The two cameras share one position and orientation (only their projections differ), so anything that reads
 * the camera's world matrix, such as sky shading, sees the same view. Their clip planes meet at `split`
 * (a distance from the camera), so nothing is drawn twice. Clearing depth in between leaves the backdrop at
 * "infinitely far", which the outline and occlusion passes read as open sky.
 */
export class LayeredRenderPass extends Pass {
  constructor(
    private readonly scene: Scene,
    private readonly far: PerspectiveCamera,
    private readonly near: OrthographicCamera,
  ) {
    super()
    this.needsSwap = false
  }

  render(renderer: WebGLRenderer, _writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget): void {
    const autoClear = renderer.autoClear
    const { autoUpdate, needsUpdate } = renderer.shadowMap
    renderer.autoClear = false
    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer)
    renderer.clear()
    // Shadow maps do not depend on the camera; draw them once, with the main layer.
    renderer.shadowMap.autoUpdate = false
    renderer.shadowMap.needsUpdate = false
    renderer.render(this.scene, this.far)
    renderer.shadowMap.autoUpdate = autoUpdate
    renderer.shadowMap.needsUpdate = needsUpdate
    renderer.clearDepth()
    renderer.render(this.scene, this.near)
    renderer.autoClear = autoClear
  }
}
