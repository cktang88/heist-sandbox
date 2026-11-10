import { BatchedMesh, BoxGeometry, Group, Matrix4, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { recipeOf, signatureOf } from './recipe'
import { Region, type PlacedProp } from './region'

const BOX = new BoxGeometry(1, 1, 1)
const RED = new MeshStandardMaterial({ color: 0xff0000 })
const POSTER = new MeshStandardMaterial({ color: 0xffffff, transparent: true })

function chair(): Group {
  const model = new Group()
  const seat = new Mesh(BOX, RED)
  seat.position.set(0.2, 0.5, -1)
  seat.castShadow = true
  model.add(seat, new Mesh(BOX, POSTER))
  return model
}

function placed(x: number, flip = false): PlacedProp {
  const recipe = recipeOf(chair())
  const placement = new Matrix4().makeTranslation(x, 0, 0)
  if (flip) placement.scale(new Vector3(-1, 1, 1))
  return { recipe, placement, castShadow: true, shape: signatureOf(recipe) }
}

function batches(region: Region): BatchedMesh[] {
  return region.group.children.filter((child): child is BatchedMesh => child instanceof BatchedMesh)
}

describe('a region of batched props', () => {
  it('draws each material once however many props use it', () => {
    const region = new Region([0, 1, 2])
    region.build([placed(0), placed(3), placed(6)], () => false)
    const meshes = batches(region)
    // One batch for the plain red parts, one for the poster material.
    expect(meshes).toHaveLength(2)
    expect(meshes.every((mesh) => mesh.instanceCount === 3)).toBe(true)
  })

  it('hides and shows a prop by switching its instances', () => {
    const region = new Region([0, 1])
    region.build([placed(0), placed(3)], (prop) => prop === 1)
    expect(batches(region).every((mesh) => mesh.getVisibleAt(0) && !mesh.getVisibleAt(1))).toBe(true)
    region.setHidden(1, false)
    expect(batches(region).every((mesh) => mesh.getVisibleAt(1))).toBe(true)
  })

  it('puts a mirrored prop where the mirror puts it', () => {
    const region = new Region([0])
    region.build([placed(5, true)], () => false)
    const plain = batches(region).find((mesh) => !mesh.material.transparent)!
    plain.computeBoundingBox()
    // The seat sits 0.2 right of the prop's centre; mirrored, 0.2 left of it.
    expect(plain.boundingBox!.getCenter(new Vector3()).x).toBeCloseTo(4.8)
  })
})
