import { MeshBasicMaterial, type BufferAttribute, type Mesh } from 'three'
import { describe, expect, it } from 'vitest'
import { createGrid, damageTile, setTile } from '../../game/tiles'
import { WHITE } from './batch'
import { ChunkedFinishes } from './chunks'
import { floorSpans } from './interior'

const near = { dt: 0, view: { x: 10, y: 10 }, aim: { x: 10, y: 10 } }
const far = { dt: 0, view: { x: 400, y: 10 }, aim: { x: 400, y: 10 } }

function setup() {
  const grid = createGrid(40, 40)
  for (let x = 0; x < 40; x += 1) setTile(grid, x, 12, 'concrete')
  const finishes = new ChunkedFinishes()
  const material = new MeshBasicMaterial()
  for (let column = 4; column < 8; column += 1) {
    const batch = finishes.batch(6, 10, material)
    const mark = batch.mark
    batch.level(column, column + 1, -12, -2, 0.5, true, 1, WHITE)
    finishes.restOn(6, 10, material, mark, [[column, 12]])
  }
  finishes.build(true)
  const mesh = finishes.group.children[0] as Mesh
  return { grid, finishes, mesh }
}

/** Width of floor still drawn: collapsed strips have no extent. */
function drawnWidth(mesh: Mesh): number {
  const positions = mesh.geometry.getAttribute('position') as BufferAttribute
  let width = 0
  for (let quad = 0; quad < positions.count / 4; quad += 1) width += Math.abs(positions.getX(quad * 4 + 1) - positions.getX(quad * 4))
  return width
}

describe('ChunkedFinishes', () => {
  it('merges all strips into one mesh and shows it only near the view', () => {
    const { grid, finishes, mesh } = setup()
    expect(finishes.meshCount).toBe(1)
    finishes.update(grid, far)
    expect(mesh.visible).toBe(false)
    finishes.update(grid, near)
    expect(mesh.visible).toBe(true)
  })

  it('folds away only the strip whose slab tile was destroyed', () => {
    const { grid, finishes, mesh } = setup()
    finishes.update(grid, near)
    expect(drawnWidth(mesh)).toBe(4)
    damageTile(grid, 5, 12, 1000)
    finishes.update(grid, near)
    expect(drawnWidth(mesh)).toBe(3)
  })

  it('catches up on damage done while the area was off screen', () => {
    const { grid, finishes, mesh } = setup()
    finishes.update(grid, far)
    damageTile(grid, 6, 12, 1000)
    finishes.update(grid, far)
    expect(drawnWidth(mesh)).toBe(4)
    finishes.update(grid, near)
    expect(drawnWidth(mesh)).toBe(3)
  })
})

describe('floorSpans', () => {
  it('splits the foot of a wall into one span per floor tile, so each can fall with its own slab', () => {
    expect(floorSpans(3, 7)).toEqual([[3, 4], [4, 5], [5, 6], [6, 7]])
  })
})
