import { Group, Mesh, type Material } from 'three'
import type { Interior } from '../game/level'
import { CHUNK_TILES, chunkIndex, TILE_DEFS, TILE_KINDS, tileAt, type Grid, type TileKind } from '../game/tiles'
import type { Vec } from '../game/types'
import { MeshBuilder, type P3, type Rgb } from './meshBuilder'
import { cellHash, tileNoise } from './noise'

/** How far walls stick out toward the camera, and how deep rooms go. The action happens at z = 0. */
export const FRONT = 0.5
export const BACK = -2.4
/** Textures repeat every two tiles. */
const UV = 0.5

export type SurfaceName =
  | 'brick' | 'concrete' | 'reinforced' | 'steel' | 'dirt' | 'wood' | 'rock' | 'asphalt' | 'plaster' | 'glass' | 'water' | 'door' | 'fence'
export type SurfaceMaterials = Record<SurfaceName, Material>

const TILE_SURFACE: Partial<Record<TileKind, SurfaceName>> = {
  dirt: 'dirt', brick: 'brick', concrete: 'concrete', steel: 'steel', wood: 'wood', bedrock: 'rock', reinforced: 'reinforced',
}
const FILLS = TILE_KINDS.map((kind) => kind in TILE_SURFACE)

/** Walls that fill their whole cell hide the faces of neighbours they touch. Thin things do not. */
function fills(kind: TileKind): boolean {
  return kind in TILE_SURFACE
}

/**
 * Chunks further than this from the view centre are hidden, which also keeps them out of shadow passes.
 * Wide enough for ultrawide screens plus the reach of the shadow-casting lights around the view.
 */
const KEEP_DRAWN = { x: 64, y: 48 }

/** The level as 3D geometry, split into chunks so only damaged areas are rebuilt. */
export type LevelMesh = { group: Group; refresh(view: Vec): void; dispose(): void }

export function createLevelMesh(grid: Grid, interiors: Interior[], groundY: number, materials: SurfaceMaterials): LevelMesh {
  const group = new Group()
  const chunks = new Map<number, Group>()
  const across = Math.ceil(grid.width / CHUNK_TILES)
  const down = Math.ceil(grid.height / CHUNK_TILES)
  // The level as built: a face that now looks into a hole where there used to be wall is a break.
  const original = grid.kinds.slice()
  const shaper: TileShaper = { grid, groundY, wasSolid: (x, y) => x >= 0 && y >= 0 && x < grid.width && y < grid.height && FILLS[original[y * grid.width + x]] }

  function rebuild(chunkX: number, chunkY: number): void {
    const index = chunkIndex(grid, chunkX, chunkY)
    const old = chunks.get(index)
    if (old) {
      group.remove(old)
      for (const mesh of old.children as Mesh[]) mesh.geometry.dispose()
    }
    const builders = new Map<SurfaceName, MeshBuilder>()
    const builder = (name: SurfaceName) => builders.get(name) ?? builders.set(name, new MeshBuilder()).get(name)!
    for (let ty = chunkY * CHUNK_TILES; ty < Math.min(grid.height, (chunkY + 1) * CHUNK_TILES); ty += 1) {
      for (let tx = chunkX * CHUNK_TILES; tx < Math.min(grid.width, (chunkX + 1) * CHUNK_TILES); tx += 1) {
        addTile(shaper, builder, tx, ty)
      }
    }
    const chunk = new Group()
    chunk.matrixAutoUpdate = false
    chunk.userData.centre = { x: (chunkX + 0.5) * CHUNK_TILES, y: (chunkY + 0.5) * CHUNK_TILES }
    for (const [name, built] of builders) {
      if (built.isEmpty) continue
      const mesh = new Mesh(built.build(), materials[name])
      mesh.matrixAutoUpdate = false
      mesh.castShadow = name !== 'glass' && name !== 'water' && name !== 'fence'
      mesh.receiveShadow = true
      chunk.add(mesh)
    }
    group.add(chunk)
    chunks.set(index, chunk)
  }

  for (let chunkY = 0; chunkY < down; chunkY += 1) for (let chunkX = 0; chunkX < across; chunkX += 1) rebuild(chunkX, chunkY)
  grid.dirtyChunks.clear()
  const backMeshes = buildBackWalls(interiors, materials)
  group.add(...backMeshes)

  return {
    group,
    refresh(view) {
      for (const index of grid.dirtyChunks) rebuild(index % across, Math.floor(index / across))
      grid.dirtyChunks.clear()
      for (const chunk of chunks.values()) {
        const centre = chunk.userData.centre as Vec
        chunk.visible = Math.abs(centre.x - view.x) < KEEP_DRAWN.x && Math.abs(centre.y - view.y) < KEEP_DRAWN.y
      }
    },
    dispose() {
      for (const chunk of chunks.values()) for (const mesh of chunk.children as Mesh[]) mesh.geometry.dispose()
      for (const mesh of backMeshes) mesh.geometry.dispose()
    },
  }
}

