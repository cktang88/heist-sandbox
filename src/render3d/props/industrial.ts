import { ExtrudeGeometry, Group, Mesh, Shape, type Material } from 'three'
import type { SurfaceMaterials } from '../levelMesh'
import type { PropBuilder, PropSet } from './index'
import { ball, box, cylinder, glow, matte, scanned } from './kit'
import {
  FINISH, SLEEVE, archiveBoxes, cartonFace, coolingFront, cylinderLabel, dangerSign, disc, flammableBand, gaugeFace,
  hazardStripes, labCabinets, livery, louvres, mergedBoxes, once, pallet, pegboard, photo, pick, place, quiet, rod, serverFront,
  stackedBlocks, switchgearFront, terminalScreen, wheel, crate,
} from './industrialParts'

/**
 * 3D models for the 'industrial' props: warehouse stock, plant machinery, vehicles, labs and server rooms.
 * Photo-scanned models are used where one fits; the rest are built from shared parts and photo-textured paint.
 */

type Build = (group: Group, materials: SurfaceMaterials) => void
const prop = (build: Build): PropBuilder => (materials) => {
  const group = new Group()
  build(group, materials)
  return group
}

// ---------- Shared pieces ----------

/** A shared side-profile shape extruded to `depth` and centred on z = 0, for vehicle bodies and glass. */
function profile(key: string, outline: (shape: Shape) => void, depth: number, bevel = 0.04): ExtrudeGeometry {
  return once(`profile:${key}`, () => {
    const outlineShape = new Shape()
    outline(outlineShape)
    const geometry = new ExtrudeGeometry(outlineShape, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 10 })
    geometry.translate(0, 0, -depth / 2)
    return geometry
  })
}

function polygon(shape: Shape, points: readonly (readonly [number, number])[]): void {
  shape.moveTo(points[0][0], points[0][1])
  for (const [x, y] of points.slice(1)) shape.lineTo(x, y)
  shape.closePath()
}

/** Runs a body outline along its bottom edge with semicircular cut-outs over each wheel. */
function bodyWithArches(shape: Shape, left: number, right: number, bottom: number, arches: readonly number[], radius: number, top: readonly (readonly [number, number])[]): void {
  shape.moveTo(left, bottom)
  for (const x of arches) {
    shape.lineTo(x - radius, bottom)
    shape.absarc(x, bottom, radius, Math.PI, 0, true)
  }
  shape.lineTo(right, bottom)
  for (const [x, y] of top) shape.lineTo(x, y)
  shape.closePath()
}

function placed(group: Group, geometry: ExtrudeGeometry, material: Material, z: number): Mesh {
  const mesh = place(group, geometry, material)
  mesh.position.z = z
  return mesh
}

const paint = (tint: number) => photo('paint', tint, 0.15)
const CAR_PAINTS = [0x5a1a18, 0x22324a, 0x8d9092, 0x1b1d20, 0x46503c, 0x6a5b3a] as const
const HEADLIGHT = glow(0xfff1d0, 2.5)
const TAILLIGHT = glow(0xff2414, 2.5)
const AMBER = glow(0xffa21a, 3)

// ---------- Storage ----------

const crateBuilder = prop((group) => {
  const look = pick(['pine', 'olive', 'scan'] as const)
  if (look === 'scan') {
    scanned(group, 'wooden_crate_01', { scale: 1.6, z: -1.45 })
    scanned(group, 'wooden_crate_01', { scale: 1.6, z: -1.4, lift: 0.5, turn: 0.06 })
    return
  }
  crate(group, 0, 0, 1.2, 1.1, 1.0, -1.5, look)
})

const crateStack = prop((group) => {
  crate(group, -0.55, 0, 1.08, 1.1, 1.0, -1.6, 'pine')
  crate(group, 0.56, 0, 1.06, 1.05, 1.0, -1.55, pick(['pine', 'olive'] as const))
  crate(group, -0.3, 1.1, 1.2, 1.1, 0.95, -1.62, 'olive')
  scanned(group, 'wooden_crate_01', { scale: 1.25, x: 0.62, z: -1.4, lift: 1.05, turn: -0.15 })
})

const steelCrate = prop((group) => {
  const tint = pick([0x7a8896, 0x7d8660, 0x9a8860])
  box(group, paint(tint), -0.7, 0.04, 1.4, 1.12, 1.05, -1.5)
  const ribs = place(group, mergedBoxes('steelCrateRibs', [
    ...[-0.7, -0.24, 0.2, 0.62].map((x) => [x, 0.04, 0.08, 1.12, 1.1, -1.5] as const),
    [-0.72, 1.12, 1.44, 0.08, 1.1, -1.5], [-0.72, 0, 1.44, 0.08, 1.1, -1.5],
  ]), paint(tint - 0x101010))
  ribs.castShadow = false
  quiet(box(group, FINISH.darkSteel, -0.12, 0.62, 0.24, 0.1, 0.06, -0.95))
  quiet(box(group, hazardStripes(), -0.7, 0.9, 1.4, 0.08, 1.07, -1.5))
})

const barrelBuilder = prop((group) => {
  const id = pick(['Barrel_01', 'barrel_03', 'Barrel_01'] as const)
  scanned(group, id, { scale: id === 'Barrel_01' ? 1.6 : 1.52, z: -1.4, turn: pick([0, 1.2, 2.5]) })
})

const explosiveBarrel = prop((group) => {
  const red = photo('paint', 0xb3261c, 0.15)
  cylinder(group, red, 0, 0.02, 0.42, 1.26, -1.4)
  const band = new Mesh(SLEEVE, flammableBand())
  band.scale.set(0.428, 0.44, 0.428)
  band.position.set(0, 0.62, -1.4)
  band.rotation.y = -0.9
  group.add(band)
  for (const y of [0.3, 1.0]) quiet(cylinder(group, photo('paint', 0x7a1a14, 0.15), 0, y, 0.435, 0.035, -1.4))
  quiet(cylinder(group, FINISH.darkSteel, 0, 1.27, 0.4, 0.03, -1.4))
  quiet(cylinder(group, FINISH.steel, 0.2, 1.29, 0.05, 0.03, -1.3))
})

