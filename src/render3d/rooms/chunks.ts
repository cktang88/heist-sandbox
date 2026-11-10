import { Group, Mesh, type BufferAttribute, type Material } from 'three'
import { isSolidAt, type Grid } from '../../game/tiles'
import type { Frame } from '../layer'
import { QuadBatch } from './batch'

/** Size of one chunk in tiles. A view is about 42 x 24 tiles, so at most four chunks are on screen. */
const CHUNK_W = 48
const CHUNK_H = 36
/** Half the view at the walking lane, widened for wide screens and for faces that stand in front of or behind it. */
const REACH_X = 30
const REACH_Y = 16

/** Faces that rest on particular tiles (a strip of floor finish on its slab) and vanish once any of them is gone. */
type Segment = { material: Material; from: number; to: number; tiles: readonly [number, number][]; gone: boolean }

type Chunk = {
  centreX: number
  centreY: number
  batches: Map<Material, QuadBatch>
  meshes: Map<Material, Mesh>
  segments: Segment[]
  checkedVersion: number
}

/**
 * Finish geometry grouped by area and by material: each chunk becomes one mesh per material it uses.
 * Chunks off screen are hidden and cost nothing per frame beyond one distance test.
 */
export class ChunkedFinishes {
  readonly group = new Group()
  private chunks = new Map<number, Chunk>()

  /** Where to add faces of `material` that sit around tile position (x, y) in game space. */
  batch(x: number, y: number, material: Material): QuadBatch {
    const chunk = this.chunkAt(x, y)
    return chunk.batches.get(material) ?? chunk.batches.set(material, new QuadBatch()).get(material)!
  }

  /** The faces added to `batch(x, y, material)` since `from` vanish when any of `tiles` stops being solid. */
  restOn(x: number, y: number, material: Material, from: number, tiles: readonly [number, number][]): void {
    const to = this.batch(x, y, material).mark
    if (to > from) this.chunkAt(x, y).segments.push({ material, from, to, tiles, gone: false })
  }

  /** Turns everything collected into meshes. Call once, after all faces are added. */
  build(shadowed: boolean): void {
    for (const chunk of this.chunks.values()) {
      for (const [material, batch] of chunk.batches) {
        if (batch.isEmpty) continue
        const mesh = new Mesh(batch.build(), material)
        mesh.receiveShadow = shadowed
        mesh.matrixAutoUpdate = false
        mesh.updateMatrix()
        chunk.meshes.set(material, mesh)
        this.group.add(mesh)
      }
      chunk.batches.clear()
    }
  }

  get meshCount(): number {
    let count = 0
    for (const chunk of this.chunks.values()) count += chunk.meshes.size
    return count
  }

  /** Shows chunks near the view, and folds away finishes whose support has been destroyed since last looked at. */
  update(grid: Grid, frame: Frame): void {
    for (const chunk of this.chunks.values()) {
      const visible = Math.abs(chunk.centreX - frame.view.x) < CHUNK_W / 2 + REACH_X && Math.abs(chunk.centreY - frame.view.y) < CHUNK_H / 2 + REACH_Y
      for (const mesh of chunk.meshes.values()) mesh.visible = visible
      if (visible && chunk.checkedVersion !== grid.version) {
        chunk.checkedVersion = grid.version
        this.dropUnsupported(chunk, grid)
      }
    }
  }

  private dropUnsupported(chunk: Chunk, grid: Grid): void {
    for (const segment of chunk.segments) {
      if (segment.gone || segment.tiles.every(([x, y]) => isSolidAt(grid, x, y))) continue
      segment.gone = true
      const mesh = chunk.meshes.get(segment.material)
      if (!mesh) continue
      // Collapsing the corners onto one point hides the faces without rebuilding the mesh.
      const positions = mesh.geometry.getAttribute('position') as BufferAttribute
      const [x, y, z] = [positions.getX(segment.from), positions.getY(segment.from), positions.getZ(segment.from)]
      for (let corner = segment.from; corner < segment.to; corner += 1) positions.setXYZ(corner, x, y, z)
      positions.needsUpdate = true
    }
  }

  private chunkAt(x: number, y: number): Chunk {
    const column = Math.floor(x / CHUNK_W)
    const row = Math.floor(y / CHUNK_H)
    const key = row * 1000 + column
    const known = this.chunks.get(key)
    if (known) return known
    const chunk: Chunk = {
      centreX: (column + 0.5) * CHUNK_W, centreY: (row + 0.5) * CHUNK_H, batches: new Map(), meshes: new Map(), segments: [], checkedVersion: -1,
    }
    this.chunks.set(key, chunk)
    return chunk
  }
}