/** Back walls: painted plaster inside the building, packed earth underground. */
function buildBackWalls(interiors: Interior[], materials: SurfaceMaterials): Mesh[] {
  const backs = new Map<SurfaceName, MeshBuilder>()
  for (const area of interiors) {
    const name: SurfaceName = area.kind === 'room' ? 'plaster' : 'dirt'
    const built = backs.get(name) ?? backs.set(name, new MeshBuilder()).get(name)!
    const [x0, x1, y0, y1] = [area.x, area.x + area.w, -(area.y + area.h), -area.y]
    built.quad([[x0, y0, BACK], [x1, y0, BACK], [x1, y1, BACK], [x0, y1, BACK]], [0, 0, 1],
      [[x0 * UV, y0 * UV], [x1 * UV, y0 * UV], [x1 * UV, y1 * UV], [x0 * UV, y1 * UV]], area.kind === 'room' ? 1 : 0.45)
  }
  return [...backs].map(([name, built]) => {
    const mesh = new Mesh(built.build(), materials[name])
    mesh.receiveShadow = true
    mesh.matrixAutoUpdate = false
    return mesh
  })
}

type TileShaper = { grid: Grid; groundY: number; wasSolid(x: number, y: number): boolean }

function addTile(shaper: TileShaper, builder: (name: SurfaceName) => MeshBuilder, tx: number, ty: number): void {
  const { grid } = shaper
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
  if (surface) addBlock(shaper, builder, surface, tx, ty, shade)
}

/** Bevel depth at a lattice corner: a few centimetres, varied so edges read as worn rather than machined. */
function bevelAt(x: number, y: number): number {
  return 0.05 + cellHash(x, y, 91) * 0.06
}

/**
 * Vertex colour at a lattice corner: slow blotchy variation so big walls are not one flat tone, and a
 * damp, darker band near the street on upright faces. Corner-based, so neighbouring tiles blend smoothly.
 */
function cornerColor(x: number, y: number, shade: number, groundY: number, upright: boolean): Rgb {
  const blotch = tileNoise(x / 448, y / 448, 64, 17)
  const hue = tileNoise(x / 896, y / 896, 32, 29) - 0.5
  const heightAboveStreet = groundY - y
  const damp = upright && heightAboveStreet >= 0 ? 0.62 + 0.38 * Math.min(1, heightAboveStreet / 2.5) ** 1.5 : 1
  const value = shade * (0.86 + blotch * 0.26) * damp
  return [value * (1 + hue * 0.08), value, value * (1 - hue * 0.08)]
}

const scaled = (color: Rgb, by: number): Rgb => [color[0] * by, color[1] * by, color[2] * by]
/** Bevels catch a little more light, like worn edges; broken faces are dark, raw core. */
const EDGE_LIGHTER = 1.1
const BROKEN_DARKER = 0.55

/**
 * A wall or floor block: its front face, bevelled strips on every exposed edge, and the exposed sides.
 * The front face is inset at exposed corners and joined to the sides by slanted strips that meet in mitres.
 */