const GASES = [
  { name: 'OXYGEN', body: 0x3f7a4a, shoulder: 0xe8e8e2, stripe: '#2f5a38' },
  { name: 'ACETYLENE', body: 0x8a3028, shoulder: 0x8a3028, stripe: '#6a2420' },
  { name: 'ARGON', body: 0x5a6a74, shoulder: 0x3f86aa, stripe: '#2f6b8a' },
] as const

const gasCylinder = prop((group) => {
  const gas = pick(GASES)
  const body = photo('paint', gas.body, 0.15)
  cylinder(group, body, 0, 0.02, 0.19, 1.2, -1.5)
  const shoulder = ball(group, photo('paint', gas.shoulder, 0.15), 0, 1.22, 0.19, -1.5)
  shoulder.scale.y = 0.12
  cylinder(group, photo('paint', gas.shoulder, 0.15), 0, 1.22, 0.165, 0.12, -1.5)
  const label = new Mesh(SLEEVE, cylinderLabel(gas.name, gas.stripe))
  label.scale.set(0.193, 0.32, 0.193)
  label.position.set(0, 0.85, -1.5)
  group.add(label)
  quiet(cylinder(group, FINISH.brass, 0, 1.36, 0.05, 0.1, -1.5))
  quiet(cylinder(group, FINISH.darkSteel, 0, 1.44, 0.1, 0.14, -1.5))
  quiet(rod(group, FINISH.brass, 0, 1.4, 0.13, 1.4, 0.025, -1.5))
  // Chained to the wall, as gas bottles must be.
  quiet(box(group, FINISH.darkSteel, -0.22, 1.0, 0.44, 0.03, 0.42, -1.72))
})

const palletBuilder = prop((group) => {
  pallet(group, 0, -1.4)
  if (pick([false, true, false])) quiet(box(group, photo('wood', 0x8a7a5e, 0), -0.6, 0.25, 1.4, 0.04, 0.15, -1.15))
})

const palletStack = prop((group) => {
  pallet(group, 0, -1.4, 1.8)
  const kind = pick(['kraft', 'white', 'kraft'] as const)
  stackedBlocks(group, cartonFace(kind), 0, 0.25, 1.7, 1.33, 1.05, -1.4, 3, 3)
  // Shrink-wrap: a faint glossy skin, and two straps.
  const wrap = box(group, once('wrap', () => matte(0xdde6ea, 0.08, 0)).clone(), -0.87, 0.24, 1.74, 1.26, 1.1, -1.4)
  const film = wrap.material as ReturnType<typeof matte>
  film.transparent = true
  film.opacity = 0.12
  film.depthWrite = false
  wrap.castShadow = false
  wrap.material = once('wrapFilm', () => film)
  for (const x of [-0.45, 0.4]) quiet(box(group, FINISH.black, x, 0.22, 0.05, 1.38, 1.12, -1.4))
})

const shelvingRack = prop((group) => {
  const blue = photo('paint', 0x1f4f8a, 0.15)
  const orange = photo('paint', 0xd0661c, 0.15)
  place(group, mergedBoxes('rackUprights', [
    ...[-1.2, 1.12].flatMap((x) => [[x, 0, 0.08, 3, 0.08, -0.85], [x, 0, 0.08, 3, 0.08, -2.0]] as const),
    ...[-1.2, 1.12].flatMap((x) => [0.5, 1.5, 2.5].map((y) => [x + 0.02, y, 0.04, 0.04, 1.15, -1.42] as const)),
  ]), blue)
  const levels = [0.12, 1.05, 2.0] as const
  place(group, mergedBoxes('rackBeams', levels.flatMap((y) => [[-1.18, y, 2.36, 0.12, 0.06, -0.86], [-1.18, y, 2.36, 0.12, 0.06, -1.99]] as const)), orange)
  place(group, mergedBoxes('rackDecks', levels.slice(1).map((y) => [-1.15, y + 0.1, 2.3, 0.02, 1.12, -1.42] as const)), FINISH.steel, false)
  scanned(group, 'Barrel_01', { x: -0.62, z: -1.4, lift: 0, turn: 0.6 })
  scanned(group, 'barrel_03', { x: 0.1, z: -1.45, lift: 0, turn: 2.0 })
  pallet(group, 0.05, -1.42, 1.5).position.y = 1.17
  stackedBlocks(group, cartonFace(pick(['kraft', 'white'] as const)), 0.05, 1.42, 1.4, 0.5, 0.95, -1.42, 3, 1)
  crate(group, -0.6, 2.12, 0.9, 0.7, 0.9, -1.45, 'olive')
  scanned(group, 'cardboard_box_01', { x: 0.45, z: -1.35, lift: 2.12, scale: 1.6, turn: 1.57 })
})

// ---------- Workshop ----------

const toolBench = prop((group, materials) => {
  box(group, materials.wood, -1.3, 0.8, 2.6, 0.08, 0.85, -1.72)
  place(group, mergedBoxes('benchFrame', [
    ...[-1.25, 1.17].flatMap((x) => [[x, 0, 0.07, 0.8, 0.07, -1.35], [x, 0, 0.07, 0.8, 0.07, -2.08]] as const),
    [-1.25, 0.18, 2.5, 0.05, 0.8, -1.72],
  ]), photo('paint', 0x2c4a6a, 0.15))
  box(group, pegboard(), -1.25, 0.88, 2.5, 0.42, 0.03, -2.16)
  scanned(group, 'metal_tool_chest', { x: 0.55, z: -1.75, lift: 0.23, scale: 0.95 })
  // A bench vice and a box of parts on top.
  box(group, photo('paint', 0x2c4a6a, 0.15), -1.0, 0.88, 0.22, 0.14, 0.2, -1.4)
  quiet(box(group, FINISH.darkSteel, -1.04, 0.98, 0.3, 0.06, 0.08, -1.32))
  scanned(group, 'cardboard_box_01', { x: 0.5, z: -1.85, lift: 0.88, turn: 1.4 })
})

