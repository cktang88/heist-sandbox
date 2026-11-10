import { Group, Mesh, type Material } from 'three'
import type { Interior } from '../game/level'
import { CHUNK_TILES, chunkIndex, CLEAR_OF_LANE, RUBBLE, TILE_DEFS, TILE_KINDS, tileAt, type Grid, type TileKind } from '../game/tiles'
import type { Vec } from '../game/types'
import { addChips, addRebar, coreMaterial, coreTint, type BreakSpec, type Side } from './breaks'
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
/** Level surfaces plus the raw broken core shared by every material's breaks. */
type MeshName = SurfaceName | 'core'

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

/** What is behind a tile at the back of the scene. Edge columns are a building's outer walls. */
const BEHIND_NOTHING = 0
const BEHIND_PLASTER = 1
const BEHIND_DIRT = 2
const BEHIND_EDGE = 4

/** The level as 3D geometry, split into chunks so only damaged areas are rebuilt. */
export type LevelMesh = { group: Group; refresh(view: Vec): void; dispose(): void }

export function createLevelMesh(grid: Grid, interiors: Interior[], groundY: number, materials: SurfaceMaterials): LevelMesh {
  const group = new Group()
  const chunks = new Map<number, Group>()
  const across = Math.ceil(grid.width / CHUNK_TILES)
  const down = Math.ceil(grid.height / CHUNK_TILES)
  // The level as built: a face that now looks into a hole where there used to be wall is a break.
  const original = grid.kinds.slice()
  const shaper: TileShaper = {
    grid, groundY, behind: behindMap(grid, interiors),
    wasSolid: (x, y) => x >= 0 && y >= 0 && x < grid.width && y < grid.height && FILLS[original[y * grid.width + x]],
  }
  const materialOf = (name: MeshName) => (name === 'core' ? coreMaterial() : materials[name])

  function rebuild(chunkX: number, chunkY: number): void {
    const index = chunkIndex(grid, chunkX, chunkY)
    const old = chunks.get(index)
    if (old) {
      group.remove(old)
      for (const mesh of old.children as Mesh[]) mesh.geometry.dispose()
    }
    const builders = new Map<MeshName, MeshBuilder>()
    const builder = (name: MeshName) => builders.get(name) ?? builders.set(name, new MeshBuilder()).get(name)!
    const [x0, x1] = [chunkX * CHUNK_TILES, Math.min(grid.width, (chunkX + 1) * CHUNK_TILES)]
    for (let ty = chunkY * CHUNK_TILES; ty < Math.min(grid.height, (chunkY + 1) * CHUNK_TILES); ty += 1) {
      for (let tx = x0; tx < x1; tx += 1) addTile(shaper, builder, tx, ty)
      addBackRow(shaper, builder, x0, x1, ty)
    }
    const chunk = new Group()
    chunk.matrixAutoUpdate = false
    chunk.userData.centre = { x: (chunkX + 0.5) * CHUNK_TILES, y: (chunkY + 0.5) * CHUNK_TILES }
    for (const [name, built] of builders) {
      if (built.isEmpty) continue
      const mesh = new Mesh(built.build(), materialOf(name))
      mesh.matrixAutoUpdate = false
      mesh.castShadow = name !== 'glass' && name !== 'water' && name !== 'fence' && name !== 'plaster'
      mesh.receiveShadow = true
      chunk.add(mesh)
    }
    group.add(chunk)
    chunks.set(index, chunk)
  }

  for (let chunkY = 0; chunkY < down; chunkY += 1) for (let chunkX = 0; chunkX < across; chunkX += 1) rebuild(chunkX, chunkY)
  grid.dirtyChunks.clear()

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
    },
  }
}

/** For every tile, what back wall sits behind it: plaster inside buildings, packed earth underground. */
function behindMap(grid: Grid, interiors: Interior[]): Uint8Array {
  const behind = new Uint8Array(grid.width * grid.height)
  for (const area of interiors) {
    const kind = area.kind === 'room' ? BEHIND_PLASTER : BEHIND_DIRT
    for (let y = Math.max(0, area.y); y < Math.min(grid.height, area.y + area.h); y += 1) {
      for (let x = Math.max(0, area.x); x < Math.min(grid.width, area.x + area.w); x += 1) {
        const edge = area.kind === 'room' && (x === area.x || x === area.x + area.w - 1) ? BEHIND_EDGE : 0
        behind[y * grid.width + x] = kind | edge
      }
    }
  }
  return behind
}

