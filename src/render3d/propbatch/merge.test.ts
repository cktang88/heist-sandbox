import { BoxGeometry, Matrix4, MeshStandardMaterial, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { mergePieces, type Piece } from './merge'
import { GLOW_ATTRIBUTE, isPlain, SURFACE_ATTRIBUTE } from './plainMaterial'
import type { Part } from './recipe'

const BOX = new BoxGeometry(1, 1, 1)

function part(material: MeshStandardMaterial, matrix = new Matrix4()): Part {
  return { geometry: BOX, material, matrix, start: 0, count: BOX.index!.count, castShadow: true }
}

function faceNormal(geometry: ReturnType<typeof mergePieces>, triangle: number): Vector3 {
  const index = geometry.index!
  const [a, b, c] = [0, 1, 2].map((k) => new Vector3().fromBufferAttribute(geometry.attributes.position, index.getX(triangle * 3 + k)))
  return b.sub(a).cross(c.sub(a)).normalize()
}

describe('baking prop parts together', () => {
  it('places each part where it goes', () => {
    const red = new MeshStandardMaterial({ color: 0xff0000 })
    const pieces: Piece[] = [
      { part: part(red), world: new Matrix4().makeTranslation(10, 0, 0) },
      { part: part(red), world: new Matrix4().makeTranslation(-10, 0, 0) },
    ]
    const geometry = mergePieces(pieces, 'plain')
    expect(geometry.attributes.position.count).toBe(48)
    geometry.computeBoundingBox()
    expect(geometry.boundingBox!.min.x).toBeCloseTo(-10.5)
    expect(geometry.boundingBox!.max.x).toBeCloseTo(10.5)
  })

  it('writes colour, glow, roughness and metalness per vertex for plain parts', () => {
    const lamp = new MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveIntensity: 3, roughness: 0.2, metalness: 1 })
    expect(isPlain(lamp)).toBe(true)
    const geometry = mergePieces([{ part: part(lamp), world: new Matrix4() }], 'plain')
    expect(geometry.attributes[GLOW_ATTRIBUTE].getX(5)).toBeCloseTo(3)
    expect(geometry.attributes[SURFACE_ATTRIBUTE].getX(5)).toBeCloseTo(0.2, 2)
    expect(geometry.attributes[SURFACE_ATTRIBUTE].getY(5)).toBeCloseTo(1, 2)
    expect(geometry.attributes.color.getX(5)).toBe(0)
  })

  it('keeps triangles facing outward on a mirrored prop', () => {
    const grey = new MeshStandardMaterial()
    const plain = mergePieces([{ part: part(grey), world: new Matrix4() }], 'plain')
    const mirrored = mergePieces([{ part: part(grey), world: new Matrix4().makeScale(-1, 1, 1) }], 'plain')
    // The first face of a box is its +x side; mirrored it becomes the -x side, and must face -x.
    expect(faceNormal(plain, 0).x).toBeCloseTo(1)
    expect(faceNormal(mirrored, 0).x).toBeCloseTo(-1)
    expect(mirrored.attributes.normal.getX(0)).toBeCloseTo(-1)
  })

  it('does not fold textured or see-through materials into the plain one', () => {
    expect(isPlain(new MeshStandardMaterial({ transparent: true }))).toBe(false)
    expect(isPlain(new MeshStandardMaterial({ vertexColors: true }))).toBe(false)
  })
})
