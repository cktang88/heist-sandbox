import { MeshBasicMaterial, type BufferGeometry, type Group, type Mesh } from 'three'
import { describe, expect, it } from 'vitest'
import { createGrid, fillTiles, setTile } from '../game/tiles'
import { coreMaterial } from './breaks'
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
    const core = meshes(level.group).filter((mesh) => mesh.material === coreMaterial())
    // Row 11's top at the hole (x 4..5) is broken; further along, row 10's top was always open.
    const broken = Math.max(...core.map((mesh) => topBrightness(mesh.geometry, -11, 4, 5) || 0))
    const weathered = Math.max(...concrete.map((mesh) => topBrightness(mesh.geometry, -10, 9, 12) || 0))
    expect(broken).toBeGreaterThan(0)
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

  it('draws the inside of a blasted hole as broken core, textured without stretching', () => {
    const grid = createGrid(32, 32)
    fillTiles(grid, 0, 10, 31, 12, 'concrete')
    const level = createLevelMesh(grid, [], 31, materials)
    setTile(grid, 8, 11, 'air')
    level.refresh({ x: 16, y: 16 })
    const core = meshes(level.group).filter((mesh) => mesh.material === coreMaterial())
    expect(core.length).toBeGreaterThan(0)
    const position = core[0].geometry.getAttribute('position')
    const uv = core[0].geometry.getAttribute('uv')
    // Textures repeat every two tiles: half a texture unit per tile along each face, never smeared out.
    for (let quad = 0; quad < position.count / 4; quad += 1) {
      for (let corner = 0; corner < 4; corner += 1) {
        const [a, b] = [quad * 4 + corner, quad * 4 + ((corner + 1) % 4)]
        const world = Math.hypot(position.getX(a) - position.getX(b), position.getY(a) - position.getY(b), position.getZ(a) - position.getZ(b))
        const texture = Math.hypot(uv.getX(a) - uv.getX(b), uv.getY(a) - uv.getY(b))
        expect(texture).toBeLessThanOrEqual(world * 0.5 + 1e-6)
        if (world > 0.2) expect(texture).toBeGreaterThan(world * 0.5 * 0.6)
      }
    }
  })

  it('shows sky through a blown outer wall but a dark cavity behind a blown partition', () => {
    const grid = createGrid(32, 32)
    fillTiles(grid, 4, 4, 20, 10, 'air')
    fillTiles(grid, 4, 4, 4, 10, 'brick')
    fillTiles(grid, 12, 4, 12, 10, 'brick')
    const level = createLevelMesh(grid, [{ kind: 'room', x: 4, y: 4, w: 17, h: 7 }], 31, materials)
    const backFacesAt = (x: number, y: number, material: unknown) => meshes(level.group).filter((mesh) => mesh.material === material).some((mesh) => {
      const position = mesh.geometry.getAttribute('position')
      const normal = mesh.geometry.getAttribute('normal')
      for (let index = 0; index < position.count; index += 4) {
        if (normal.getZ(index) < 0.99 || position.getZ(index) > -2.39) continue
        const xs = [0, 1, 2, 3].map((corner) => position.getX(index + corner))
        const ys = [0, 1, 2, 3].map((corner) => position.getY(index + corner))
        if (Math.min(...xs) <= x && Math.max(...xs) >= x + 1 && Math.min(...ys) <= -y - 1 && Math.max(...ys) >= -y) return true
      }
      return false
    })
    setTile(grid, 4, 6, 'air')
    setTile(grid, 12, 6, 'air')
    level.refresh({ x: 16, y: 16 })
    expect(backFacesAt(4, 6, materials.plaster) || backFacesAt(4, 6, coreMaterial())).toBe(false)
    expect(backFacesAt(12, 6, coreMaterial())).toBe(true)
    expect(backFacesAt(8, 6, materials.plaster)).toBe(true)
  })
})