type TileShaper = { grid: Grid; groundY: number; behind: Uint8Array; wasSolid(x: number, y: number): boolean }

/** What a tile's back shows: nothing, the back wall, or (where a wall used to stand) a dark broken cavity. */
type BackLook = 'none' | 'plaster' | 'dirt' | 'cavity'

/**
 * The back of a tile. Behind a blown-out outer wall there is nothing, so the sky and the city show through;
 * behind a broken partition or slab there is the raw, sooty back of the hole rather than clean paint.
 */
export function backLook(shaper: Pick<TileShaper, 'grid' | 'behind' | 'wasSolid'>, x: number, y: number): BackLook {
  const behind = shaper.behind[y * shaper.grid.width + x]
  const kind = tileAt(shaper.grid, x, y)
  // A solid wall hides whatever is behind it.
  if (behind === BEHIND_NOTHING || fills(kind)) return 'none'
  const broken = shaper.wasSolid(x, y)
  if (broken) return behind & BEHIND_EDGE ? 'none' : 'cavity'
  return behind & BEHIND_DIRT ? 'dirt' : 'plaster'
}

const CAVITY_TONE = 0.2

/** One row of back wall within a chunk, merged into runs of the same look. */
function addBackRow(shaper: TileShaper, builder: (name: MeshName) => MeshBuilder, x0: number, x1: number, ty: number): void {
  let start = x0
  let look = backLook(shaper, x0, ty)
  for (let x = x0 + 1; x <= x1; x += 1) {
    const next = x < x1 ? backLook(shaper, x, ty) : 'none'
    if (look === 'cavity') scorchTongues(shaper, builder('core'), x - 1, ty)
    if (next === look && x < x1) continue
    if (look !== 'none') backRun(builder, look, start, x, ty)
    start = x
    look = next
  }
}

const TONGUE_TONE = CAVITY_TONE * 1.6
const TONGUE_SIDES: [number, number][] = [[0, -1], [0, 1], [-1, 0], [1, 0]]

/**
 * Where a cavity meets clean back wall, jagged dark tongues of soot and torn plaster lick out past the tile's
 * square edge, so the hole's outline is ragged. They sit a hair in front of the wall to avoid z-fighting.
 */
function scorchTongues(shaper: TileShaper, core: MeshBuilder, tx: number, ty: number): void {
  const z = BACK + 0.003
  for (const [dx, dy] of TONGUE_SIDES) {
    const [nx, ny] = [tx + dx, ty + dy]
    if (nx < 0 || ny < 0 || nx >= shaper.grid.width || ny >= shaper.grid.height || backLook(shaper, nx, ny) !== 'plaster') continue
    // The shared edge, running from (ax, ay) along (ux, uy); game y grows downward, scene y upward.
    const horizontal = dy !== 0
    const ax = horizontal ? tx : dx > 0 ? tx + 1 : tx
    const ay = horizontal ? -(dy > 0 ? ty + 1 : ty) : -(ty + 1)
    const [ux, uy] = horizontal ? [1, 0] : [0, 1]
    const [ox, oy] = [dx, -dy]
    const teeth = 4
    for (let tooth = 0; tooth < teeth; tooth += 1) {
      const roll = (salt: number) => cellHash(tx * 4 + tooth, ty * 4 + dx + 2 * dy + 3, salt)
      const from = tooth / teeth
      const to = (tooth + 1) / teeth
      // An uneven flap: each outer corner reaches its own distance, some barely past the edge.
      const reach = (salt: number) => (roll(salt) < 0.3 ? 0.02 : 0.05 + roll(salt + 1) * 0.22)
      const at = (along: number, out: number): P3 => [ax + ux * along + ox * out, ay + uy * along + oy * out, z]
      const corners: [P3, P3, P3, P3] = [at(from, 0), at(to, 0), at(to - roll(125) * 0.08, reach(121)), at(from + roll(126) * 0.08, reach(123))]
      // Wind the face toward the camera whichever way the edge runs.
      const facing = (corners[1][0] - corners[0][0]) * (corners[2][1] - corners[0][1]) - (corners[1][1] - corners[0][1]) * (corners[2][0] - corners[0][0])
      if (facing < 0) corners.reverse()
      core.quad(corners, [0, 0, 1], corners.map(([x, y]) => [x * UV, y * UV] as [number, number]), TONGUE_TONE)
    }
  }
}

