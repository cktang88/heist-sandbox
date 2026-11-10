import { Group, Mesh, type Material } from 'three'
import { GROUND, type Interior } from '../game/level'
import { CHUNK_TILES, chunkIndex, TILE_DEFS, tileAt, type Grid, type TileKind } from '../game/tiles'
import { MeshBuilder } from './meshBuilder'

/** How far walls stick out toward the camera, and how deep rooms go. The action happens at z = 0. */
export const FRONT = 0.5
export const BACK = -2.4
/** Textures repeat every two tiles. */
const UV = 0.5

export type SurfaceName = 'brick' | 'concrete' | 'steel' | 'dirt' | 'wood' | 'rock' | 'asphalt' | 'plaster' | 'glass' | 'water' | 'door' | 'fence'
export type SurfaceMaterials = Record<SurfaceName, Material>

const TILE_SURFACE: Partial<Record<TileKind, SurfaceName>> = {
  dirt: 'dirt', brick: 'brick', concrete: 'concrete', steel: 'steel', wood: 'wood', bedrock: 'rock', reinforced: 'concrete',
}

/** Walls that fill their whole cell hide the faces of neighbours they touch. Thin things do not. */
function fills(kind: TileKind): boolean {
  return kind in TILE_SURFACE
}

/** The level as 3D geometry, split into chunks so only damaged areas are rebuilt. */
export type LevelMesh = { group: Group; refresh(): void; dispose(): void }

export function createLevelMesh(grid: Grid, interiors: Interior[], materials: SurfaceMaterials): LevelMesh {
  const group = new Group()
  const chunks = new Map<number, Mesh[]>()
  const across = Math.ceil(grid.width / CHUNK_TILES)
  const down = Math.ceil(grid.height / CHUNK_TILES)

  function rebuild(chunkX: number, chunkY: number): void {
    const index = chunkIndex(grid, chunkX, chunkY)
    for (const old of chunks.get(index) ?? []) {
      group.remove(old)
      old.geometry.dispose()
    }
    const builders = new Map<SurfaceName, MeshBuilder>()
    const builder = (name: SurfaceName) => builders.get(name) ?? builders.set(name, new MeshBuilder()).get(name)!
    for (let ty = chunkY * CHUNK_TILES; ty < Math.min(grid.height, (chunkY + 1) * CHUNK_TILES); ty += 1) {
      for (let tx = chunkX * CHUNK_TILES; tx < Math.min(grid.width, (chunkX + 1) * CHUNK_TILES); tx += 1) {
        addTile(grid, builder, tx, ty)
      }
    }
    const meshes: Mesh[] = []
    for (const [name, built] of builders) {
      if (built.isEmpty) continue
      const mesh = new Mesh(built.build(), materials[name])
      mesh.castShadow = name !== 'glass' && name !== 'water' && name !== 'fence'
      mesh.receiveShadow = true
      group.add(mesh)
      meshes.push(mesh)
    }
    chunks.set(index, meshes)
  }

  for (let chunkY = 0; chunkY < down; chunkY += 1) for (let chunkX = 0; chunkX < across; chunkX += 1) rebuild(chunkX, chunkY)
  grid.dirtyChunks.clear()

  // Back walls: painted plaster inside the building, packed earth underground.
  const backs = new Map<SurfaceName, MeshBuilder>()
  for (const area of interiors) {
    const name: SurfaceName = area.kind === 'room' ? 'plaster' : 'dirt'
    const built = backs.get(name) ?? backs.set(name, new MeshBuilder()).get(name)!
    const [x0, x1, y0, y1] = [area.x, area.x + area.w, -(area.y + area.h), -area.y]
    built.quad([[x0, y0, BACK], [x1, y0, BACK], [x1, y1, BACK], [x0, y1, BACK]], [0, 0, 1],
      [[x0 * UV, y0 * UV], [x1 * UV, y0 * UV], [x1 * UV, y1 * UV], [x0 * UV, y1 * UV]], area.kind === 'room' ? 1 : 0.45)
  }
  const backMeshes: Mesh[] = []
  for (const [name, built] of backs) {
    const mesh = new Mesh(built.build(), materials[name])
    mesh.receiveShadow = true
    group.add(mesh)
    backMeshes.push(mesh)
  }

  return {
    group,
    refresh() {
      for (const index of grid.dirtyChunks) rebuild(index % across, Math.floor(index / across))
      grid.dirtyChunks.clear()
    },
    dispose() {
      for (const meshes of [...chunks.values(), backMeshes]) for (const mesh of meshes) mesh.geometry.dispose()
    },
  }
}

