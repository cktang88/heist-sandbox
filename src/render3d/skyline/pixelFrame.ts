import { CAMERA_DISTANCE, TILES_TALL } from '../style/cameraRig'
import { distanceOf, LAYERS, spanAt, type LayerName, type LayerSpec, type Sheet } from './frame'

/**
 * Sizes for the pixel backdrop. Each layer is painted with one texel per art pixel at its own depth (for the
 * pixel look's 360 art lines), so after the shader snaps a layer to whole art pixels its texels land one to
 * one on the screen's art pixels: crisp, and still as the camera pans.
 */

/** Art lines the pixel texture is drawn for (the `pixel` look). Other heights stretch it by nearest texel. */
export const DESIGN_LINES = 360

/** World units per texel (one art pixel) at depth `z`. */
export function texelAt(z: number): number {
  return (TILES_TALL / DESIGN_LINES) * (distanceOf(z) / CAMERA_DISTANCE)
}

/** How far below the street each layer is painted (tiles); further down, a flat street colour takes over. */
const BELOW: Record<LayerName, number> = { far: 4, mid: 6, near: 10 }

/** A layer's painted sheet in whole texels: `left`/`bottom` in world units, `width`/`height` in texels. */
export type PixelSheet = { name: LayerName; z: number; left: number; bottom: number; texel: number; width: number; height: number }

export function pixelSheet(spec: LayerSpec, levelWidth: number, ground: number): PixelSheet {
  const texel = texelAt(spec.z)
  const [left, right] = spanAt(spec.z, levelWidth)
  const bottom = ground - BELOW[spec.name]
  return {
    name: spec.name,
    z: spec.z,
    left,
    bottom,
    texel,
    width: Math.ceil((right - left) / texel),
    height: Math.ceil((ground + spec.rise - bottom) / texel),
  }
}

export function sheetOf(sheet: PixelSheet): Sheet {
  return { left: sheet.left, right: sheet.left + sheet.width * sheet.texel, bottom: sheet.bottom, top: sheet.bottom + sheet.height * sheet.texel }
}

/** Part of a layer copied to the atlas: columns `x`..`x + w` of the layer, placed at (`atlasX`, `atlasY`). */
export type Piece = { layer: number; x: number; w: number; atlasX: number; atlasY: number }

/** Free texels between pieces, so nearest sampling at an edge never picks up a neighbour. */
const GAP = 2

/**
 * Packs layers (`width` x `height` texels) into a square atlas on shelves, tallest first. A layer that
 * does not fit the rest of a shelf is cut there and continues on the next one: the backdrop draws each
 * piece as its own quad, so the cut never shows. Returns null if they do not fit.
 */
export function packLayers(sizes: readonly { width: number; height: number }[], atlas: number): Piece[] | null {
  const order = sizes.map((_, index) => index).sort((a, b) => sizes[b].height - sizes[a].height)
  const pieces: Piece[] = []
  let [shelfY, shelfHeight, x] = [0, 0, 0]
  for (const layer of order) {
    const { width, height } = sizes[layer]
    let done = 0
    while (done < width) {
      if (x === 0) shelfHeight = Math.max(shelfHeight, height)
      if (height > shelfHeight || atlas - x < 16) {
        shelfY += shelfHeight + GAP
        ;[shelfHeight, x] = [height, 0]
      }
      if (shelfY + height > atlas) return null
      const w = Math.min(width - done, atlas - x)
      pieces.push({ layer, x: done, w, atlasX: x, atlasY: shelfY })
      done += w
      x += w + GAP
    }
  }
  return pieces
}

/** The three layers' pixel sheets, far to near. */
export function pixelSheets(levelWidth: number, ground: number): PixelSheet[] {
  return LAYERS.map((spec) => pixelSheet(spec, levelWidth, ground))
}
