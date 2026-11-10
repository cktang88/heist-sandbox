import { MeshBasicMaterial, type BufferGeometry, type Group, type Mesh } from 'three'
import { describe, expect, it } from 'vitest'
import { createGrid, fillTiles, setTile } from '../game/tiles'
import { createLevelMesh, type SurfaceMaterials, type SurfaceName } from './levelMesh'

const NAMES: SurfaceName[] = ['brick', 'concrete', 'reinforced', 'steel', 'dirt', 'wood', 'rock', 'asphalt', 'plaster', 'glass', 'water', 'door', 'fence']
const materials = Object.fromEntries(NAMES.map((name) => [name, new MeshBasicMaterial()])) as unknown as SurfaceMaterials

function meshes(group: Group): Mesh[] {
  const found: Mesh[] = []
  group.traverse((object) => {
    if ((object as Mesh).isMesh) found.push(object as Mesh)
  })
  return found
}

/** Average brightness of the vertices of upward-facing faces at height `y` in a geometry. */
function topBrightness(geometry: BufferGeometry, y: number, x0: number, x1: number): number {
  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  const color = geometry.getAttribute('color')
  let total = 0
  let count = 0
  for (let index = 0; index < position.count; index += 1) {
    if (normal.getY(index) < 0.99 || Math.abs(position.getY(index) - y) > 1e-6) continue
    if (position.getX(index) < x0 || position.getX(index) > x1) continue
    total += color.getX(index)
    count += 1
  }
  return total / count
}

describe('level mesh', () => {
  it('draws the raw top of a wall darker where a tile above it was blown away than where it was always open', () => {
    const grid = createGrid(32, 32)
    fillTiles(grid, 0, 10, 31, 11, 'concrete')
    const level = createLevelMesh(grid, [], 31, materials)
    setTile(grid, 4, 10, 'air')
    level.refresh({ x: 16, y: 16 })
    const concrete = meshes(level.group).filter((mesh) => mesh.material === materials.concrete)
    // Row 11's top at the hole (x 4..5) is broken; further along, row 10's top was always open.
    const broken = Math.max(...concrete.map((mesh) => topBrightness(mesh.geometry, -11, 4, 5) || 0))
    const weathered = Math.max(...concrete.map((mesh) => topBrightness(mesh.geometry, -10, 9, 12) || 0))
    expect(broken).toBeLessThan(weathered * 0.75)
  })

  it('gives every chunk mesh bounds and hides chunks far from the view', () => {
    const grid = createGrid(160, 32)
    fillTiles(grid, 0, 20, 159, 31, 'dirt')
    const level = createLevelMesh(grid, [], 20, materials)
    level.refresh({ x: 8, y: 20 })
    for (const mesh of meshes(level.group)) expect(mesh.geometry.boundingSphere).not.toBeNull()
    const chunks = level.group.children.filter((child) => child.children.length > 0 && !(child as Mesh).isMesh)
    expect(chunks.some((chunk) => !chunk.visible)).toBe(true)
    expect(chunks.some((chunk) => chunk.visible)).toBe(true)
  })
})
