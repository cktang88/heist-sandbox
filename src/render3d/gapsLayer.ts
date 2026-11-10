import { CylinderGeometry, Group, InstancedMesh, Object3D, type Material } from 'three'
import { inView, type LayerFactory } from './layer'
import { BACK } from './levelMesh'
import { BOX, matte } from './props/kit'

/** Walk-past hole tiles drawn at once; the nearest to the view win. */
const MAX_TILES = 96
/** Each tile's strip is two half-tile slabs with different fronts, so the broken edge is ragged. */
const PIECES = 2
const CHUNKS = 2
const BARS = 2
/** Where the broken front edge of the remaining strip sits in depth, and how far it wanders either way. */
const EDGE_Z = -1.0
const EDGE_WANDER = 0.18
/** Moving the view this far (in tiles) re-picks which holes are drawn. */
const REPICK = 6
const SEAM = 0.002
const REBAR = new CylinderGeometry(1, 1, 1, 5)
const REBAR_STEEL = matte(0x5a4032, 0.7, 0.6)
const RUBBLE = matte(0x77736c, 0.95)
const FALLBACK_CONCRETE = matte(0x8d9199, 0.9)

/** A steady pseudo-random number in 0..1 for one tile, so a hole looks the same every frame. */
function grain(tile: number, salt: number): number {
  const value = Math.sin(tile * 12.9898 + salt * 78.233) * 43758.5453
  return value - Math.floor(value)
}

/**
 * The back of a holed floor slab, still standing behind the hole: a strip of concrete from the back wall to a
 * ragged broken edge about a third of the way forward, with chunks hanging off that edge and rebar poking out.
 * It shows the player (and explains why guards can) walk past the hole on the back of the slab.
 * Only walk-past holes near the view are drawn, as three instanced meshes picked again only when the holes change.
 */
export const createGapsLayer: LayerFactory = (_world, materials) => {
  const group = new Group()
  const concrete: Material = materials.concrete ?? FALLBACK_CONCRETE
  const strips = new InstancedMesh(BOX, concrete, MAX_TILES * PIECES)
  const chunks = new InstancedMesh(BOX, RUBBLE, MAX_TILES * CHUNKS)
  const bars = new InstancedMesh(REBAR, REBAR_STEEL, MAX_TILES * BARS)
  for (const mesh of [strips, chunks, bars]) {
    mesh.count = 0
    mesh.frustumCulled = false
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
  }
  const place = new Object3D()
  let pickedVersion = -1
  let pickedView = { x: Number.NaN, y: Number.NaN }
  const picked: number[] = []

  function pick(width: number, walkable: ReadonlySet<number>, view: { x: number; y: number }): void {
    picked.length = 0
    for (const tile of walkable) {
      if (inView({ dt: 0, view, aim: view }, tile % width, Math.floor(tile / width), REPICK)) picked.push(tile)
    }
    const distance = (tile: number): number => Math.abs((tile % width) - view.x) + Math.abs(Math.floor(tile / width) - view.y)
    if (picked.length > MAX_TILES) picked.sort((a, b) => distance(a) - distance(b) || a - b).length = MAX_TILES
  }

  function build(width: number): void {
    picked.forEach((tile, slot) => {
      const x = tile % width
      const top = -Math.floor(tile / width)
      for (let piece = 0; piece < PIECES; piece += 1) {
        const front = EDGE_Z + (grain(tile, piece) * 2 - 1) * EDGE_WANDER
        place.position.set(x + (piece + 0.5) / PIECES, top - 0.5, (BACK + front) / 2)
        place.rotation.set(0, 0, 0)
        place.scale.set(1 / PIECES - SEAM, 1 - SEAM, front - BACK)
        place.updateMatrix()
        strips.setMatrixAt(slot * PIECES + piece, place.matrix)
      }
      for (let chunk = 0; chunk < CHUNKS; chunk += 1) {
        const size = 0.16 + grain(tile, 10 + chunk) * 0.16
        place.position.set(x + 0.2 + grain(tile, 20 + chunk) * 0.6, top - 0.75 - grain(tile, 30 + chunk) * 0.25, EDGE_Z + 0.05)
        place.rotation.set(grain(tile, 40 + chunk) * 3, grain(tile, 50 + chunk) * 3, grain(tile, 60 + chunk) * 3)
        place.scale.set(size, size * 0.8, size)
        place.updateMatrix()
        chunks.setMatrixAt(slot * CHUNKS + chunk, place.matrix)
      }
      for (let bar = 0; bar < BARS; bar += 1) {
        const length = 0.3 + grain(tile, 70 + bar) * 0.35
        // Bars run front to back in the slab; the blast bent their broken ends down a little.
        place.rotation.set(Math.PI / 2 + 0.15 + grain(tile, 80 + bar) * 0.4, 0, (grain(tile, 90 + bar) - 0.5) * 0.5)
        place.position.set(x + 0.25 + bar * 0.5, top - 0.35 - bar * 0.3, EDGE_Z + length / 2 - 0.05)
        place.scale.set(0.025, length, 0.025)
        place.updateMatrix()
        bars.setMatrixAt(slot * BARS + bar, place.matrix)
      }
    })
    strips.count = picked.length * PIECES
    chunks.count = picked.length * CHUNKS
    bars.count = picked.length * BARS
    for (const mesh of [strips, chunks, bars]) mesh.instanceMatrix.needsUpdate = true
  }

  return {
    group,
    update(now, frame) {
      const holes = now.gaps.holes
      const live = holes.grid === now.grid
      group.visible = live && holes.walkable.size > 0
      if (!group.visible) return
      const moved = Math.abs(frame.view.x - pickedView.x) > REPICK || Math.abs(frame.view.y - pickedView.y) > REPICK
      if (holes.version === pickedVersion && !moved) return
      pickedVersion = holes.version
      pickedView = { x: frame.view.x, y: frame.view.y }
      pick(now.grid.width, holes.walkable, pickedView)
      build(now.grid.width)
    },
  }
}
