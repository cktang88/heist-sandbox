import { CylinderGeometry, DoubleSide, Group, Mesh } from 'three'
import type { SurfaceMaterials } from '../levelMesh'
import type { PropBuilder, PropSet } from './index'
import { BOX, ball, box, cylinder, glow, matte, scanned } from './kit'
import { FINISH, SLEEVE, dangerSign, hazardStripes, louvres, mergedBoxes, mergedPieces, once, photo, pick, place, quiet, rod, type Piece } from './industrialParts'
import { DISH, FLAG, RAZOR_COIL, SIGN_COUNT, advert, boothSign, flagCloth, signFace, turbineVanes } from './exteriorParts'

/**
 * 3D models for the 'exterior' props: rooftop plant, perimeter furniture and street fittings.
 * Lights on them (aviation beacons, helipad lights, billboards) are emissive so they bloom in the night air.
 */

type Build = (group: Group, materials: SurfaceMaterials) => void
const prop = (build: Build): PropBuilder => (materials) => {
  const group = new Group()
  build(group, materials)
  return group
}

const galvanised = () => photo('paint', 0xa4aaae, 0.75)
const concrete = () => photo('concrete', 0x9a9890, 0)
const BEACON = glow(0xff2a1a, 6)
const CONE = once('cone', () => new CylinderGeometry(0.04, 1, 1, 24))

/** Thin straight struts between two points in the x-y plane at depth z, merged into one geometry. */
function struts(key: string, lines: readonly (readonly [number, number, number, number, number])[], thickness: number) {
  return mergedPieces(key, BOX, lines.map(([x1, y1, x2, y2, z]): Piece => {
    const length = Math.hypot(x2 - x1, y2 - y1)
    return [(x1 + x2) / 2, (y1 + y2) / 2, z, thickness, length, thickness, -Math.atan2(x2 - x1, y2 - y1)]
  }))
}

// ---------- Rooftop ----------

const ANTENNA_LATTICE = () => struts('antennaLattice', [
  [-0.22, 0, -0.06, 4.4, -1.5], [0.22, 0, 0.06, 4.4, -1.5], [0, 0, 0, 4.4, -1.8],
  ...Array.from({ length: 11 }, (_, index) => {
    const y = index * 0.4
    const half = 0.22 - (0.16 * y) / 4.4
    const next = 0.22 - (0.16 * (y + 0.4)) / 4.4
    return (index % 2 ? [half, y, -next, y + 0.4, -1.5] : [-half, y, next, y + 0.4, -1.5]) as [number, number, number, number, number]
  }),
], 0.03)

const antenna = prop((group) => {
  box(group, concrete(), -0.3, 0, 0.6, 0.12, 0.6, -1.6)
  place(group, ANTENNA_LATTICE(), galvanised())
  rod(group, galvanised(), 0, 4.4, 0, 4.92, 0.025, -1.6)
  place(group, struts('antennaDipoles', [[-0.28, 4.55, 0.28, 4.55, -1.6], [-0.2, 4.72, 0.2, 4.72, -1.6], [0.0, 4.2, 0.3, 4.38, -1.6]], 0.02), galvanised(), false)
  quiet(box(group, matte(0xd8d8d4, 0.5), 0.06, 3.6, 0.14, 0.36, 0.1, -1.45))
  quiet(ball(group, BEACON, 0, 4.95, 0.05, -1.6))
  quiet(rod(group, FINISH.black, 0.05, 0.1, 0.1, 3.6, 0.012, -1.42))
})

const satelliteDish = prop((group) => {
  const white = matte(0xaeb0ac, 0.7)
  box(group, concrete(), -0.45, 0, 0.9, 0.15, 0.9, -1.4)
  rod(group, galvanised(), 0, 0.15, 0, 1.05, 0.06, -1.4)
  const aim = new Group()
  aim.position.set(0, 1.1, -1.4)
  aim.rotation.set(0.45, 0.7, 0, 'YXZ')
  const bowl = new Mesh(DISH, white)
  bowl.scale.set(1.5, 1.1, 1.5)
  bowl.material = once('dishWhite', () => {
    const material = white.clone()
    material.side = DoubleSide
    return material
  })
  bowl.castShadow = true
  aim.add(bowl)
  rod(aim, galvanised(), 0, 0.2, 0, 1.0, 0.02, 0)
  const feed = new Mesh(BOX, FINISH.plastic)
  feed.scale.set(0.12, 0.16, 0.12)
  feed.position.set(0, 1.05, 0)
  aim.add(feed)
  group.add(aim)
  quiet(rod(group, FINISH.black, 0.05, 1.0, 0.3, 0.15, 0.015, -1.3))
})

