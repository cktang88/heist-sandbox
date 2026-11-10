import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three'

/**
 * A soft dark patch on the floor under a standing person, instead of drawing every body part again into each nearby
 * lamp's shadow map (that was about a third of all draw calls in a room with a few guards). From the fixed side view
 * a real shadow of a person mostly lands on the floor right under them anyway.
 */

/** Size of the patch in tiles: a little wider than a person, and as deep as the walking lane. */
const WIDTH = 1.1
const DEPTH = 0.7
const STRENGTH = 0.5

function softDisc(): CanvasTexture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')!
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.55, 'rgba(255,255,255,0.55)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, size, size)
  return new CanvasTexture(canvas)
}

let shared: { geometry: PlaneGeometry; material: MeshBasicMaterial } | null = null

function parts(): { geometry: PlaneGeometry; material: MeshBasicMaterial } {
  if (shared) return shared
  const geometry = new PlaneGeometry(WIDTH, DEPTH)
  // Lying flat, facing up.
  geometry.rotateX(-Math.PI / 2)
  const material = new MeshBasicMaterial({ color: 0x000000, alphaMap: softDisc(), transparent: true, opacity: STRENGTH, depthWrite: false })
  shared = { geometry, material }
  return shared
}

/** One person's patch; place it at their feet each frame. */
export function blobShadow(): Mesh {
  const { geometry, material } = parts()
  const blob = new Mesh(geometry, material)
  // Drawn after the floor it lies on.
  blob.renderOrder = 1
  return blob
}

/** Puts the patch under feet at (x, feetY) in game space, hidden while the person is off the ground. */
export function placeBlob(blob: Mesh, x: number, feetY: number, grounded: boolean): void {
  blob.visible = grounded
  if (grounded) blob.position.set(x, -feetY + 0.02, 0)
}