const toolChest = prop((group) => {
  const red = photo('paint', pick([0xa1261e, 0x1d4f8c, 0x2a2c30]), 0.15)
  box(group, red, -0.55, 0.1, 1.1, 0.72, 0.62, -1.7)
  place(group, mergedBoxes('chestDrawers', [0.2, 0.38, 0.56].map((y) => [-0.5, y, 1.0, 0.012, 0.64, -1.7] as const)), FINISH.black, false)
  quiet(box(group, FINISH.chrome, -0.4, 0.74, 0.8, 0.03, 0.66, -1.7))
  for (const x of [-0.45, 0.45]) quiet(disc(group, FINISH.rubber, x, 0.05, -1.42, 0.05, 0.04))
  scanned(group, 'metal_tool_chest', { z: -1.72, lift: 0.82, scale: 1.25 })
})

const generator = prop((group) => {
  const tint = pick([0xc29426, 0x3f5a3a, 0x5a6670])
  const skin = paint(tint)
  box(group, FINISH.darkSteel, -1.5, 0, 3, 0.16, 1.35, -1.5)
  box(group, skin, -1.42, 0.16, 2.6, 1.56, 1.22, -1.5)
  quiet(box(group, louvres(), -1.3, 0.35, 0.7, 1.15, 0.02, -0.88))
  quiet(box(group, louvres(), 0.35, 0.35, 0.7, 1.15, 0.02, -0.88))
  place(group, mergedBoxes('gensetSeams', [[-0.55, 0.22, 0.02, 1.44, 1.24, -1.5], [0.25, 0.22, 0.02, 1.44, 1.24, -1.5], [-1.42, 1.66, 2.6, 0.02, 1.24, -1.5]]), FINISH.black, false)
  box(group, paint(tint - 0x101008), 1.18, 0.5, 0.3, 0.95, 0.5, -1.2)
  quiet(disc(group, gaugeFace(), 1.33, 1.25, -0.94, 0.08, 0.02))
  quiet(box(group, glow(0x39ff6a, 3), 1.25, 1.05, 0.05, 0.05, 0.02, -0.94))
  quiet(box(group, glow(0xff3020, 3), 1.36, 1.05, 0.05, 0.05, 0.02, -0.94))
  rod(group, FINISH.darkSteel, -0.9, 1.72, -0.9, 1.95, 0.09, -1.7)
  quiet(box(group, hazardStripes(), -1.5, 0.0, 3, 0.16, 0.02, -0.82))
})

const transformer = prop((group) => {
  const skin = paint(0x6c7a6a)
  box(group, photo('concrete', 0x9a9a96, 0), -1, 0, 2, 0.18, 1.3, -1.5)
  box(group, skin, -0.62, 0.18, 1.24, 1.5, 1.0, -1.5)
  const fins = mergedBoxes('transformerFins', [-0.98, -0.9, -0.82, -0.74, 0.68, 0.76, 0.84, 0.92].map((x) => [x, 0.3, 0.04, 1.2, 0.9, -1.5] as const))
  place(group, fins, skin)
  rod(group, skin, -0.55, 1.98, 0.55, 1.98, 0.17, -1.85)
  for (const x of [-0.4, 0, 0.4]) {
    cylinder(group, matte(0x5a2e1c, 0.25), x, 1.68, 0.07, 0.6, -1.4)
    quiet(cylinder(group, FINISH.steel, x, 2.28, 0.05, 0.1, -1.4))
  }
  quiet(box(group, dangerSign(), -0.22, 0.8, 0.44, 0.44, 0.02, -0.99))
  quiet(rod(group, FINISH.brass, 0.62, 0.3, 0.9, 0.0, 0.02, -1.0))
})

const switchgear = prop((group) => {
  box(group, switchgearFront(), -1.2, 0.06, 2.4, 2.42, 0.8, -1.8)
  box(group, FINISH.darkSteel, -1.22, 0, 2.44, 0.08, 0.84, -1.8)
  box(group, FINISH.darkSteel, -1.22, 2.48, 2.44, 0.12, 0.84, -1.8)
  for (const [index, colour] of [0xff2a1a, 0x39ff6a, 0x39ff6a, 0xffa21a, 0xff2a1a, 0x39ff6a].entries()) {
    quiet(box(group, glow(colour, 3.5), -1.06 + Math.floor(index / 2) * 0.8 + (index % 2) * 0.12, 2.12, 0.05, 0.05, 0.03, -1.39))
  }
  quiet(box(group, FINISH.rubber, -1.2, 0, 2.4, 0.015, 0.6, -1.0))
})

const boiler = prop((group) => {
  const shell = pick([photo('paint', 0x7c3424, 0.15), photo('paint', 0xb8bcbf, 0.85)])
  box(group, photo('concrete', 0x8e8e8a, 0), -1.0, 0, 1.7, 0.25, 1.5, -1.45)
  cylinder(group, shell, -0.15, 0.25, 0.72, 2.25, -1.45)
  const dome = ball(group, shell, -0.15, 2.5, 0.72, -1.45)
  dome.scale.y = 0.25
  for (const y of [0.7, 1.4, 2.1]) quiet(cylinder(group, FINISH.darkSteel, -0.15, y, 0.735, 0.05, -1.45))
  rod(group, FINISH.darkSteel, -0.15, 2.6, -0.15, 3.0, 0.15, -1.6)
  box(group, paint(0x3a4048), -0.6, 0.25, 0.9, 0.55, 0.3, -0.8)
  quiet(disc(group, gaugeFace(), -0.15, 1.65, -0.72, 0.11, 0.04))
  rod(group, FINISH.steel, 0.55, 1.2, 1.05, 1.2, 0.08, -1.3)
  rod(group, FINISH.steel, 1.0, 0, 1.0, 1.25, 0.08, -1.3)
  quiet(disc(group, matte(0xb02018, 0.5, 0.3), 0.78, 1.2, -1.15, 0.14, 0.03))
  quiet(cylinder(group, FINISH.brass, 0.25, 2.55, 0.05, 0.25, -1.3))
})

