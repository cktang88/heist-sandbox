import { CAMERA_DISTANCE, TILES_TALL } from '../style/cameraRig'

/**
 * Where the backdrop sits and how big it must be. Everything is in world units (tiles, y up), so the
 * perspective camera gives each layer its own parallax for free as the view pans or drops from the plane.
 */

/** A rectangle of world space at one depth. */
export type Sheet = { left: number; right: number; bottom: number; top: number }

export type LayerName = 'far' | 'mid' | 'near'

export type LayerSpec = {
  name: LayerName
  /** Depth of the layer's plane (the walking lane is z = 0, the camera at z = CAMERA_DISTANCE). */
  z: number
  /** Tallest building above the street, and how much street is painted below it. */
  rise: number
  below: number
  /** Share of the haze colour mixed into the buildings: atmospheric perspective. */
  haze: number
}

/** Widest screen shape the backdrop is sized for (21:9 is 2.33). */
const WIDEST = 2.4
/** The camera keeps at least this far inside the level's sides and top (half the view). */
const EDGE = 21
const TOP = TILES_TALL / 2
/** The camera draws nothing beyond 400 units; the sky stays inside that. */
export const SKY_Z = -345
/** The nearest layer reaches this far below the street, so the view is filled even from the basement. */
const COVER_BELOW = 110

/** Far to near, the order they are drawn in. */
export const LAYERS: readonly LayerSpec[] = [
  { name: 'far', z: -290, rise: 360, below: 14, haze: 0.7 },
  { name: 'mid', z: -135, rise: 175, below: 14, haze: 0.48 },
  { name: 'near', z: -48, rise: 70, below: 16, haze: 0.24 },
]

export function distanceOf(z: number): number {
  return CAMERA_DISTANCE - z
}

/** World units per screen pixel (at 720 lines) at depth `z`. */
export function worldPerPixel(z: number): number {
  return (TILES_TALL / 720) * (distanceOf(z) / CAMERA_DISTANCE)
}

/**
 * Lens blur ("circle of confusion") in screen pixels at 720 lines for a lens focused on the walking lane:
 * it grows with distance and levels off, so the far skyline is the softest and the near blocks the sharpest.
 */
export const BLUR_MAX_PX = 16
export function blurPixels(z: number): number {
  return BLUR_MAX_PX * (1 - CAMERA_DISTANCE / distanceOf(z))
}

/** The same blur as a radius in world units at that depth: the size of an out-of-focus light's disc. */
export function blurRadius(z: number): number {
  return blurPixels(z) * worldPerPixel(z)
}

/** Half the view's width per unit of distance from the camera, at the widest screen shape. */
export const WIDE_FACTOR = (TOP / CAMERA_DISTANCE) * WIDEST

/** Leftmost and rightmost camera centre along the level. */
export function cameraSpan(levelWidth: number): [number, number] {
  return [EDGE, levelWidth - EDGE]
}

function halfTall(z: number): number {
  return (TOP * distanceOf(z)) / CAMERA_DISTANCE
}

/** Left and right edges a plane at depth `z` must reach so every camera position along the level sees it filled. */
export function spanAt(z: number, levelWidth: number): [number, number] {
  const halfWide = halfTall(z) * WIDEST
  return [EDGE - halfWide, levelWidth - EDGE + halfWide]
}

/** The painted part of a layer: from a little below the street to the tallest roof. */
export function layerSheet(spec: LayerSpec, levelWidth: number, ground: number): Sheet {
  const [left, right] = spanAt(spec.z, levelWidth)
  return { left, right, bottom: ground - spec.below, top: ground + spec.rise }
}

/** The lowest point any layer card must reach (only the nearest one is seen there). */
export function coverBottom(ground: number): number {
  return ground - COVER_BELOW
}

/** The sky card: tall enough for the parachute drop above the top of the level. */
export function skySheet(levelWidth: number, ground: number): Sheet {
  const [left, right] = spanAt(SKY_Z, levelWidth)
  return { left, right, bottom: ground - 30, top: -TOP + halfTall(SKY_Z) + 10 }
}