const roofAcUnit = prop((group) => {
  place(group, mergedBoxes('acStand', [
    [-1.15, 0, 0.08, 0.3, 0.6, -1.6], [1.07, 0, 0.08, 0.3, 0.6, -1.6], [-1.15, 0.24, 2.3, 0.06, 0.6, -1.6],
  ]), galvanised())
  scanned(group, 'exterior_aircon_unit', { scale: 1.4, z: -1.62, lift: 0.36 })
  rod(group, matte(0x1c1e20, 0.8), 0.95, 0.5, 0.95, 0.05, 0.04, -1.9)
  quiet(rod(group, matte(0x1c1e20, 0.8), 0.95, 0.05, 1.2, 0.05, 0.04, -1.9))
})

const roofVent = prop((group) => {
  box(group, galvanised(), -0.35, 0, 0.7, 0.3, 0.7, -1.4)
  if (pick([true, false])) {
    cylinder(group, galvanised(), 0, 0.3, 0.2, 0.25, -1.4)
    const head = ball(group, turbineVanes(), 0, 0.72, 0.3, -1.4)
    head.scale.y = 0.26
    quiet(cylinder(group, galvanised(), 0, 0.97, 0.06, 0.04, -1.4))
    return
  }
  // A gooseneck: a pipe up and over, its mouth facing down behind a grille.
  rod(group, galvanised(), 0, 0.3, 0, 0.72, 0.2, -1.4)
  quiet(ball(group, galvanised(), 0.0, 0.74, 0.2, -1.4))
  rod(group, galvanised(), 0, 0.76, 0.3, 0.76, 0.2, -1.4)
  rod(group, galvanised(), 0.32, 0.8, 0.32, 0.5, 0.21, -1.4)
  quiet(cylinder(group, FINISH.black, 0.32, 0.48, 0.19, 0.02, -1.4))
})

const roofWaterTank = prop((group) => {
  const steel = photo('paint', 0x4a4e52, 0.6)
  place(group, mergedBoxes('towerLegs', [
    [-1.15, 0, 0.1, 1.05, 0.1, -0.8], [1.05, 0, 0.1, 1.05, 0.1, -0.8], [-1.15, 0, 0.1, 1.05, 0.1, -2.1], [1.05, 0, 0.1, 1.05, 0.1, -2.1],
    [-1.25, 0.95, 2.5, 0.1, 1.5, -1.45],
  ]), steel)
  place(group, struts('towerBraces', [[-1.1, 0.05, 1.1, 0.95, -0.8], [1.1, 0.05, -1.1, 0.95, -0.8]], 0.04), steel)
  cylinder(group, photo('wood', 0x8a7a68, 0, 6, 1), 0, 1.05, 1.18, 1.75, -1.45)
  for (const y of [1.25, 1.65, 2.05, 2.45]) {
    const hoop = quiet(new Mesh(SLEEVE, FINISH.darkSteel))
    hoop.scale.set(1.2, 0.04, 1.2)
    hoop.position.set(0, y, -1.45)
    group.add(hoop)
  }
  const roof = new Mesh(CONE, photo('paint', 0x3a3e40, 0.4))
  roof.scale.set(1.3, 0.55, 1.3)
  roof.position.set(0, 2.8 + 0.275, -1.45)
  roof.castShadow = true
  group.add(roof)
  quiet(ball(group, FINISH.darkSteel, 0, 3.38, 0.05, -1.45))
  place(group, mergedBoxes('towerLadder', [
    [0.7, 0.0, 0.04, 2.9, 0.04, -0.2], [1.0, 0.0, 0.04, 2.9, 0.04, -0.2],
    ...Array.from({ length: 9 }, (_, index) => [0.7, 0.2 + index * 0.3, 0.34, 0.03, 0.03, -0.2] as const),
  ]), steel, false)
  rod(group, steel, -0.6, 0.1, -0.6, 1.05, 0.08, -1.2)
})

