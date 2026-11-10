import { OrthographicCamera, PerspectiveCamera } from 'three'
import type { Vec } from '../../game/types'
import { snapToGrid, type PixelGrid, type Snap } from './pixelGrid'

const FIELD_OF_VIEW = 30
/** Matches the 2D camera, which shows 24 tiles top to bottom at the play plane. */
export const TILES_TALL = 24
export const CAMERA_DISTANCE = TILES_TALL / 2 / Math.tan((FIELD_OF_VIEW * Math.PI) / 360)
/**
 * In the orthographic look, the building slice (z from about -2.4 to +0.5) is drawn orthographically and
 * everything further back than this, the far skyline, with perspective.
 */
const LAYER_SPLIT = CAMERA_DISTANCE + 4
const FAR = 400

/**
 * Both cameras look straight down the z axis at the walking lane from the same point. The perspective one
 * draws the default looks and the far backdrop; the orthographic one draws the building in the pixel look,
 * where every depth moves by the same number of pixels when the view pans, so snapping to the art-pixel grid
 * holds for the whole slice and not just one plane.
 */
export type CameraRig = {
  perspective: PerspectiveCamera
  orthographic: OrthographicCamera
  /** Points both cameras at the view (in tiles, y down), shaken by `jolt` tiles. With a grid, snaps to it and returns the leftover. */
  place(view: Vec, jolt: number, grid: PixelGrid | null): Snap | null
  /** With a grid (pixel look), the orthographic camera takes the building and the perspective one only the backdrop. */
  resize(aspect: number, grid: PixelGrid | null): void
}

export function createCameraRig(): CameraRig {
  const perspective = new PerspectiveCamera(FIELD_OF_VIEW, 1, 1, FAR)
  const orthographic = new OrthographicCamera(-1, 1, 1, -1, 1, LAYER_SPLIT)
  return {
    perspective,
    orthographic,
    place(view, jolt, grid) {
      // Shake is added before snapping, so in the pixel look it becomes whole-pixel jumps, as pixel art shakes.
      const x = view.x + (Math.random() - 0.5) * 2 * jolt
      const y = -view.y + (Math.random() - 0.5) * 2 * jolt
      const snap = grid ? snapToGrid(x, y, grid.unit) : null
      for (const camera of [perspective, orthographic]) {
        camera.position.set(snap?.x ?? x, snap?.y ?? y, CAMERA_DISTANCE)
        camera.lookAt(camera.position.x, camera.position.y, 0)
        camera.updateMatrixWorld()
      }
      return snap
    },
    resize(aspect, grid) {
      if (grid) {
        // The target is a little larger than the screen (see pixelGrid), and so is the frustum, at the same scale.
        const halfWidth = (grid.width * grid.unit) / 2
        const halfHeight = (grid.height * grid.unit) / 2
        Object.assign(orthographic, { left: -halfWidth, right: halfWidth, top: halfHeight, bottom: -halfHeight })
        orthographic.updateProjectionMatrix()
        // The backdrop camera covers the same margin, so the two layers line up at the edges too.
        Object.assign(perspective, { aspect: grid.width / grid.height, fov: (2 * Math.atan(halfHeight / CAMERA_DISTANCE) * 180) / Math.PI, near: LAYER_SPLIT })
      } else Object.assign(perspective, { aspect, fov: FIELD_OF_VIEW, near: 1 })
      perspective.updateProjectionMatrix()
    },
  }
}
