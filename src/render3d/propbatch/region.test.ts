import { BatchedMesh, Box3, BoxGeometry, Group, Matrix4, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { recipeOf, signatureOf } from './recipe'
import { Region, suitsCard, type PlacedProp } from './region'

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
  const found: BatchedMesh[] = []
  region.group.traverse((child) => {
    if (child instanceof BatchedMesh) found.push(child)
  })
  return found
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

describe('which props become cards', () => {
  const desk = new Box3(new Vector3(-1, 0, -2), new Vector3(1, 0.8, -1))
  const sofaAtLane = new Box3(new Vector3(-1.5, 0, -1.6), new Vector3(1.5, 0.9, 0))

  it('makes cards of furniture against the wall in the pixel looks', () => {
    expect(suitsCard(desk, 0, 'oblique')).toBe(true)
  })

  it('keeps a deep prop whose front reaches the walking lane 3D', () => {
    expect(suitsCard(sofaAtLane, 0, 'oblique')).toBe(false)
  })

  it('makes cards only of small props under perspective', () => {
    expect(suitsCard(desk, 0, 'straight')).toBe(false)
    expect(suitsCard(new Box3(new Vector3(-0.2, 0, -1.2), new Vector3(0.2, 0.4, -0.9)), 0, 'straight')).toBe(true)
  })

  it('keeps its last build on screen while it is built again, then shows only the new one', () => {
    const region = new Region([0, 1])
    const props = [placed(0), placed(2)]
    region.build(props, () => false)
    const first = batches(region)
    region.start(() => false)
    expect(region.drawable).toBe(true)
    expect(batches(region)).toEqual(first)
    while (region.step((prop) => props[prop]) === 'more');
    const second = batches(region)
    expect(second).toHaveLength(first.length)
    expect(second.some((mesh) => first.includes(mesh))).toBe(false)
  })
})
