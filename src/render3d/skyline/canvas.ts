/** Small canvas utilities shared by the backdrop painters. Browser only. */

export function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

export function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const c = canvas.getContext('2d')
  if (!c) throw new Error('2D canvas is not available')
  return c
}

let filterWorks: boolean | null = null

/** Canvas blur filters are missing in some browsers (older Safari); detect once. */
function canFilter(c: CanvasRenderingContext2D): boolean {
  if (filterWorks === null) {
    c.filter = 'blur(2px)'
    filterWorks = c.filter === 'blur(2px)'
    c.filter = 'none'
  }
  return filterWorks
}

/**
 * Draws `source` into `target` at (x, y), blurred by about `sigma` pixels and clipped to the source's size,
 * so the blur never spills into a neighbouring region of the atlas. Without filter support it shrinks and
 * re-enlarges the picture instead, which softens it nearly as well.
 */
export function drawSoft(target: CanvasRenderingContext2D, source: HTMLCanvasElement, x: number, y: number, sigma: number): void {
  target.save()
  target.beginPath()
  target.rect(x, y, source.width, source.height)
  target.clip()
  if (sigma < 0.3) target.drawImage(source, x, y)
  else if (canFilter(target)) {
    target.filter = `blur(${sigma.toFixed(2)}px)`
    target.drawImage(source, x, y)
    target.filter = 'none'
  } else {
    const factor = Math.max(1, sigma * 1.4)
    const small = makeCanvas(Math.max(1, Math.round(source.width / factor)), Math.max(1, Math.round(source.height / factor)))
    const s = context(small)
    s.imageSmoothingQuality = 'high'
    s.drawImage(source, 0, 0, small.width, small.height)
    target.imageSmoothingQuality = 'high'
    target.drawImage(small, x, y, source.width, source.height)
  }
  target.restore()
}