const pump = prop((group) => {
  const blue = photo('paint', pick([0x2a5b8c, 0x3d6b3d]), 0.15)
  box(group, FINISH.darkSteel, -0.8, 0, 1.6, 0.12, 0.8, -1.45)
  rod(group, blue, -0.75, 0.42, -0.05, 0.42, 0.26, -1.45)
  quiet(rod(group, FINISH.black, -0.8, 0.42, -0.74, 0.42, 0.22, -1.45))
  box(group, photo('paint', 0xc8a020, 0.15), -0.05, 0.26, 0.22, 0.3, 0.36, -1.45)
  disc(group, blue, 0.4, 0.44, -1.45, 0.3, 0.36)
  rod(group, FINISH.steel, 0.4, 0.7, 0.4, 1.2, 0.1, -1.45)
  quiet(disc(group, FINISH.steel, 0.4, 0.78, -1.45, 0.16, 0.04)).rotation.x = 0
  rod(group, FINISH.steel, 0.7, 0.44, 0.8, 0.44, 0.1, -1.45)
  quiet(rod(group, FINISH.steel, 0.4, 0.95, 0.4, 1.05, 0.02, -1.25))
  quiet(disc(group, matte(0xb02018, 0.5, 0.3), 0.4, 1.06, -1.2, 0.12, 0.025))
})

const waterTank = prop((group) => {
  const shell = pick([photo('paint', 0x8a9a8a, 0.15), photo('paint', 0xb0b6ba, 0.8)])
  box(group, photo('concrete', 0x8e8e8a, 0), -1.2, 0, 2.4, 0.2, 2.0, -1.25)
  cylinder(group, shell, 0, 0.2, 0.95, 2.45, -1.3)
  const dome = ball(group, shell, 0, 2.65, 0.95, -1.3)
  dome.scale.y = 0.3
  for (const y of [0.8, 1.6]) quiet(cylinder(group, FINISH.darkSteel, 0, y, 0.965, 0.05, -1.3))
  quiet(rod(group, glow(0x2a6a9a, 0.5), 0.55, 0.4, 0.55, 2.3, 0.03, -0.45))
  place(group, mergedBoxes('tankLadder', [
    [-0.75, 0.2, 0.04, 2.7, 0.04, -0.3], [-0.45, 0.2, 0.04, 2.7, 0.04, -0.3],
    ...[0.5, 0.8, 1.1, 1.4, 1.7, 2.0, 2.3, 2.6].map((y) => [-0.75, y, 0.34, 0.03, 0.03, -0.3] as const),
  ]), FINISH.steel)
  rod(group, FINISH.steel, 0.8, 0.45, 1.25, 0.45, 0.09, -1.0)
  quiet(disc(group, matte(0x2050a0, 0.5, 0.3), 1.05, 0.45, -0.88, 0.12, 0.03))
})

const hvacUnit = prop((group) => {
  const skin = photo('paint', 0xb8b6aa, 0.15)
  box(group, FINISH.darkSteel, -1.5, 0, 3, 0.12, 1.2, -1.6)
  box(group, skin, -1.45, 0.12, 2.9, 1.5, 1.1, -1.62)
  quiet(box(group, louvres(), -1.35, 0.3, 0.8, 1.1, 0.02, -1.06))
  place(group, mergedBoxes('ahuDoors', [[-0.45, 0.2, 0.02, 1.34, 1.12, -1.62], [0.55, 0.2, 0.02, 1.34, 1.12, -1.62]]), FINISH.black, false)
  place(group, mergedBoxes('ahuHandles', [[-0.33, 0.8, 0.05, 0.2, 1.16, -1.62], [0.67, 0.8, 0.05, 0.2, 1.16, -1.62]]), FINISH.chrome, false)
  box(group, FINISH.rubber, -0.9, 1.62, 0.8, 0.06, 0.8, -1.7)
  box(group, photo('paint', 0xa8aeb4, 0.9), -0.95, 1.68, 0.9, 0.12, 0.85, -1.7)
  quiet(disc(group, gaugeFace(), 1.1, 1.2, -1.06, 0.07, 0.02))
})

const cableReel = prop((group) => {
  const wood = photo('wood', 0x8a7556, 0)
  for (const x of [-0.62, 0.55]) rod(group, wood, x, 0.7, x + 0.07, 0.7, 0.7, -1.45)
  rod(group, matte(0x16181a, 0.55), -0.55, 0.7, 0.55, 0.7, 0.5, -1.45)
  quiet(rod(group, matte(0x16181a, 0.55), 0.4, 0.25, 0.75, 0.02, 0.05, -1.0))
  quiet(rod(group, FINISH.steel, -0.7, 0.7, 0.7, 0.7, 0.07, -1.45))
})

const mopBucket = prop((group) => {
  const yellow = matte(0xe0b020, 0.45)
  box(group, yellow, -0.32, 0.07, 0.64, 0.45, 0.45, -1.3)
  quiet(box(group, matte(0x3a4a40, 0.1), -0.29, 0.5, 0.36, 0.02, 0.4, -1.3))
  box(group, matte(0x4a4d52, 0.5), 0.06, 0.5, 0.26, 0.2, 0.42, -1.3)
  quiet(rod(group, matte(0x4a4d52, 0.5), 0.3, 0.68, 0.38, 1.0, 0.02, -1.3))
  rod(group, matte(0x2a5aa0, 0.4), -0.15, 0.45, -0.05, 1.3, 0.025, -1.35)
  const head = quiet(ball(group, matte(0xb8b0a0, 0.95), -0.16, 0.5, 0.14, -1.35))
  head.scale.y = 0.09
  for (const x of [-0.25, 0.25]) quiet(disc(group, FINISH.rubber, x, 0.035, -1.08, 0.035, 0.03))
})