function addBlock(shaper: TileShaper, builder: (name: SurfaceName) => MeshBuilder, surface: SurfaceName, tx: number, ty: number, shade: number): void {
  const { grid, groundY } = shaper
  const built = builder(surface)
  const open = (dx: number, dy: number) => !fills(tileAt(grid, tx + dx, ty + dy))
  const broken = (dx: number, dy: number) => open(dx, dy) && shaper.wasSolid(tx + dx, ty + dy)
  const exposed = { top: open(0, -1), bottom: open(0, 1), left: open(-1, 0), right: open(1, 0) }
  const [x0, x1, z0, z1] = [tx, tx + 1, BACK, FRONT]
  const [top, bottom] = [-ty, -(ty + 1)]

  // Bevel depth at each corner, zero where neither edge meeting there is exposed.
  const d = {
    tl: exposed.top || exposed.left ? bevelAt(x0, ty) : 0,
    tr: exposed.top || exposed.right ? bevelAt(x1, ty) : 0,
    bl: exposed.bottom || exposed.left ? bevelAt(x0, ty + 1) : 0,
    br: exposed.bottom || exposed.right ? bevelAt(x1, ty + 1) : 0,
  }
  const front = {
    tl: [x0 + (exposed.left ? d.tl : 0), top - (exposed.top ? d.tl : 0), z1] as P3,
    tr: [x1 - (exposed.right ? d.tr : 0), top - (exposed.top ? d.tr : 0), z1] as P3,
    bl: [x0 + (exposed.left ? d.bl : 0), bottom + (exposed.bottom ? d.bl : 0), z1] as P3,
    br: [x1 - (exposed.right ? d.br : 0), bottom + (exposed.bottom ? d.br : 0), z1] as P3,
  }
  const rim = {
    tl: [x0, top, z1 - d.tl] as P3, tr: [x1, top, z1 - d.tr] as P3,
    bl: [x0, bottom, z1 - d.bl] as P3, br: [x1, bottom, z1 - d.br] as P3,
  }
  const color = {
    tl: cornerColor(x0, ty, shade, groundY, true), tr: cornerColor(x1, ty, shade, groundY, true),
    bl: cornerColor(x0, ty + 1, shade, groundY, true), br: cornerColor(x1, ty + 1, shade, groundY, true),
  }
  const flatUv = (corners: P3[]) => corners.map(([x, y]) => [x * UV, y * UV] as [number, number])
  const edgeTone = (isBroken: boolean) => (isBroken ? BROKEN_DARKER : EDGE_LIGHTER)

  built.face([front.bl, front.br, front.tr, front.tl], flatUv([front.bl, front.br, front.tr, front.tl]), [color.bl, color.br, color.tr, color.tl])

  if (exposed.top) {
    const tone = edgeTone(broken(0, -1))
    built.face([front.tl, front.tr, rim.tr, rim.tl], flatUv([front.tl, front.tr, rim.tr, rim.tl]), [scaled(color.tl, tone), scaled(color.tr, tone), scaled(color.tr, tone), scaled(color.tl, tone)])
    // The street is tarmac; every other exposed top is the wall's own material.
    const cap = tileAt(grid, tx, ty) === 'dirt' && ty === groundY ? builder('asphalt') : built
    const capTone = broken(0, -1) ? BROKEN_DARKER : 1
    const capColor = (x: number) => scaled(cornerColor(x, ty, shade, groundY, false), capTone)
    cap.face([rim.tl, rim.tr, [x1, top, z0], [x0, top, z0]],
      [[x0 * UV, rim.tl[2] * UV], [x1 * UV, rim.tr[2] * UV], [x1 * UV, z0 * UV], [x0 * UV, z0 * UV]], [capColor(x0), capColor(x1), capColor(x1), capColor(x0)])
  }
  if (exposed.bottom) {
    const tone = edgeTone(broken(0, 1))
    built.face([rim.bl, rim.br, front.br, front.bl], flatUv([rim.bl, rim.br, front.br, front.bl]), [scaled(color.bl, tone), scaled(color.br, tone), scaled(color.br, tone), scaled(color.bl, tone)])
    const under = scaled(color.bl, broken(0, 1) ? BROKEN_DARKER : 1)
    built.face([[x0, bottom, z0], [x1, bottom, z0], rim.br, rim.bl],
      [[x0 * UV, z0 * UV], [x1 * UV, z0 * UV], [x1 * UV, rim.br[2] * UV], [x0 * UV, rim.bl[2] * UV]], [under, under, under, under])
  }
  if (exposed.left) {
    const tone = edgeTone(broken(-1, 0))
    built.face([rim.bl, front.bl, front.tl, rim.tl], flatUv([rim.bl, front.bl, front.tl, rim.tl]), [scaled(color.bl, tone), scaled(color.bl, tone), scaled(color.tl, tone), scaled(color.tl, tone)])
    const sideTone = broken(-1, 0) ? BROKEN_DARKER : 1
    built.face([[x0, bottom, z0], rim.bl, rim.tl, [x0, top, z0]],
      [[z0 * UV, bottom * UV], [rim.bl[2] * UV, bottom * UV], [rim.tl[2] * UV, top * UV], [z0 * UV, top * UV]],
      [scaled(color.bl, sideTone), scaled(color.bl, sideTone), scaled(color.tl, sideTone), scaled(color.tl, sideTone)])
  }
  if (exposed.right) {
    const tone = edgeTone(broken(1, 0))
    built.face([front.br, rim.br, rim.tr, front.tr], flatUv([front.br, rim.br, rim.tr, front.tr]), [scaled(color.br, tone), scaled(color.br, tone), scaled(color.tr, tone), scaled(color.tr, tone)])
    const sideTone = broken(1, 0) ? BROKEN_DARKER : 1
    built.face([rim.br, [x1, bottom, z0], [x1, top, z0], rim.tr],
      [[rim.br[2] * UV, bottom * UV], [z0 * UV, bottom * UV], [z0 * UV, top * UV], [rim.tr[2] * UV, top * UV]],
      [scaled(color.br, sideTone), scaled(color.br, sideTone), scaled(color.tr, sideTone), scaled(color.tr, sideTone)])
  }
}
