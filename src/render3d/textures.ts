import { CanvasTexture, LinearSRGBColorSpace, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace } from 'three'
import type { Surface } from './surfaces'

const SIZE = 512
const BUMP_STRENGTH = 3.2

function canvasOf(pixels: Uint8ClampedArray<ArrayBuffer>): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  canvas.getContext('2d')!.putImageData(new ImageData(pixels, SIZE, SIZE), 0, 0)
  return canvas
}

function texture(pixels: Uint8ClampedArray<ArrayBuffer>, isColor: boolean, anisotropy: number): CanvasTexture {
  const map = new CanvasTexture(canvasOf(pixels))
  map.wrapS = RepeatWrapping
  map.wrapT = RepeatWrapping
  map.colorSpace = isColor ? SRGBColorSpace : LinearSRGBColorSpace
  map.anisotropy = anisotropy
  return map
}

/**
 * Bakes a surface description into the maps a physically based material needs:
 * colour, a normal map worked out from the height field, and roughness/metalness.
 */
export function bakeMaterial(surface: Surface, anisotropy: number): MeshStandardMaterial {
  const color = new Uint8ClampedArray(SIZE * SIZE * 4)
  const normal = new Uint8ClampedArray(SIZE * SIZE * 4)
  const orm = new Uint8ClampedArray(SIZE * SIZE * 4)
  const heights = new Float32Array(SIZE * SIZE)

  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const sample = surface(x / SIZE, y / SIZE)
      const index = (y * SIZE + x) * 4
      // Surfaces are authored in display colours, so they are stored as-is and flagged sRGB.
      color[index] = sample.r * 255
      color[index + 1] = sample.g * 255
      color[index + 2] = sample.b * 255
      color[index + 3] = 255
      heights[y * SIZE + x] = sample.height
      // Layout three.js expects: green = roughness, blue = metalness. Red doubles as ambient occlusion in the dips.
      orm[index] = (0.55 + Math.min(1, sample.height) * 0.45) * 255
      orm[index + 1] = sample.rough * 255
      orm[index + 2] = sample.metal * 255
      orm[index + 3] = 255
    }
  }

  const at = (x: number, y: number) => heights[((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE)]
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * BUMP_STRENGTH
      const dy = (at(x, y + 1) - at(x, y - 1)) * BUMP_STRENGTH
      const length = Math.hypot(dx, dy, 1)
      const index = (y * SIZE + x) * 4
      normal[index] = (-dx / length * 0.5 + 0.5) * 255
      normal[index + 1] = (dy / length * 0.5 + 0.5) * 255
      normal[index + 2] = (1 / length * 0.5 + 0.5) * 255
      normal[index + 3] = 255
    }
  }

  const packed = texture(orm, false, anisotropy)
  return new MeshStandardMaterial({
    map: texture(color, true, anisotropy),
    normalMap: texture(normal, false, anisotropy),
    roughnessMap: packed,
    metalnessMap: packed,
    aoMap: packed,
    roughness: 1,
    metalness: 1,
    vertexColors: true,
  })
}