const helipadLight = prop((group) => {
  quiet(cylinder(group, FINISH.darkSteel, 0, 0, 0.13, 0.07, -0.9))
  const dome = quiet(ball(group, glow(pick([0x7cff4f, 0x7cff4f, 0xfff0c0]), 3), 0, 0.07, 0.1, -0.9))
  dome.scale.y = 0.12
})

// ---------- Street and perimeter ----------

const billboard = prop((group) => {
  box(group, FINISH.darkSteel, -3, -3, 6, 3, 0.18, 0.09)
  quiet(box(group, advert(pick([0, 1, 2])), -2.9, -2.82, 5.8, 2.74, 0.01, 0.185))
  place(group, mergedBoxes('billboardFrame', [
    [-3.05, -3.0, 6.1, 0.12, 0.24, 0.12], [-3.05, -0.1, 6.1, 0.12, 0.24, 0.12],
    [-3.05, -3.0, 0.12, 3.0, 0.24, 0.12], [2.93, -3.0, 0.12, 3.0, 0.24, 0.12],
  ]), photo('paint', 0x2a2e33, 0.6))
  // A maintenance catwalk under the board and lamps leaning over its top.
  place(group, mergedBoxes('billboardCatwalk', [[-2.9, -3.12, 5.8, 0.05, 0.55, 0.32], [-2.9, -2.82, 5.8, 0.03, 0.03, 0.58], ...[-2.8, -1.4, 0, 1.4, 2.8].map((x) => [x, -3.12, 0.03, 0.32, 0.03, 0.58] as const)]), FINISH.darkSteel, false)
  for (const x of [-2, 0, 2]) {
    quiet(box(group, FINISH.darkSteel, x - 0.015, 0.0, 0.03, 0.03, 0.5, 0.42))
    quiet(box(group, glow(0xfff2d8, 4), x - 0.12, -0.04, 0.24, 0.06, 0.12, 0.66))
  }
})

const bollard = prop((group) => {
  const yellow = photo('paint', 0xd8a51c, 0.2)
  cylinder(group, yellow, 0, 0, 0.15, 0.9, -0.9)
  const cap = ball(group, yellow, 0, 0.9, 0.15, -0.9)
  cap.scale.y = 0.07
  for (const y of [0.62, 0.74]) {
    const band = new Mesh(SLEEVE, matte(0xe8e8e4, 0.2))
    band.scale.set(0.152, 0.06, 0.152)
    band.position.set(0, y, -0.9)
    group.add(band)
  }
  quiet(cylinder(group, FINISH.darkSteel, 0, 0, 0.19, 0.03, -0.9))
})

const jerseyBarrier = prop((group) => {
  // The scan is shorter than the catalogue's barrier, so it is stretched lengthwise a little.
  const stretch = new Group()
  stretch.scale.x = 1.17
  scanned(stretch, 'concrete_road_barrier', { scale: 1.46, z: -1.3 })
  group.add(stretch)
})

const fireHydrant = prop((group) => {
  const red = photo('paint', pick([0xb32a1e, 0xb32a1e, 0xd8a51c]), 0.2)
  quiet(cylinder(group, FINISH.darkSteel, 0, 0, 0.2, 0.05, -0.9))
  cylinder(group, red, 0, 0.05, 0.14, 0.58, -0.9)
  cylinder(group, red, 0, 0.6, 0.165, 0.07, -0.9)
  const dome = ball(group, red, 0, 0.67, 0.14, -0.9)
  dome.scale.y = 0.11
  quiet(cylinder(group, FINISH.darkSteel, 0, 0.76, 0.04, 0.08, -0.9))
  rod(group, red, -0.25, 0.42, 0.25, 0.42, 0.055, -0.9)
  place(group, mergedBoxes('hydrantCaps', [[-0.27, 0.36, 0.04, 0.12, 0.12, -0.9], [0.23, 0.36, 0.04, 0.12, 0.12, -0.9]]), FINISH.darkSteel, false)
  const pumper = quiet(cylinder(group, red, 0, 0, 0.08, 0.12, -0.9))
  pumper.rotation.x = Math.PI / 2
  pumper.position.set(0, 0.32, -0.76)
})