const wetFloorSign = prop((group) => {
  scanned(group, 'WetFloorSign_01', { scale: 1.45, z: -1.0, turn: pick([0.35, -0.35]) })
})

const stepLadder = prop((group) => {
  // Leant back against the wall, as ladders are left.
  const lean = new Group()
  lean.rotation.x = -0.12
  lean.position.z = -2.05
  scanned(lean, 'ladder_sectioned_01', { scale: 1.02, z: 0 })
  group.add(lean)
})

const workLight = prop((group) => {
  const yellow = matte(0xd8a81c, 0.45, 0.3)
  for (const [x, z] of [[-0.38, -1.2], [0.38, -1.2], [0, -1.75]] as const) rod(group, yellow, 0, 0.8, x, 0, 0.02, z === -1.2 ? -1.38 : -1.6)
  rod(group, yellow, 0, 0.8, 0, 1.52, 0.03, -1.45)
  rod(group, yellow, -0.36, 1.52, 0.36, 1.52, 0.025, -1.45)
  for (const x of [-0.36, 0.06]) {
    box(group, yellow, x, 1.5, 0.3, 0.26, 0.16, -1.42)
    quiet(box(group, glow(0xfff0c8, 3.2), x + 0.03, 1.53, 0.24, 0.2, 0.02, -1.33))
    quiet(box(group, FINISH.black, x + 0.02, 1.52, 0.26, 0.012, 0.02, -1.32))
  }
  quiet(rod(group, FINISH.black, 0, 0.8, 0.3, 0.0, 0.012, -1.3))
})

// ---------- Vehicles ----------

const CAR_BODY = () => profile('car', (s) => bodyWithArches(s, -2.3, 2.3, 0.22, [-1.45, 1.42], 0.4, [
  [2.3, 0.62], [2.22, 0.82], [1.15, 0.9], [0.42, 1.5], [-0.88, 1.52], [-1.78, 0.96], [-2.26, 0.9], [-2.3, 0.62],
]), 1.5)
const CAR_GLASS = () => profile('carGlass', (s) => polygon(s, [[1.06, 0.92], [0.42, 1.44], [-0.84, 1.46], [-1.62, 0.96]]), 1.62, 0.02)

const car = prop((group) => {
  if (pick([false, false, true])) {
    scanned(group, 'covered_car', { turn: Math.PI / 2, scale: 1.15, z: -1.3 })
    return
  }
  const body = matte(pick(CAR_PAINTS), 0.32, 0.55)
  placed(group, CAR_BODY(), body, -1.25)
  placed(group, CAR_GLASS(), FINISH.glass, -1.25)
  quiet(box(group, body, -0.32, 0.9, 0.1, 0.55, 1.64, -1.25))
  for (const x of [-1.45, 1.42]) wheel(group, x, 0.32, -0.4, 0.24)
  quiet(box(group, HEADLIGHT, 2.2, 0.62, 0.12, 0.1, 0.4, -0.75))
  quiet(box(group, TAILLIGHT, -2.36, 0.68, 0.1, 0.12, 0.4, -0.75))
  place(group, mergedBoxes('carTrim', [[-2.38, 0.3, 0.16, 0.2, 1.6, -1.25], [2.26, 0.3, 0.16, 0.2, 1.6, -1.25], [-0.32, 0.3, 0.01, 0.58, 1.62, -1.25], [0.95, 0.3, 0.01, 0.58, 1.62, -1.25]]), FINISH.black, false)
  quiet(box(group, FINISH.chrome, 0.68, 0.76, 0.14, 0.03, 1.66, -1.25))
})

const VAN_BODY = () => profile('van', (s) => bodyWithArches(s, -2.8, 2.8, 0.3, [-1.8, 1.75], 0.46, [
  [2.8, 0.78], [2.7, 1.12], [2.2, 1.28], [1.62, 2.28], [-2.74, 2.36], [-2.8, 2.28],
]), 1.7)
const VAN_GLASS = () => profile('vanGlass', (s) => polygon(s, [[2.12, 1.32], [1.62, 2.16], [0.98, 2.16], [0.98, 1.32]]), 1.8, 0.02)

const van = prop((group) => {
  placed(group, VAN_BODY(), matte(0xd4d6d2, 0.35, 0.35), -1.3)
  placed(group, VAN_GLASS(), FINISH.glass, -1.3)
  quiet(box(group, livery('van'), -2.55, 1.0, 3.3, 1.05, 1.84, -1.3))
  for (const x of [-1.8, 1.75]) wheel(group, x, 0.37, -0.42, 0.26)
  place(group, mergedBoxes('vanTrim', [[-2.9, 0.34, 0.14, 0.28, 1.8, -1.3], [2.74, 0.34, 0.16, 0.28, 1.8, -1.3], [0.92, 0.36, 0.015, 1.9, 1.84, -1.3], [-0.95, 0.36, 0.015, 1.9, 1.84, -1.3]]), FINISH.black, false)
  quiet(box(group, HEADLIGHT, 2.72, 0.95, 0.12, 0.12, 0.4, -0.7))
  quiet(box(group, TAILLIGHT, -2.88, 1.0, 0.1, 0.3, 0.3, -0.62))
  quiet(box(group, AMBER, 1.2, 2.36, 0.25, 0.08, 0.2, -1.3))
})

