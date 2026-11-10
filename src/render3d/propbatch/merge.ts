import { BufferAttribute, BufferGeometry, Matrix3, Matrix4, Vector3, type Material } from 'three'
import { GLOW_ATTRIBUTE, isPlain, plainLook, SURFACE_ATTRIBUTE } from './plainMaterial'
import type { Part } from './recipe'

/**
 * Bakes several prop parts into one geometry: each part's vertices are moved to where the part sits,
 * so the whole lot draws as one shape. Plain parts also get their colour, glow, roughness and metalness written
 * per vertex for the shared plain material.
 */

/** One part, with where it goes. */
export type Piece = { part: Part; world: Matrix4 }

type Layout = { plain: boolean; uv: boolean; color: boolean }

/** What a batch is drawn with: the shared plain material, or one ordinary material of its own. */
export type BatchLook = 'plain' | Material

function layoutFor(look: BatchLook, pieces: Piece[]): Layout {
  if (look === 'plain') return { plain: true, uv: false, color: true }
  return { plain: false, uv: pieces.some((piece) => piece.part.geometry.attributes.uv !== undefined), color: look.vertexColors }
}

function vertexCount(part: Part): number {
  return part.geometry.index ? part.geometry.attributes.position.count : part.count
}

function indexCount(part: Part): number {
  return part.count
}

export function mergePieces(pieces: Piece[], look: BatchLook): BufferGeometry {
  const layout = layoutFor(look, pieces)
  const vertices = pieces.reduce((sum, piece) => sum + vertexCount(piece.part), 0)
  const indices = pieces.reduce((sum, piece) => sum + indexCount(piece.part), 0)
  const position = new Float32Array(vertices * 3)
  const normal = new Float32Array(vertices * 3)
  const uv = layout.uv ? new Float32Array(vertices * 2) : null
  const color = layout.color ? new Float32Array(vertices * 3) : null
  const glow = layout.plain ? new Float32Array(vertices * 3) : null
  const surface = layout.plain ? new Uint8Array(vertices * 2) : null
  const index = vertices > 65535 ? new Uint32Array(indices) : new Uint16Array(indices)
  const point = new Vector3()
  const normalMatrix = new Matrix3()
  let vertexAt = 0
  let indexAt = 0

  for (const { part, world } of pieces) {
    const source = part.geometry.attributes
    const first = part.geometry.index ? 0 : part.start
    const count = vertexCount(part)
    normalMatrix.getNormalMatrix(world)
    for (let i = 0; i < count; i += 1) {
      const from = first + i
      const to = vertexAt + i
      point.fromBufferAttribute(source.position, from).applyMatrix4(world).toArray(position, to * 3)
      if (source.normal) point.fromBufferAttribute(source.normal, from).applyMatrix3(normalMatrix).normalize().toArray(normal, to * 3)
      else normal[to * 3 + 2] = 1
      if (uv && source.uv) {
        uv[to * 2] = source.uv.getX(from)
        uv[to * 2 + 1] = source.uv.getY(from)
      }
    }
    if (color) writeColour(color, glow, surface, part, vertexAt, count)
    // A mirrored placement turns triangles inside out, so their corners are listed the other way round.
    const mirrored = world.determinant() < 0
    for (let i = 0; i < part.count; i += 3) {
      const a = sourceIndex(part, i)
      const b = sourceIndex(part, i + 1)
      const c = sourceIndex(part, i + 2)
      index[indexAt + i] = vertexAt + a
      index[indexAt + i + 1] = vertexAt + (mirrored ? c : b)
      index[indexAt + i + 2] = vertexAt + (mirrored ? b : c)
    }
    vertexAt += count
    indexAt += part.count
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(position, 3))
  geometry.setAttribute('normal', new BufferAttribute(normal, 3))
  if (uv) geometry.setAttribute('uv', new BufferAttribute(uv, 2))
  if (color) geometry.setAttribute('color', new BufferAttribute(color, 3))
  if (glow) geometry.setAttribute(GLOW_ATTRIBUTE, new BufferAttribute(glow, 3))
  if (surface) geometry.setAttribute(SURFACE_ATTRIBUTE, new BufferAttribute(surface, 2, true))
  geometry.setIndex(new BufferAttribute(index, 1))
  geometry.computeBoundingSphere()
  geometry.computeBoundingBox()
  return geometry
}

/** Position of the n-th corner of a part's triangles within the vertices copied for it. */
function sourceIndex(part: Part, n: number): number {
  const index = part.geometry.index
  return index ? index.getX(part.start + n) : n
}

function writeColour(color: Float32Array, glow: Float32Array | null, surface: Uint8Array | null, part: Part, at: number, count: number): void {
  const source = part.geometry.attributes.color
  if (glow && surface && isPlain(part.material)) {
    const look = plainLook(part.material)
    for (let i = at; i < at + count; i += 1) {
      color.set(look.color, i * 3)
      glow.set(look.glow, i * 3)
      surface[i * 2] = Math.round(look.roughness * 255)
      surface[i * 2 + 1] = Math.round(look.metalness * 255)
    }
    return
  }
  const first = part.geometry.index ? 0 : part.start
  for (let i = 0; i < count; i += 1) {
    const to = (at + i) * 3
    if (source) {
      color[to] = source.getX(first + i)
      color[to + 1] = source.getY(first + i)
      color[to + 2] = source.getZ(first + i)
    } else color.fill(1, to, to + 3)
  }
}