function backRun(builder: (name: MeshName) => MeshBuilder, look: Exclude<BackLook, 'none'>, x0: number, x1: number, ty: number): void {
  const [y0, y1] = [-(ty + 1), -ty]
  const corners: [P3, P3, P3, P3] = [[x0, y0, BACK], [x1, y0, BACK], [x1, y1, BACK], [x0, y1, BACK]]
  const uvs: [number, number][] = [[x0 * UV, y0 * UV], [x1 * UV, y0 * UV], [x1 * UV, y1 * UV], [x0 * UV, y1 * UV]]
  if (look === 'cavity') return builder('core').quad(corners, [0, 0, 1], uvs, CAVITY_TONE)
  builder(look).quad(corners, [0, 0, 1], uvs, look === 'plaster' ? 1 : 0.45)
}

function addTile(shaper: TileShaper, builder: (name: MeshName) => MeshBuilder, tx: number, ty: number): void {
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
  if (surface) addBlock(shaper, builder, surface, tx, ty)
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

/** Damage darkens a wall toward its cracked, sooty worst; how much is left of it sets how far. */
const WORST_DAMAGE = 0.5
/** Soot on the faces right at a blast hole's rim, per broken tile touching the corner. */
const SOOT_PER_BREAK = 0.2

/**
 * How dark a lattice corner is from damage: the average wear of the four tiles meeting there, and soot from any
 * of them that was blown away. Only tiles touching the corner count, so a chunk rebuilt for a change on its edge
 * always agrees with its neighbour and no seam appears; the blast's falloff of damage makes the soot fade out.
 */
export function damageShade(shaper: Pick<TileShaper, 'grid' | 'wasSolid'>, x: number, y: number): number {
  const { grid } = shaper
  let wear = 0
  let solids = 0
  let breaks = 0
  for (const [tx, ty] of [[x - 1, y - 1], [x, y - 1], [x - 1, y], [x, y]]) {
    const kind = tileAt(grid, tx, ty)
    if (fills(kind)) {
      const hp = TILE_DEFS[kind].hp
      wear += Number.isFinite(hp) && tx >= 0 && ty >= 0 && tx < grid.width && ty < grid.height ? 1 - grid.hp[ty * grid.width + tx] / hp : 0
      solids += 1
    } else if (shaper.wasSolid(tx, ty)) breaks += 1
  }
  const worn = solids > 0 ? wear / solids : 0
  return (1 - worn * WORST_DAMAGE) * (1 - breaks * SOOT_PER_BREAK)
}

/** Tiles standing aside from the walking lane end here in depth, so it reads that people pass in front of them. */
const LANE_CLEAR_FRONT = -0.6

function laneFlags(grid: Grid, x: number, y: number): number {
  return x >= 0 && y >= 0 && x < grid.width && y < grid.height ? grid.lane[y * grid.width + x] : 0
}

const scaled = (color: Rgb, by: number): Rgb => [color[0] * by, color[1] * by, color[2] * by]
/** Bevels catch a little more light, like worn edges. */
const EDGE_LIGHTER = 1.1
/** Broken faces darken toward the back of the wall, where light from the room hardly reaches. */
const CORE_DEEP = 0.5

/**
 * A wall or floor block: its front face, bevelled strips on every exposed edge, and the exposed sides.
 * The front face is inset at exposed corners and joined to the sides by slanted strips that meet in mitres.
 * Sides that look into a hole blown where wall used to be are drawn as broken core with chips and rebar.
 */
function addBlock(shaper: TileShaper, builder: (name: MeshName) => MeshBuilder, surface: SurfaceName, tx: number, ty: number): void {
  const { grid, groundY } = shaper
  const heap = laneFlags(grid, tx, ty) & RUBBLE
  const setBack = (x: number, y: number) => (laneFlags(grid, x, y) & CLEAR_OF_LANE) !== 0
  const back = setBack(tx, ty)
  // Fallen rubble is all broken material, front included.
  const core = builder('core')
  const built = heap ? core : builder(surface)
  const gone = (dx: number, dy: number) => !fills(tileAt(grid, tx + dx, ty + dy))
  // A neighbour set back from the lane leaves this tile's side showing in front of it.
  const open = (dx: number, dy: number) => gone(dx, dy) || (!back && setBack(tx + dx, ty + dy))
  const broken = (dx: number, dy: number) => (heap ? open(dx, dy) : gone(dx, dy) && shaper.wasSolid(tx + dx, ty + dy))
  const exposed = { top: open(0, -1), bottom: open(0, 1), left: open(-1, 0), right: open(1, 0) }
  const breaks = { top: broken(0, -1), bottom: broken(0, 1), left: broken(-1, 0), right: broken(1, 0) }
  const [x0, x1, z0, z1] = [tx, tx + 1, BACK, back ? LANE_CLEAR_FRONT : FRONT]
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
  const shade = {
    tl: damageShade(shaper, x0, ty), tr: damageShade(shaper, x1, ty), bl: damageShade(shaper, x0, ty + 1), br: damageShade(shaper, x1, ty + 1),
  }
  const color = {
    tl: cornerColor(x0, ty, shade.tl, groundY, true), tr: cornerColor(x1, ty, shade.tr, groundY, true),
    bl: cornerColor(x0, ty + 1, shade.bl, groundY, true), br: cornerColor(x1, ty + 1, shade.br, groundY, true),
  }
  const tint = coreTint(surface)
  if (heap) for (const corner of ['tl', 'tr', 'bl', 'br'] as const) color[corner] = [color[corner][0] * tint[0], color[corner][1] * tint[1], color[corner][2] * tint[2]]
  const coreAt = (corner: keyof typeof shade) => scaled(tint, shade[corner])
  const deep = (rgb: Rgb) => scaled(rgb, CORE_DEEP)
  const flatUv = (corners: P3[]) => corners.map(([x, y]) => [x * UV, y * UV] as [number, number])

  built.face([front.bl, front.br, front.tr, front.tl], flatUv([front.bl, front.br, front.tr, front.tl]), [color.bl, color.br, color.tr, color.tl])

  if (exposed.top) {
    const strip: [P3, P3, P3, P3] = [front.tl, front.tr, rim.tr, rim.tl]
    const lid: [P3, P3, P3, P3] = [rim.tl, rim.tr, [x1, top, z0], [x0, top, z0]]
    const lidUv: [number, number][] = [[x0 * UV, rim.tl[2] * UV], [x1 * UV, rim.tr[2] * UV], [x1 * UV, z0 * UV], [x0 * UV, z0 * UV]]
    if (breaks.top) {
      core.face(strip, flatUv(strip), [coreAt('tl'), coreAt('tr'), coreAt('tr'), coreAt('tl')])
      core.face(lid, lidUv, [coreAt('tl'), coreAt('tr'), deep(coreAt('tr')), deep(coreAt('tl'))])
    } else {
      built.face(strip, flatUv(strip), [scaled(color.tl, EDGE_LIGHTER), scaled(color.tr, EDGE_LIGHTER), scaled(color.tr, EDGE_LIGHTER), scaled(color.tl, EDGE_LIGHTER)])
      // The street is tarmac; every other exposed top is the wall's own material.
      const cap = tileAt(grid, tx, ty) === 'dirt' && ty === groundY ? builder('asphalt') : built
      const capColor = (x: number, corner: keyof typeof shade) => cornerColor(x, ty, shade[corner], groundY, false)
      cap.face(lid, lidUv, [capColor(x0, 'tl'), capColor(x1, 'tr'), capColor(x1, 'tr'), capColor(x0, 'tl')])
    }
  }
  if (exposed.bottom) {
    const strip: [P3, P3, P3, P3] = [rim.bl, rim.br, front.br, front.bl]
    const under: [P3, P3, P3, P3] = [[x0, bottom, z0], [x1, bottom, z0], rim.br, rim.bl]
    const underUv: [number, number][] = [[x0 * UV, z0 * UV], [x1 * UV, z0 * UV], [x1 * UV, rim.br[2] * UV], [x0 * UV, rim.bl[2] * UV]]
    if (breaks.bottom) {
      core.face(strip, flatUv(strip), [coreAt('bl'), coreAt('br'), coreAt('br'), coreAt('bl')])
      core.face(under, underUv, [deep(coreAt('bl')), deep(coreAt('br')), coreAt('br'), coreAt('bl')])
    } else {
      built.face(strip, flatUv(strip), [scaled(color.bl, EDGE_LIGHTER), scaled(color.br, EDGE_LIGHTER), scaled(color.br, EDGE_LIGHTER), scaled(color.bl, EDGE_LIGHTER)])
      built.face(under, underUv, [color.bl, color.br, color.br, color.bl])
    }
  }
  if (exposed.left) {
    const strip: [P3, P3, P3, P3] = [rim.bl, front.bl, front.tl, rim.tl]
    const side: [P3, P3, P3, P3] = [[x0, bottom, z0], rim.bl, rim.tl, [x0, top, z0]]
    const sideUv: [number, number][] = [[z0 * UV, bottom * UV], [rim.bl[2] * UV, bottom * UV], [rim.tl[2] * UV, top * UV], [z0 * UV, top * UV]]
    if (breaks.left) {
      core.face(strip, flatUv(strip), [coreAt('bl'), coreAt('bl'), coreAt('tl'), coreAt('tl')])
      core.face(side, sideUv, [deep(coreAt('bl')), coreAt('bl'), coreAt('tl'), deep(coreAt('tl'))])
    } else {
      built.face(strip, flatUv(strip), [scaled(color.bl, EDGE_LIGHTER), scaled(color.bl, EDGE_LIGHTER), scaled(color.tl, EDGE_LIGHTER), scaled(color.tl, EDGE_LIGHTER)])
      built.face(side, sideUv, [color.bl, color.bl, color.tl, color.tl])
    }
  }
  if (exposed.right) {
    const strip: [P3, P3, P3, P3] = [front.br, rim.br, rim.tr, front.tr]
    const side: [P3, P3, P3, P3] = [rim.br, [x1, bottom, z0], [x1, top, z0], rim.tr]
    const sideUv: [number, number][] = [[rim.br[2] * UV, bottom * UV], [z0 * UV, bottom * UV], [z0 * UV, top * UV], [rim.tr[2] * UV, top * UV]]
    if (breaks.right) {
      core.face(strip, flatUv(strip), [coreAt('br'), coreAt('br'), coreAt('tr'), coreAt('tr')])
      core.face(side, sideUv, [coreAt('br'), deep(coreAt('br')), deep(coreAt('tr')), coreAt('tr')])
    } else {
      built.face(strip, flatUv(strip), [scaled(color.br, EDGE_LIGHTER), scaled(color.br, EDGE_LIGHTER), scaled(color.tr, EDGE_LIGHTER), scaled(color.tr, EDGE_LIGHTER)])
      built.face(side, sideUv, [color.br, color.br, color.tr, color.tr])
    }
  }

  // Ragged chips and rebar along every edge that looks into a hole.
  const mid: Rgb = [(color.tl[0] + color.br[0]) / 2, (color.tl[1] + color.br[1]) / 2, (color.tl[2] + color.br[2]) / 2]
  for (const side of ['top', 'bottom', 'left', 'right'] as Side[]) {
    if (!breaks[side]) continue
    const spec: BreakSpec = { tx, ty, side, surface, back: z0, front: z1, face: mid, core: scaled(tint, 0.5 * (shade.tl + shade.br)) }
    addChips(built, core, spec)
    addRebar(builder('steel'), spec)
  }
}
