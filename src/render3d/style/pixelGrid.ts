/**
 * The art-pixel grid of the pixel look, and the camera snapping that keeps it still while the view moves.
 *
 * The screen keeps showing exactly `tilesTall` tiles from top to bottom at the walking lane, so the 2D
 * camera's mouse mapping (src/render/camera.ts) stays exact. Each art pixel is a whole number `scale` of
 * screen pixels; the scene is drawn into a small target of art pixels, one art pixel larger than the screen
 * on every side so the sub-pixel shift below never reveals an edge.
 */
export type PixelGrid = {
  /** Screen pixels per art pixel (a whole number). */
  scale: number
  /** Size of the low-resolution target, in art pixels, including the margin. */
  width: number
  height: number
  /** World units (tiles) per art pixel at the walking lane. */
  unit: number
}

const MARGIN = 1

export function pixelGrid(screenWidth: number, screenHeight: number, artHeight: number, tilesTall: number): PixelGrid {
  const scale = Math.max(1, Math.round(screenHeight / artHeight))
  return {
    scale,
    width: Math.ceil(screenWidth / scale) + 2 * MARGIN,
    height: Math.ceil(screenHeight / scale) + 2 * MARGIN,
    unit: (tilesTall * scale) / screenHeight,
  }
}

/**
 * Where the camera is really drawn from, and what is left over. The camera moves in whole art pixels, so
 * every static thing lands on the same art pixels frame after frame (no crawling edges, no swimming dither);
 * the leftover fraction is applied when upscaling, as a shift of whole screen pixels, so the motion the
 * player sees is still smooth.
 */
export type Snap = {
  /** Camera position to render from (world units). */
  x: number
  y: number
  /** Leftover between the wanted and the snapped position, in art pixels (-0.5..0.5). */
  residualX: number
  residualY: number
  /** The snapped position counted in art pixels: anchors the dither pattern to the world. */
  cellX: number
  cellY: number
}

export function snapToGrid(x: number, y: number, unit: number): Snap {
  const cellX = Math.round(x / unit)
  const cellY = Math.round(y / unit)
  return { x: cellX * unit, y: cellY * unit, residualX: x / unit - cellX, residualY: y / unit - cellY, cellX, cellY }
}
