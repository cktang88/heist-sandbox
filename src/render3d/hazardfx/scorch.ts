import { CanvasTexture, Color, Group, InstancedMesh, Matrix4, MeshBasicMaterial, PlaneGeometry, Quaternion, Vector3 } from 'three'
import type { World } from '../../game/world'
import { isSolidAt, type Grid } from '../../game/tiles'
import { BACK } from '../levelMesh'
import { fractalNoise } from '../noise'
import { cellSeed } from './quads'

/** Scorch marks stay for the rest of the heist; past this many (per surface), the oldest are reused. */
export const MAX_SCORCH = 320
const HIDDEN = new Matrix4().makeScale(0, 0, 0)
const SIZE = 128

/** Paints an alpha-only texture from a function of (x, y) in 0..1, y = 0 at the top. */
function paint(alphaAt: (x: number, y: number, grain: number) => number): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE
  const c = canvas.getContext('2d')!
  const pixels = c.createImageData(SIZE, SIZE)
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const at = (y * SIZE + x) * 4
      pixels.data[at] = pixels.data[at + 1] = pixels.data[at + 2] = 255
      pixels.data[at + 3] = Math.round(Math.max(0, Math.min(1, alphaAt(x / SIZE, y / SIZE, fractalNoise(x / SIZE, y / SIZE, 4, 11, 4)))) * 255)
    }
  }
  c.putImageData(pixels, 0, 0)
  return new CanvasTexture(canvas)
}

/** A ragged round burn on the floor, darkest in the middle. */
const floorBurn = (x: number, y: number, grain: number) => {
  const r = Math.hypot(x - 0.5, y - 0.5) * 2
  return Math.pow(Math.max(0, 1 - r - (grain - 0.5) * 0.6), 1.4) * (0.4 + grain * 0.8)
}

/** Soot on a wall climbs in a widening plume, streaky and darkest just above the flames. */
const wallSoot = (x: number, y: number, grain: number) => {
  const up = 1 - y
  const halfWidth = 0.2 + up * 0.3
  const across = Math.abs(x - 0.5) / halfWidth
  const streaks = fractalNoise(x, 0.3, 6, 5, 3)
  const body = Math.pow(Math.max(0, 1 - across - (grain - 0.5) * 0.7), 1.8)
  return body * Math.pow(1 - up, 1.2) * Math.min(1, up * 5) * (0.35 + streaks * 0.75)
}

/**
 * How far up and down the back wall a soot plume from a burn at (x, y) reaches, in game rows (y down). It climbs about
 * 1.3 sizes and hangs 0.2 below, but stops at the ceiling: soot does not go on through the slab onto the wall of the
 * room upstairs (a charge on the ceiling used to stain the room above).
 */
export function plumeSpan(grid: Grid, x: number, y: number, size: number): { top: number; bottom: number } {
  const bottom = y + size * 0.2
  let top = y - size * 1.3
  for (let row = Math.floor(y) - 1; row >= Math.floor(top); row -= 1) {
    if (!isSolidAt(grid, x, row + 0.5)) continue
    top = row + 1
    break
  }
  return { top: Math.min(top, bottom - 0.3), bottom }
}

function decals(texture: CanvasTexture): InstancedMesh {
  const material = new MeshBasicMaterial({ color: 0xffffff, alphaMap: texture, transparent: true, opacity: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
  const mesh = new InstancedMesh(new PlaneGeometry(1, 1), material, MAX_SCORCH)
  mesh.frustumCulled = false
  for (let index = 0; index < MAX_SCORCH; index += 1) mesh.setMatrixAt(index, HIDDEN)
  mesh.setColorAt(0, new Color(0, 0, 0))
  mesh.renderOrder = 1
  return mesh
}

export type ScorchFx = {
  group: Group
  burn(world: World, x: number, y: number, size: number): void
  /** Drops burns whose floor has since been blown away, so none is left floating in the air. */
  refresh(world: World): void
}

/**
 * Soot left on the back wall and floor where fire burned or something exploded.
 * Each mark is placed once and never touched again, so the cost is two draw calls however many there are.
 */
export function createScorch(): ScorchFx {
  const wall = decals(paint(wallSoot))
  const floor = decals(paint(floorBurn))
  const group = new Group()
  group.add(wall, floor)
  const next = new Map<InstancedMesh, number>([[wall, 0], [floor, 0]])
  const marked = new Set<number>()
  const matrix = new Matrix4()
  const flat = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2)
  const spin = new Quaternion()
  const turn = new Quaternion()
  const upright = new Quaternion()
  const axis = new Vector3(0, 0, 1)
  const place = new Vector3()
  const scale = new Vector3()
  const soot = new Color()
  /** The floor tile under each floor burn (-1 for an empty slot), and the grid version they were last checked at. */
  const under = new Int32Array(MAX_SCORCH).fill(-1)
  let checked = -1

  const add = (mesh: InstancedMesh, seed: number, rotation: Quaternion) => {
    const slot = next.get(mesh)!
    mesh.setMatrixAt(slot, matrix.compose(place, rotation, scale))
    // Not pure black: old soot on concrete reads as a deep brown-grey.
    soot.setRGB(0.035 + seed * 0.02, 0.03 + seed * 0.015, 0.025)
    mesh.setColorAt(slot, soot)
    next.set(mesh, (slot + 1) % MAX_SCORCH)
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }

  return {
    group,
    burn(world, x, y, size) {
      const tileX = Math.floor(x)
      const tileY = Math.floor(y)
      const key = tileY * world.grid.width + tileX
      if (marked.has(key)) return
      marked.add(key)
      const seed = cellSeed(tileX, tileY)
      const indoors = world.interiors.some((area) => area.kind === 'room' && x >= area.x && x < area.x + area.w && y >= area.y && y < area.y + area.h)
      if (indoors) {
        // Heat climbs, so the plume's foot sits at the flames and it widens up the wall.
        const span = plumeSpan(world.grid, x, y, size)
        place.set(x + (seed - 0.5) * 0.4, -(span.top + span.bottom) / 2, BACK + 0.03 + seed * 0.01)
        scale.set(size * (0.8 + seed * 0.3), span.bottom - span.top, 1)
        add(wall, seed, upright)
      }
      for (let below = tileY; below <= tileY + 2; below += 1) {
        if (!isSolidAt(world.grid, tileX + 0.5, below + 0.5)) continue
        turn.copy(flat).multiply(spin.setFromAxisAngle(axis, seed * 9))
        place.set(x, -below + 0.012, -0.95)
        scale.set(size, size * 1.4, 1)
        under[next.get(floor)!] = below * world.grid.width + tileX
        add(floor, seed, turn)
        break
      }
    },
    refresh(world) {
      if (world.grid.version === checked) return
      checked = world.grid.version
      const width = world.grid.width
      let changed = false
      for (let slot = 0; slot < MAX_SCORCH; slot += 1) {
        const key = under[slot]
        if (key < 0 || isSolidAt(world.grid, (key % width) + 0.5, Math.floor(key / width) + 0.5)) continue
        floor.setMatrixAt(slot, HIDDEN)
        under[slot] = -1
        changed = true
      }
      if (changed) floor.instanceMatrix.needsUpdate = true
    },
  }
}