function addTile(grid: Grid, builder: (name: SurfaceName) => MeshBuilder, tx: number, ty: number): void {
  const kind = tileAt(grid, tx, ty)
  if (kind === 'air') return
  const top = -ty
  const bottom = -(ty + 1)
  const def = TILE_DEFS[kind]
  const health = Number.isFinite(def.hp) ? grid.hp[ty * grid.width + tx] / def.hp : 1
  const shade = 0.45 + health * 0.55

  if (kind === 'glass') return builder('glass').box(tx + 0.42, bottom, -0.05, tx + 0.58, top, 0.05, UV, 1)
  if (kind === 'fence') return builder('fence').box(tx, bottom, -0.03, tx + 1, top, 0.03, 1, 1)
  if (kind === 'duct') return builder('steel').box(tx, bottom + 0.7, BACK + 0.4, tx + 1, top, FRONT - 0.2, UV, 1)
  if (kind === 'door') return builder('door').box(tx, bottom, -0.22, tx + 1, top, 0.22, 1, shade)
  if (kind === 'water') {
    const surface = top - 0.15
    builder('water').quad([[tx, surface, FRONT], [tx + 1, surface, FRONT], [tx + 1, surface, BACK], [tx, surface, BACK]], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], 1)
    builder('water').quad([[tx, bottom, FRONT], [tx + 1, bottom, FRONT], [tx + 1, surface, FRONT], [tx, surface, FRONT]], [0, 0, 1], [[0, 0], [1, 0], [1, 1], [0, 1]], 1)
    return
  }
  if (kind === 'ladder') {
    const steel = builder('steel')
    steel.box(tx + 0.14, bottom, -0.75, tx + 0.22, top, -0.67, UV, 1)
    steel.box(tx + 0.78, bottom, -0.75, tx + 0.86, top, -0.67, UV, 1)
    for (const rung of [0.25, 0.75]) steel.box(tx + 0.14, bottom + rung - 0.03, -0.74, tx + 0.86, bottom + rung + 0.03, -0.68, UV, 1)
    return
  }

  const surface = TILE_SURFACE[kind]
  if (!surface) return
  const built = builder(surface)
  const open = (dx: number, dy: number) => !fills(tileAt(grid, tx + dx, ty + dy))
  const [x0, x1, z0, z1] = [tx, tx + 1, BACK, FRONT]
  built.quad([[x0, bottom, z1], [x1, bottom, z1], [x1, top, z1], [x0, top, z1]], [0, 0, 1], [[x0 * UV, bottom * UV], [x1 * UV, bottom * UV], [x1 * UV, top * UV], [x0 * UV, top * UV]], shade)
  if (open(0, -1)) {
    // The street is tarmac; every other exposed top is the wall's own material.
    const cap = kind === 'dirt' && ty === GROUND ? builder('asphalt') : built
    cap.quad([[x0, top, z1], [x1, top, z1], [x1, top, z0], [x0, top, z0]], [0, 1, 0], [[x0 * UV, z1 * UV], [x1 * UV, z1 * UV], [x1 * UV, z0 * UV], [x0 * UV, z0 * UV]], shade)
  }
  if (open(0, 1)) built.quad([[x0, bottom, z0], [x1, bottom, z0], [x1, bottom, z1], [x0, bottom, z1]], [0, -1, 0], [[x0 * UV, z0 * UV], [x1 * UV, z0 * UV], [x1 * UV, z1 * UV], [x0 * UV, z1 * UV]], shade)
  if (open(-1, 0)) built.quad([[x0, bottom, z0], [x0, bottom, z1], [x0, top, z1], [x0, top, z0]], [-1, 0, 0], [[z0 * UV, bottom * UV], [z1 * UV, bottom * UV], [z1 * UV, top * UV], [z0 * UV, top * UV]], shade)
  if (open(1, 0)) built.quad([[x1, bottom, z1], [x1, bottom, z0], [x1, top, z0], [x1, top, z1]], [1, 0, 0], [[z1 * UV, bottom * UV], [z0 * UV, bottom * UV], [z0 * UV, top * UV], [z1 * UV, top * UV]], shade)
}
