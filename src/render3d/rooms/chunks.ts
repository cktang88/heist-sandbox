import { Group, Mesh, type BufferAttribute, type Material } from 'three'
import { isSolidAt, type Grid } from '../../game/tiles'
import { addBuildJob } from '../core/buildQueue'
import { prepareJob } from '../core/gpu'
import type { Frame } from '../layer'
import { QuadBatch } from './batch'

/** Size of one chunk in tiles. A view is about 42 x 24 tiles, so at most four chunks are on screen. */
const CHUNK_W = 48
const CHUNK_H = 36
/** Half the view at the walking lane, widened for wide screens and for faces that stand in front of or behind it. */
const REACH_X = 30
const REACH_Y = 16
/**
 * A piece of work may add faces a little outside the area it was given (a sign over a roof, a lamp past a wall), so a
 * chunk waits for every piece within this many tiles of it before it is built.
 */
const PIECE_MARGIN = 8

const debug = typeof location !== 'undefined' && new URLSearchParams(location.search).get('debug') === '1'

/** Faces that rest on particular tiles (a strip of floor finish on its slab) and vanish once any of them is gone. */
type Segment = { material: Material; from: number; to: number; tiles: readonly [number, number][]; gone: boolean }

type Chunk = {
  centreX: number
  centreY: number
  batches: Map<Material, QuadBatch>
  /** The mesh of each material that folds away faces; `drawn` also holds any later ones. */
  meshes: Map<Material, Mesh>
  drawn: Mesh[]
  segments: Segment[]
  checkedVersion: number
  /** Its meshes exist (they may still be on their way to the GPU). */
  built: boolean
}

/** Deferred work that adds faces around an area of the site: one room's finishes, one building's facade. */
type Piece = { x0: number; y0: number; x1: number; y1: number; run: () => void; done: boolean }

/** How a set of finishes is drawn: whether it takes shadows, and its draw order. */
export type FinishLook = { shadowed: boolean; renderOrder?: number }

/**
 * Finish geometry grouped by area and by material: each chunk becomes one mesh per material it uses.
 * Chunks off screen are hidden and cost nothing per frame beyond one distance test.
 *
 * Work can be handed over as pieces (`piece`) and the chunks built by the build queue (`queueBuild`): each chunk's job
 * first runs the pieces near it, then makes its meshes, uploads them and shows them, nearest the view first.
 */
export class ChunkedFinishes {
  readonly group = new Group()
  private chunks = new Map<number, Chunk>()
  private pieces: Piece[] = []
  private look: FinishLook = { shadowed: false }

  /** Where to add faces of `material` that sit around tile position (x, y) in game space. */
  batch(x: number, y: number, material: Material): QuadBatch {
    const chunk = this.chunkAt(x, y)
    if (chunk.built && debug && !chunk.batches.has(material)) console.info(`[perf] finishes added to a chunk already built near ${x},${y}`)
    return chunk.batches.get(material) ?? chunk.batches.set(material, new QuadBatch()).get(material)!
  }

  /** The faces added to `batch(x, y, material)` since `from` vanish when any of `tiles` stops being solid. */
  restOn(x: number, y: number, material: Material, from: number, tiles: readonly [number, number][]): void {
    const chunk = this.chunkAt(x, y)
    // Faces added after their chunk was built get a mesh of their own, which does not fold away.
    if (chunk.built) return
    const to = this.batch(x, y, material).mark
    if (to > from) chunk.segments.push({ material, from, to, tiles, gone: false })
  }

  /** Hands over work that adds faces in the area x0..x1, y0..y1 (game tiles); it runs before any chunk near it is built. */
  piece(x0: number, y0: number, x1: number, y1: number, run: () => void): void {
    this.pieces.push({ x0, y0, x1, y1, run, done: false })
  }

  /** Runs every piece and turns everything collected into meshes at once. */
  build(look: FinishLook): void {
    this.look = look
    for (const piece of this.pieces) this.run(piece)
    for (const chunk of this.chunks.values()) this.show(this.make(chunk))
  }