const TRUCK_CAB = () => profile('truckCab', (s) => bodyWithArches(s, 1.7, 3.5, 0.72, [2.6], 0.56, [[3.5, 1.4], [3.45, 2.42], [3.2, 2.78], [1.7, 2.78]]), 2.0)
const TRUCK_GLASS = () => profile('truckGlass', (s) => polygon(s, [[3.3, 1.75], [3.18, 2.58], [2.3, 2.58], [2.3, 1.75]]), 2.1, 0.02)

const truck = prop((group) => {
  const cabPaint = matte(pick([0x8a1c18, 0x1d3f6a, 0xd0d0cc]), 0.35, 0.45)
  box(group, FINISH.darkSteel, -3.4, 0.5, 6.6, 0.28, 1.5, -1.3)
  placed(group, TRUCK_CAB(), cabPaint, -1.3)
  placed(group, TRUCK_GLASS(), FINISH.glass, -1.3)
  box(group, photo('corrugated', 0xb4b6b2, 0.5, 4, 1), -3.5, 0.82, 5.1, 2.38, 2.1, -1.3)
  quiet(box(group, livery('truck'), -3.2, 1.3, 4.4, 1.4, 2.16, -1.3))
  for (const x of [-2.6, -1.5, 2.6]) wheel(group, x, 0.5, -0.32, 0.3)
  rod(group, FINISH.chrome, 0.6, 0.62, 1.55, 0.62, 0.22, -0.55)
  rod(group, FINISH.chrome, 1.78, 1.0, 1.78, 3.15, 0.06, -0.45)
  quiet(box(group, HEADLIGHT, 3.42, 1.0, 0.12, 0.16, 0.45, -0.6))
  place(group, mergedBoxes('truckLamps', [[2.2, 2.78, 0.1, 0.06, 0.1, -0.6], [2.6, 2.78, 0.1, 0.06, 0.1, -0.6], [3.0, 2.78, 0.1, 0.06, 0.1, -0.6]]), AMBER, false)
  quiet(box(group, TAILLIGHT, -3.56, 0.85, 0.08, 0.18, 0.4, -0.5))
  quiet(box(group, FINISH.black, 3.42, 0.62, 0.14, 0.3, 2.04, -1.3))
})

const forklift = prop((group) => {
  const yellow = photo('paint', 0xd8a51c, 0.15)
  box(group, yellow, -0.95, 0.22, 1.5, 0.75, 1.15, -1.35)
  box(group, photo('paint', 0x3a3c3e, 0.15), -1.3, 0.22, 0.4, 0.95, 1.2, -1.35)
  for (const [x, r] of [[0.32, 0.34], [-0.85, 0.27]] as const) wheel(group, x, r, -0.72, 0.24, matte(0xc8a020, 0.5, 0.4))
  box(group, FINISH.black, -0.75, 0.97, 0.5, 0.12, 0.5, -1.35)
  box(group, FINISH.black, -0.82, 1.08, 0.12, 0.5, 0.5, -1.35)
  quiet(rod(group, FINISH.black, -0.05, 0.97, 0.1, 1.35, 0.03, -1.35))
  quiet(disc(group, FINISH.black, 0.1, 1.38, -1.35, 0.13, 0.03)).rotation.set(0, 0, 0.6)
  place(group, mergedBoxes('forkliftGuard', [
    [-0.95, 0.97, 0.06, 1.13, 0.06, -0.85], [-0.95, 0.97, 0.06, 1.13, 0.06, -1.85],
    [-0.95, 2.06, 1.3, 0.06, 1.06, -1.35], ...[-0.6, -0.2, 0.2].map((x) => [x, 2.06, 0.04, 0.07, 1.06, -1.35] as const),
  ]), FINISH.black)
  quiet(rod(group, FINISH.black, 0.3, 0.97, 0.3, 2.07, 0.035, -0.85))
  place(group, mergedBoxes('forkliftMast', [
    [0.62, 0.1, 0.08, 2.3, 0.1, -0.95], [0.62, 0.1, 0.08, 2.3, 0.1, -1.75], [0.62, 2.32, 0.08, 0.08, 0.9, -1.35],
    [0.62, 0.9, 0.08, 0.06, 0.9, -1.35],
  ]), FINISH.darkSteel)
  place(group, mergedBoxes('forkliftForks', [
    [0.72, 0.12, 0.05, 0.6, 0.9, -1.35], ...[-1.0, -1.7].flatMap((z) => [[0.72, 0.05, 0.08, 0.5, 0.1, z], [0.72, 0.05, 0.58, 0.05, 0.1, z]] as const),
  ]), FINISH.darkSteel)
  quiet(cylinder(group, AMBER, -0.6, 2.12, 0.06, 0.1, -1.35))
  quiet(box(group, hazardStripes(), -1.3, 0.35, 0.4, 0.14, 0.02, -0.74))
})

const dumpster = prop((group) => {
  const skin = photo('paint', pick([0x2d4a35, 0x27405e, 0x5a3a24]), 0.15)
  box(group, skin, -1.25, 0.2, 2.5, 1.22, 1.3, -1.5)
  box(group, skin, -1.3, 1.36, 2.6, 0.08, 1.38, -1.5)
  const lid = box(group, matte(0x1c1e20, 0.6), -1.28, 1.44, 1.25, 0.06, 1.38, -1.5)
  lid.rotation.z = 0.04
  box(group, matte(0x1c1e20, 0.6), 0.03, 1.44, 1.25, 0.06, 1.38, -1.5).rotation.z = -0.12
  place(group, mergedBoxes('dumpsterRibs', [[-1.0, 0.25, 0.06, 1.1, 1.36, -1.5], [0.97, 0.25, 0.06, 1.1, 1.36, -1.5], [-1.3, 0.7, 0.12, 0.25, 1.0, -1.5], [1.18, 0.7, 0.12, 0.25, 1.0, -1.5]]), skin)
  for (const x of [-1.0, 1.0]) quiet(disc(group, FINISH.rubber, x, 0.09, -0.95, 0.09, 0.06))
  quiet(box(group, hazardStripes(), -1.25, 0.3, 2.5, 0.08, 1.31, -1.5))
})

