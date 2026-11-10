import { CanvasTexture, Color, InstancedMesh, Matrix4, MeshBasicMaterial, PlaneGeometry, Quaternion, Vector3 } from 'three'
import type { World } from '../../game/world'
import { isSolidAt } from '../../game/tiles'
import { BACK } from '../levelMesh'
import { fractalNoise } from '../noise'
import { cellSeed } from './quads'

/** Scorch marks stay for the rest of the heist; past this many, the oldest are reused. */
export const MAX_SCORCH = 480
const HIDDEN = new Matrix4().makeScale(0, 0, 0)

/** A ragged dark blotch, darkest in the middle. */
function blotch(): CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const c = canvas.getContext('2d')!
  const pixels = c.createImageData(size, size)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const r = Math.hypot(x / size - 0.5, y / size - 0.5) * 2
      const grain = fractalNoise(x / size, y / size, 4, 11, 4)
      const alpha = Math.max(0, Math.min(1, (1 - r - (grain - 0.5) * 0.9) * 1.6)) * (0.55 + grain * 0.6)
      const at = (y * size + x) * 4
      pixels.data[at] = pixels.data[at + 1] = pixels.data[at + 2] = 255
      pixels.data[at + 3] = Math.round(Math.min(1, alpha) * 255)
    }
  }
  c.putImageData(pixels, 0, 0)
  return new CanvasTexture(canvas)
}

export type ScorchFx = { mesh: InstancedMesh; burn(world: World, x: number, y: number, size: number): void }

/**
 * Soot left on the back wall and floor where fire burned or something exploded.
 * Each mark is placed once and never touched again, so the cost is one draw call however many there are.
 */
export function createScorch(): ScorchFx {
  const material = new MeshBasicMaterial({ color: 0xffffff, alphaMap: blotch(), transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
  const mesh = new InstancedMesh(new PlaneGeometry(1, 1), material, MAX_SCORCH)
  mesh.frustumCulled = false
  for (let index = 0; index < MAX_SCORCH; index += 1) mesh.setMatrixAt(index, HIDDEN)
  mesh.setColorAt(0, new Color(0, 0, 0))
  mesh.renderOrder = 1
  const marked = new Set<number>()
  let next = 0
  const matrix = new Matrix4()
  const turn = new Quaternion()
  const flat = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2)
  const spin = new Quaternion()
  const place = new Vector3()
  const scale = new Vector3()
  const soot = new Color()

  const add = (seed: number, position: Vector3, rotation: Quaternion, size: number) => {
    scale.set(size, size * (0.75 + seed * 0.4), 1)
    mesh.setMatrixAt(next, matrix.compose(position, rotation, scale))
    // Not pure black: old soot on concrete reads as a deep brown-grey.
    soot.setRGB(0.035 + seed * 0.02, 0.03 + seed * 0.015, 0.025)
    mesh.setColorAt(next, soot)
    next = (next + 1) % MAX_SCORCH
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }

  return {
    mesh,
    burn(world, x, y, size) {
      const tileX = Math.floor(x)
      const tileY = Math.floor(y)
      const key = tileY * world.grid.width + tileX
      if (marked.has(key)) return
      marked.add(key)
      const seed = cellSeed(tileX, tileY)
      const indoors = world.interiors.some((area) => area.kind === 'room' && x >= area.x && x < area.x + area.w && y >= area.y && y < area.y + area.h)
      if (indoors) {
        // Heat climbs, so the stain on the wall sits above the flames.
        spin.setFromAxisAngle(place.set(0, 0, 1), seed * Math.PI * 2)
        add(seed, place.set(x + (seed - 0.5) * 0.4, -y + size * 0.35, BACK + 0.03 + seed * 0.01), spin, size * 1.1)
      }
      for (let below = tileY; below <= tileY + 2; below += 1) {
        if (!isSolidAt(world.grid, tileX + 0.5, below + 0.5)) continue
        turn.copy(flat).multiply(spin.setFromAxisAngle(place.set(0, 0, 1), seed * 9))
        add(seed, place.set(x, -below + 0.012, -0.95), turn, size)
        break
      }
    },
  }
}