  /** Builds through the build queue: one job per chunk any piece may touch, each shown once on the GPU. */
  queueBuild(look: FinishLook, cause: string): void {
    this.look = look
    const chunks = new Set<Chunk>()
    for (const piece of this.pieces) {
      for (let row = Math.floor((piece.y0 - PIECE_MARGIN) / CHUNK_H); row <= Math.floor((piece.y1 + PIECE_MARGIN) / CHUNK_H); row += 1) {
        for (let column = Math.floor((piece.x0 - PIECE_MARGIN) / CHUNK_W); column <= Math.floor((piece.x1 + PIECE_MARGIN) / CHUNK_W); column += 1) {
          chunks.add(this.chunkAt((column + 0.5) * CHUNK_W, (row + 0.5) * CHUNK_H))
        }
      }
    }
    for (const chunk of chunks) {
      const area = { x: chunk.centreX, y: chunk.centreY, halfW: CHUNK_W / 2, halfH: CHUNK_H / 2 }
      addBuildJob({
        ...area,
        cause,
        step: () => {
          const pending = this.pieces.find((piece) => !piece.done && this.near(piece, chunk))
          if (pending) {
            this.run(pending)
            return 'more'
          }
          const made = this.make(chunk)
          prepareJob(made, { ...area, cause: `prepare ${cause}` }, () => this.show(made))
          return 'done'
        },
      })
    }
  }

  get meshCount(): number {
    let count = 0
    for (const chunk of this.chunks.values()) count += chunk.drawn.length
    return count
  }

  /** Shows chunks near the view, and folds away finishes whose support has been destroyed since last looked at. */
  update(grid: Grid, frame: Frame): void {
    for (const chunk of this.chunks.values()) {
      if (chunk.built && chunk.batches.size > 0) this.show(this.make(chunk))
      const visible = Math.abs(chunk.centreX - frame.view.x) < CHUNK_W / 2 + REACH_X && Math.abs(chunk.centreY - frame.view.y) < CHUNK_H / 2 + REACH_Y
      for (const mesh of chunk.drawn) mesh.visible = visible
      if (visible && chunk.checkedVersion !== grid.version) {
        chunk.checkedVersion = grid.version
        this.dropUnsupported(chunk, grid)
      }
    }
  }

  private run(piece: Piece): void {
    if (piece.done) return
    piece.done = true
    piece.run()
  }

  private near(piece: Piece, chunk: Chunk): boolean {
    return piece.x1 + PIECE_MARGIN >= chunk.centreX - CHUNK_W / 2 && piece.x0 - PIECE_MARGIN <= chunk.centreX + CHUNK_W / 2
      && piece.y1 + PIECE_MARGIN >= chunk.centreY - CHUNK_H / 2 && piece.y0 - PIECE_MARGIN <= chunk.centreY + CHUNK_H / 2
  }

  /** Makes meshes of what a chunk has collected, in a group of their own until they are shown. */
  private make(chunk: Chunk): Group {
    const look = this.look
    const made = new Group()
    for (const [material, batch] of chunk.batches) {
      if (batch.isEmpty) continue
      const mesh = new Mesh(batch.build(), material)
      mesh.receiveShadow = look.shadowed
      mesh.renderOrder = look.renderOrder ?? 0
      mesh.matrixAutoUpdate = false
      mesh.updateMatrix()
      // A second mesh of a material (faces that came late) is drawn but never folds away.
      if (!chunk.meshes.has(material)) chunk.meshes.set(material, mesh)
      chunk.drawn.push(mesh)
      made.add(mesh)
    }
    chunk.batches.clear()
    chunk.built = true
    return made
  }

  private show(made: Group): void {
    for (const mesh of [...made.children]) this.group.add(mesh)
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
      centreX: (column + 0.5) * CHUNK_W, centreY: (row + 0.5) * CHUNK_H, batches: new Map(), meshes: new Map(), drawn: [], segments: [], checkedVersion: -1, built: false,
    }
    this.chunks.set(key, chunk)
    return chunk
  }
}