const tireStack = prop((group) => {
  for (let index = 0; index < 6; index += 1) {
    const lie = new Group()
    lie.rotation.x = Math.PI / 2
    lie.position.set(((index * 37) % 5) * 0.015 - 0.03, (0.12 + index * 0.24), -1.45)
    scanned(lie, 'old_tyre', { scale: 1.6, z: 0 })
    group.add(lie)
  }
})

// ---------- Labs and server rooms ----------

const labBench = prop((group) => {
  box(group, labCabinets(), -1.5, 0.05, 3, 0.77, 0.72, -1.78)
  box(group, FINISH.black, -1.5, 0, 3, 0.06, 0.66, -1.8)
  box(group, matte(0x15171a, 0.25), -1.52, 0.82, 3.04, 0.06, 0.8, -1.76)
  place(group, mergedBoxes('labShelf', [[-1.4, 0.88, 0.03, 0.42, 0.03, -2.1], [1.37, 0.88, 0.03, 0.42, 0.03, -2.1], [-1.42, 1.25, 2.84, 0.03, 0.28, -2.02]]), FINISH.steel)
  const bottle = (x: number, y: number, h: number) => [x, y, 0.08, h, 0.08, -2.0] as const
  place(group, mergedBoxes('labBottlesAmber', [bottle(-1.2, 1.28, 0.16), bottle(-1.05, 1.28, 0.2), bottle(0.3, 1.28, 0.14), bottle(0.9, 0.88, 0.22)]), matte(0x6a3a10, 0.1, 0.1))
  place(group, mergedBoxes('labBottlesClear', [bottle(-0.85, 1.28, 0.12), bottle(0.5, 1.28, 0.18), bottle(1.1, 1.28, 0.16), bottle(-0.4, 0.88, 0.14)]), matte(0x9ac4c8, 0.05, 0.2))
  rod(group, FINISH.chrome, -0.3, 0.88, -0.3, 1.15, 0.02, -2.0)
  quiet(rod(group, FINISH.chrome, -0.3, 1.15, -0.15, 1.08, 0.018, -1.95))
  box(group, matte(0xe0e2e0, 0.4), 0.15, 0.88, 0.3, 0.2, 0.3, -1.6)
  quiet(box(group, glow(0x5fd0ff, 1.5), 0.18, 0.95, 0.12, 0.06, 0.01, -1.44))
})

const fumeHood = prop((group) => {
  const white = photo('paint', 0xd8dad6, 0.15)
  box(group, labCabinets(), -1, 0.04, 2, 0.8, 0.85, -1.7)
  box(group, matte(0x15171a, 0.25), -1, 0.84, 2, 0.06, 0.95, -1.68)
  box(group, white, -1, 0.9, 0.12, 1.5, 0.95, -1.68)
  box(group, white, 0.88, 0.9, 0.12, 1.5, 0.95, -1.68)
  box(group, white, -1, 2.0, 2, 0.4, 0.95, -1.68)
  box(group, matte(0x8a9090, 0.6), -0.88, 0.9, 1.76, 1.1, 0.04, -2.12)
  quiet(box(group, glow(0xe8f4ff, 2.5), -0.8, 1.94, 1.6, 0.04, 0.3, -1.6))
  quiet(box(group, FINISH.clearGlass, -0.88, 1.25, 1.76, 0.75, 0.02, -1.24))
  quiet(box(group, FINISH.steel, -0.88, 1.22, 1.76, 0.05, 0.05, -1.22))
  quiet(box(group, glow(0x39ff6a, 1.8), 0.55, 2.15, 0.22, 0.1, 0.01, -1.2))
  rod(group, photo('paint', 0xb0b6ba, 0.85), 0, 2.4, 0, 2.8, 0.22, -1.7)
})

const centrifuge = prop((group) => {
  const white = matte(0xe2e4e0, 0.45)
  box(group, white, -0.42, 0.06, 0.84, 0.88, 0.75, -1.5)
  rod(group, white, -0.4, 0.92, 0.4, 0.92, 0.26, -1.55)
  box(group, matte(0x3a3f45, 0.4), -0.4, 0.7, 0.8, 0.2, 0.1, -1.08)
  quiet(box(group, glow(0x5fd0ff, 1.8), -0.3, 0.75, 0.3, 0.1, 0.01, -1.02))
  quiet(box(group, glow(0x39ff6a, 3), 0.15, 0.78, 0.05, 0.05, 0.01, -1.02))
  quiet(box(group, FINISH.black, -0.42, 0, 0.84, 0.06, 0.7, -1.5))
  quiet(box(group, matte(0x2a6a9a, 0.4), -0.42, 0.45, 0.84, 0.04, 0.76, -1.5))
})

const LIQUID = once('specimenLiquid', () => {
  const liquid = glow(0x2cff9a, 0.7).clone()
  liquid.color.setHex(0x0a3020)
  liquid.transparent = true
  liquid.opacity = 0.42
  liquid.depthWrite = false
  return liquid
})

const specimenTank = prop((group) => {
  cylinder(group, FINISH.darkSteel, 0, 0, 0.56, 0.36, -1.4)
  cylinder(group, FINISH.darkSteel, 0, 2.3, 0.56, 0.3, -1.4)
  // A pale, curled-up figure floating in the fluid.
  const flesh = matte(0x6a7a6a, 0.5)
  quiet(cylinder(group, flesh, 0, 0.75, 0.16, 0.75, -1.4)).scale.x = 0.2
  quiet(ball(group, flesh, 0.02, 1.68, 0.15, -1.4))
  quiet(rod(group, flesh, -0.1, 1.42, -0.26, 1.0, 0.05, -1.4))
  quiet(cylinder(group, LIQUID, 0, 0.36, 0.48, 1.85, -1.4))
  quiet(cylinder(group, FINISH.clearGlass, 0, 0.36, 0.5, 1.94, -1.4))
  quiet(cylinder(group, glow(0x2cff9a, 2), 0, 0.36, 0.5, 0.03, -1.4))
  quiet(rod(group, FINISH.black, 0.35, 2.55, 0.5, 2.6, 0.04, -1.9))
})