const powerBox = prop((group) => {
  const skin = photo('paint', pick([0x6a7a6a, 0x7a7e82]), 0.2)
  box(group, concrete(), -0.5, 0, 1, 0.15, 0.7, -1.5)
  box(group, skin, -0.45, 0.15, 0.9, 1.42, 0.55, -1.5)
  box(group, skin, -0.48, 1.55, 0.96, 0.05, 0.6, -1.5)
  place(group, mergedBoxes('powerBoxSeams', [[-0.01, 0.2, 0.02, 1.32, 0.57, -1.5]]), FINISH.black, false)
  quiet(box(group, dangerSign(), -0.38, 1.05, 0.3, 0.3, 0.01, -1.22))
  quiet(box(group, louvres(), 0.08, 0.3, 0.3, 0.35, 0.01, -1.22))
  scanned(group, 'power_box_01', { x: 0.24, z: -1.2, lift: 1.1, scale: 0.75 })
  rod(group, FINISH.black, -0.3, 0.15, -0.3, 0.0, 0.05, -1.4)
})

const streetSign = prop((group) => {
  rod(group, galvanised(), 0, 0, 0, 2.6, 0.035, -0.9)
  box(group, signFace(pick(Array.from({ length: SIGN_COUNT }, (_, index) => index))), -0.32, 1.95, 0.64, 0.64, 0.02, -0.86)
  quiet(box(group, FINISH.darkSteel, -0.3, 1.94, 0.6, 0.66, 0.015, -0.88))
  quiet(cylinder(group, FINISH.darkSteel, 0, 0, 0.07, 0.04, -0.9))
})

const flagPole = prop((group) => {
  box(group, concrete(), -0.25, 0, 0.5, 0.2, 0.5, -1.5)
  rod(group, FINISH.steel, 0, 0.2, 0, 5.9, 0.035, -1.5)
  quiet(ball(group, FINISH.brass, 0, 5.95, 0.05, -1.5))
  const flag = new Mesh(FLAG, flagCloth())
  flag.scale.set(1.5, 1.5, 1.5)
  flag.position.set(0.04, 5.35, -1.5)
  group.add(flag)
  quiet(rod(group, matte(0xd8d8d4, 0.8), 0.04, 1.2, 0.04, 5.85, 0.006, -1.45))
})

const guardBooth = prop((group) => {
  const wall = photo('paint', 0xc8c8c0, 0.15)
  box(group, wall, -1.2, 0, 2.4, 1.0, 1.6, -1.4)
  place(group, mergedBoxes('boothPosts', [
    [-1.2, 1.0, 0.1, 1.5, 0.1, -0.65], [1.1, 1.0, 0.1, 1.5, 0.1, -0.65], [-1.2, 1.0, 0.1, 1.5, 0.1, -2.15], [1.1, 1.0, 0.1, 1.5, 0.1, -2.15],
    [-0.05, 1.0, 0.08, 1.5, 0.08, -0.65],
  ]), wall)
  box(group, glow(0xffd9a8, 0.35), -1.12, 1.0, 2.24, 1.5, 0.02, -2.1)
  quiet(box(group, FINISH.clearGlass, -1.12, 1.0, 2.24, 1.5, 0.02, -0.66))
  box(group, photo('paint', 0x3a3e44, 0.4), -1.35, 2.5, 2.7, 0.2, 1.9, -1.4)
  quiet(box(group, boothSign(), -0.6, 2.53, 1.2, 0.14, 0.01, -0.445))
  box(group, matte(0x3a3632, 0.6), -1.1, 0.95, 1.3, 0.06, 0.6, -1.9)
  quiet(box(group, hazardStripes(), -1.2, 0.0, 2.4, 0.15, 1.62, -1.4))
  quiet(rod(group, FINISH.black, 0.9, 2.7, 0.9, 2.95, 0.012, -1.6))
  quiet(cylinder(group, glow(0xffa21a, 4), -1.0, 2.7, 0.06, 0.1, -1.0))
})

const razorCoil = prop((group) => {
  const coil = place(group, RAZOR_COIL, FINISH.chrome, false)
  coil.position.z = -0.95
})

export const EXTERIOR_PROPS: PropSet = {
  antenna, satelliteDish, roofAcUnit, roofVent, roofWaterTank, helipadLight, billboard, bollard, jerseyBarrier, fireHydrant,
  powerBox, streetSign, flagPole, guardBooth, razorCoil,
}