const serverRack = prop((group) => {
  box(group, matte(0x121417, 0.5, 0.4), -0.5, 0.04, 1.0, 2.38, 1.0, -1.6)
  quiet(box(group, serverFront(pick([0, 1, 2])), -0.44, 0.1, 0.88, 2.26, 0.01, -1.095))
  place(group, mergedBoxes('rackTrim', [[-0.52, 0, 1.04, 0.06, 1.02, -1.6], [-0.52, 2.38, 1.04, 0.08, 1.02, -1.6], [-0.5, 0.04, 0.06, 2.38, 1.03, -1.6], [0.44, 0.04, 0.06, 2.38, 1.03, -1.6]]), FINISH.darkSteel)
  quiet(box(group, FINISH.steel, 0.36, 1.1, 0.03, 0.25, 0.03, -1.07))
  // Cable bundles rising from the top into the overhead tray.
  for (const [x, colour] of [[-0.25, 0x2a5aa0], [0, 0xd0b020], [0.22, 0x8a1c18]] as const) quiet(rod(group, matte(colour, 0.6), x, 2.44, x * 0.6, 2.5, 0.05, -1.75))
  quiet(box(group, matte(0x2a2c30, 0.6), -0.4, 2.46, 0.8, 0.04, 0.3, -1.8))
})

const coolingUnit = prop((group) => {
  box(group, coolingFront(), -0.8, 0.06, 1.6, 2.44, 0.9, -1.7)
  box(group, FINISH.darkSteel, -0.82, 0, 1.64, 0.08, 0.92, -1.7)
  box(group, photo('paint', 0xb0b6ba, 0.85), -0.6, 2.5, 1.2, 0.1, 0.7, -1.75)
  place(group, mergedBoxes('coolingSeams', [[-0.01, 0.06, 0.02, 2.44, 0.92, -1.7]]), FINISH.black, false)
})

const consoleCart = prop((group) => {
  const frame = matte(0x2a2e33, 0.5, 0.6)
  box(group, frame, -0.55, 0.15, 1.1, 0.06, 0.65, -1.4)
  box(group, frame, -0.55, 0.72, 1.1, 0.05, 0.7, -1.4)
  place(group, mergedBoxes('cartLegs', [[-0.53, 0.1, 0.05, 0.65, 0.05, -1.1], [0.48, 0.1, 0.05, 0.65, 0.05, -1.1], [-0.53, 0.1, 0.05, 0.65, 0.05, -1.7], [0.48, 0.1, 0.05, 0.65, 0.05, -1.7]]), FINISH.steel)
  for (const x of [-0.48, 0.48]) quiet(disc(group, FINISH.rubber, x, 0.05, -1.1, 0.05, 0.04))
  box(group, FINISH.plastic, -0.4, 0.77, 0.8, 0.03, 0.3, -1.3)
  box(group, FINISH.plastic, -0.38, 0.86, 0.76, 0.52, 0.06, -1.6)
  quiet(box(group, terminalScreen(), -0.34, 0.9, 0.68, 0.44, 0.01, -1.565))
  quiet(box(group, FINISH.plastic, -0.05, 0.77, 0.1, 0.1, 0.08, -1.62))
  box(group, matte(0x1a1c1f, 0.5), -0.5, 0.21, 0.6, 0.3, 0.5, -1.45)
  quiet(box(group, glow(0x39ff6a, 3), -0.45, 0.4, 0.04, 0.04, 0.01, -1.19))
})

const archiveShelf = prop((group) => {
  for (const x of [-0.74, 0, 0.74]) scanned(group, 'steel_frame_shelves_02', { x, z: -1.75, scale: 1.4 })
  const ends = archiveBoxes()
  for (const [index, y] of [0.1, 0.78, 1.46, 2.12].entries()) {
    quiet(box(group, ends, -1.05, y, 2.1, 0.5 - (index === 3 ? 0.08 : 0), 0.55, -1.75))
  }
})

const toolWall = prop((group) => {
  box(group, pegboard(), -1.2, -1.4, 2.4, 1.4, 0.03, 0.02)
  place(group, mergedBoxes('toolWallFrame', [[-1.24, -1.44, 2.48, 0.05, 0.05, 0.03], [-1.24, -0.04, 2.48, 0.05, 0.05, 0.03], [-1.24, -1.44, 0.05, 1.45, 0.05, 0.03], [1.19, -1.44, 0.05, 1.45, 0.05, 0.03]]), photo('wood', 0x6e5a40, 0), false)
  quiet(box(group, matte(0x8a1c18, 0.4, 0.3), -0.9, -0.55, 0.06, 0.4, 0.06, 0.07))
  quiet(rod(group, FINISH.steel, 0.3, -0.3, 0.3, -0.9, 0.02, 0.07))
  quiet(box(group, matte(0xd07020, 0.5), 0.75, -0.85, 0.3, 0.2, 0.1, 0.09))
})

export const INDUSTRIAL_PROPS: PropSet = {
  crate: crateBuilder, crateStack, steelCrate, barrel: barrelBuilder, explosiveBarrel, gasCylinder, pallet: palletBuilder, palletStack,
  forklift, shelvingRack, toolBench, toolChest, generator, transformer, switchgear, boiler, pump, waterTank, hvacUnit, cableReel,
  mopBucket, wetFloorSign, stepLadder, workLight, car, van, truck, dumpster, tireStack, labBench, fumeHood, centrifuge,
  specimenTank, serverRack, coolingUnit, consoleCart, archiveShelf, toolWall,
}
