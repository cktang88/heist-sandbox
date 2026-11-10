import { Group, Mesh, TorusGeometry } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { SurfaceMaterials } from '../levelMesh'
import type { PropBuilder, PropSet } from './index'
import { ball, box, cylinder, glow, matte, scanned } from './kit'
import {
  FINISH, FRUSTUM, crate, disc, hazardStripes, mergedBoxes, mergedPieces, once, pallet, photo, pick, place, quiet, rod, stackedBlocks,
  type Piece,
} from './industrialParts'
import {
  ammoLockerFront, barricadeBoard, burlap, cashFace, cctvScreen, cctvWall, depositGrid, detectorDisplay, keyBoard, radioPanel,
  safePlate, shieldMaterial, weldedMesh,
} from './securityParts'

/**
 * 3D models for the 'security' props: the control room, armoury, checkpoint, cells and vault.
 * Gold is real metal (fully metallic, low roughness, warm), so it catches the room's reflections.
 */

type Build = (group: Group, materials: SurfaceMaterials) => void
const prop = (build: Build): PropBuilder => (materials) => {
  const group = new Group()
  build(group, materials)
  return group
}

const steelGrey = () => photo('paint', 0x6a7078, 0.3)
const olive = () => photo('paint', 0x5a6444, 0.2)

/** A rifle from the scan set, stood upright with its muzzle up, its butt on `bottom`. */
function uprightRifle(group: Group, x: number, bottom: number, z: number, lean = 0): void {
  const stand = new Group()
  stand.rotation.z = Math.PI / 2 + lean
  stand.position.set(x, bottom + 0.58, z)
  scanned(stand, 'bolt_action_rifle_7_62', { z: 0 })
  group.add(stand)
}

/** Olive ammunition cans in a row, merged. */
function ammoCans(group: Group, left: number, bottom: number, count: number, z: number): void {
  const cans = place(group, mergedBoxes(`ammoCans:${count}`, Array.from({ length: count }, (_, index) => [index * 0.3, 0, 0.26, 0.2, 0.14, 0] as const)), olive())
  cans.position.set(left, bottom, z)
  const lids = place(group, mergedBoxes(`ammoLids:${count}`, Array.from({ length: count }, (_, index) => [index * 0.3 + 0.08, 0.2, 0.1, 0.025, 0.05, 0] as const)), FINISH.darkSteel, false)
  lids.position.set(left, bottom, z)
}

// ---------- Control room ----------

const securityDesk = prop((group, materials) => {
  box(group, photo('paint', 0x3a3e44, 0.2), -1.95, 0.04, 3.9, 0.74, 0.75, -1.75)
  box(group, FINISH.black, -1.95, 0, 3.9, 0.06, 0.7, -1.75)
  box(group, materials.wood, -2, 0.78, 4, 0.06, 0.9, -1.72)
  place(group, mergedBoxes('deskStands', [-1.25, 0, 1.25].map((x) => [x - 0.04, 0.84, 0.08, 0.12, 0.06, -2.0] as const)), FINISH.plastic, false)
  const first = pick([0, 4, 8])
  for (const [index, x] of [-1.25, 0, 1.25].entries()) {
    box(group, FINISH.plastic, x - 0.42, 0.94, 0.84, 0.46, 0.05, -2.0)
    quiet(box(group, cctvScreen(first + index), x - 0.39, 0.97, 0.78, 0.4, 0.01, -1.97))
  }
  place(group, mergedBoxes('deskKeyboards', [[-1.5, 0.84, 0.5, 0.025, 0.16, -1.55], [-0.25, 0.84, 0.5, 0.025, 0.16, -1.55], [1.0, 0.84, 0.5, 0.025, 0.16, -1.55]]), FINISH.plastic, false)
  quiet(box(group, matte(0xd8d4c8, 0.6), 0.6, 0.84, 0.22, 0.02, 0.3, -1.5)).rotation.y = 0.2
  quiet(cylinder(group, matte(0xe8e4dc, 0.5), 1.75, 0.84, 0.05, 0.1, -1.45))
  quiet(box(group, glow(0xff3020, 3), -1.85, 0.6, 0.06, 0.06, 0.02, -1.37))
})

const monitorWall = prop((group) => {
  box(group, FINISH.black, -2, -1.75, 4, 1.7, 0.1, 0.06)
  quiet(box(group, cctvWall(), -1.96, -1.71, 3.92, 1.62, 0.01, 0.115))
  place(group, mergedBoxes('monitorBezels', [
    [-2.02, -1.77, 4.04, 0.04, 0.14, 0.07], [-2.02, -0.07, 4.04, 0.04, 0.14, 0.07],
    [-2.02, -1.77, 0.04, 1.74, 0.14, 0.07], [1.98, -1.77, 0.04, 1.74, 0.14, 0.07],
  ]), FINISH.darkSteel, false)
  quiet(box(group, FINISH.darkSteel, -0.6, -1.8, 1.2, 0.05, 0.2, 0.1))
  quiet(rod(group, FINISH.black, 1.6, -1.75, 1.75, -1.8, 0.02, 0.05))
})

const radioStation = prop((group) => {
  const frame = matte(0x2a2e33, 0.5, 0.6)
  box(group, matte(0x3a3632, 0.6), -0.8, 0.72, 1.6, 0.05, 0.75, -1.72)
  place(group, mergedBoxes('radioLegs', [[-0.77, 0, 0.05, 0.72, 0.05, -1.4], [0.72, 0, 0.05, 0.72, 0.05, -1.4], [-0.77, 0, 0.05, 0.72, 0.05, -2.05], [0.72, 0, 0.05, 0.72, 0.05, -2.05], [-0.77, 0.2, 1.54, 0.04, 0.7, -1.72]]), frame)
  box(group, FINISH.black, -0.7, 0.77, 0.8, 0.42, 0.42, -1.85)
  quiet(box(group, radioPanel(), -0.69, 0.79, 0.78, 0.38, 0.01, -1.635))
  // A charging rack of handheld radios.
  box(group, FINISH.plastic, 0.2, 0.77, 0.5, 0.08, 0.2, -1.7)
  place(group, mergedBoxes('handhelds', [0.24, 0.36, 0.48, 0.6].map((x) => [x, 0.85, 0.07, 0.24, 0.05, -1.7] as const)), FINISH.black, false)
  place(group, mergedBoxes('handheldLeds', [0.24, 0.36, 0.48, 0.6].map((x) => [x + 0.02, 0.8, 0.02, 0.02, 0.01, -1.6] as const)), glow(0x39ff6a, 3), false)
  quiet(rod(group, FINISH.black, -0.6, 1.19, -0.6, 1.5, 0.012, -1.95))
  quiet(rod(group, FINISH.black, 0.1, 0.77, 0.05, 0.98, 0.012, -1.5))
  quiet(ball(group, FINISH.black, 0.05, 1.0, 0.035, -1.5))
  quiet(box(group, matte(0xd8d4c8, 0.7), -0.05, 0.77, 0.24, 0.01, 0.3, -1.45))
})

// ---------- Armoury ----------

const weaponRack = prop((group) => {
  const frame = steelGrey()
  box(group, photo('paint', 0x3a4048, 0.3), -1.05, 0.05, 2.1, 2.1, 0.05, -2.15)
  place(group, mergedBoxes('weaponRackFrame', [
    [-1.1, 0, 0.08, 2.2, 0.4, -1.95], [1.02, 0, 0.08, 2.2, 0.4, -1.95],
    [-1.1, 0.12, 2.2, 0.1, 0.4, -1.95], [-1.1, 1.05, 2.2, 0.06, 0.12, -1.85], [-1.1, 1.62, 2.2, 0.05, 0.4, -1.95], [-1.1, 2.12, 2.2, 0.08, 0.4, -1.95],
  ]), frame)
  for (const x of [-0.72, -0.24, 0.24, 0.72]) uprightRifle(group, x, 0.22, -1.95, 0.02)
  ammoCans(group, -0.95, 1.67, 3, -1.95)
  const helmet = ball(group, olive(), 0.65, 1.67, 0.17, -1.95)
  helmet.scale.y = 0.13
})

const ammoLocker = prop((group) => {
  box(group, olive(), -0.7, 0.04, 1.4, 2.12, 0.7, -1.8)
  quiet(box(group, ammoLockerFront(), -0.68, 0.06, 1.36, 2.08, 0.01, -1.445))
  box(group, FINISH.darkSteel, -0.72, 0, 1.44, 0.06, 0.72, -1.8)
  quiet(box(group, FINISH.chrome, -0.06, 0.95, 0.12, 0.05, 0.05, -1.42))
  ammoCans(group, -0.6, 2.16, 2, -1.85)
})

const gunCage = prop((group) => {
  place(group, mergedBoxes('gunCageFrame', [
    ...[-1.5, -0.55, 0.45, 1.44].flatMap((x) => [[x, 0, 0.06, 2.8, 0.06, -0.85], [x, 0, 0.06, 2.8, 0.06, -2.2]] as const),
    [-1.5, 2.74, 3, 0.06, 1.4, -1.52], [-1.5, 0, 3, 0.05, 0.06, -0.85], [-1.5, 1.4, 3, 0.04, 0.05, -0.85],
  ]), steelGrey())
  quiet(box(group, weldedMesh(20, 18), -1.47, 0.03, 2.94, 2.72, 0.01, -0.86))
  // Inside: rifles stood against the back, ammo on a shelf, a crate on the floor.
  for (const x of [-1.1, -0.75]) uprightRifle(group, x, 0.02, -2.05, 0.05)
  place(group, mergedBoxes('gunCageShelf', [[-0.4, 1.2, 1.8, 0.04, 0.55, -1.9], [-0.4, 0, 0.04, 1.2, 0.04, -1.65], [1.36, 0, 0.04, 1.2, 0.04, -1.65]]), FINISH.steel)
  ammoCans(group, -0.3, 1.24, 5, -1.95)
  crate(group, 0.5, 0, 1.4, 0.55, 0.7, -1.85, 'olive')
  quiet(box(group, FINISH.brass, 0.38, 1.3, 0.1, 0.12, 0.05, -0.8))
})

const riotShields = prop((group) => {
  place(group, mergedBoxes('shieldRack', [[-0.8, 0, 1.6, 0.1, 0.5, -1.9], [-0.8, 1.2, 1.6, 0.05, 0.08, -2.05], [-0.8, 0, 0.06, 1.25, 0.08, -2.05], [0.74, 0, 0.06, 1.25, 0.08, -2.05]]), steelGrey())
  for (const [index, x] of [-0.55, -0.2, 0.15, 0.5].entries()) {
    const shield = box(group, shieldMaterial(), x - 0.25, 0.08, 0.5, 1.0, 0.02, -1.75 + index * 0.06)
    shield.rotation.x = -0.12
    shield.castShadow = false
  }
  for (const x of [-0.45, 0.05, 0.5]) {
    const helmet = ball(group, matte(0x1c1e22, 0.35), x, 1.3, 0.16, -2.0)
    helmet.scale.y = 0.15
    quiet(box(group, FINISH.clearGlass, x - 0.14, 1.22, 0.28, 0.1, 0.02, -1.85))
  }
})

// ---------- Checkpoint and barriers ----------

const SANDBAG_PIECES: readonly Piece[] = (() => {
  const bags: Piece[] = []
  for (let course = 0; course < 6; course += 1) {
    const offset = course % 2 ? 0.25 : 0
    for (let index = 0; index < 5; index += 1) {
      const x = -0.96 + offset + index * 0.48 - (course % 2) * 0.24
      if (Math.abs(x) > 1.0) continue
      const y = 0.09 + course * 0.175
      bags.push([x, y, -1.25 - (course % 2) * 0.04, 0.5, 0.2, 0.42, ((index + course) % 3 - 1) * 0.04])
      bags.push([x + 0.12, y, -1.7, 0.5, 0.2, 0.42])
    }
  }
  return bags
})()

/** A stuffed bag: a box with heavily rounded edges. */
const SANDBAG = once('sandbag', () => new RoundedBoxGeometry(1, 1, 1, 2, 0.4))

const sandbags = prop((group) => {
  place(group, mergedPieces('sandbags', SANDBAG, SANDBAG_PIECES), burlap())
})

const barricade = prop((group) => {
  const legs = steelGrey()
  for (const x of [-0.85, 0.85]) {
    rod(group, legs, x, 1.0, x - 0.12, 0, 0.03, -1.15)
    rod(group, legs, x, 1.0, x - 0.12, 0, 0.03, -1.6)
  }
  for (const y of [0.55, 0.85]) box(group, barricadeBoard(), -1.0, y, 2.0, 0.18, 0.04, -1.1)
  quiet(box(group, FINISH.black, -0.1, 1.03, 0.2, 0.08, 0.08, -1.15))
  quiet(cylinder(group, glow(0xffa21a, 4), 0, 1.11, 0.07, 0.09, -1.15))
})

const metalDetector = prop((group) => {
  const shell = matte(0xc6cacc, 0.4)
  for (const x of [-0.6, 0.44]) {
    box(group, shell, x, 0.04, 0.16, 2.16, 0.62, -1.4)
    quiet(box(group, glow(0x39ff6a, 1.6), x + 0.05, 0.4, 0.06, 1.5, 0.01, -1.085))
  }
  box(group, shell, -0.62, 2.2, 1.24, 0.3, 0.66, -1.4)
  quiet(box(group, detectorDisplay(), -0.22, 2.27, 0.44, 0.13, 0.01, -1.065))
  place(group, mergedBoxes('detectorFeet', [[-0.65, 0, 0.26, 0.05, 0.75, -1.4], [0.4, 0, 0.26, 0.05, 0.75, -1.4]]), FINISH.darkSteel, false)
  quiet(box(group, hazardStripes(), -0.6, 0.0, 1.2, 0.012, 0.6, -1.4))
})

// ---------- Cells ----------

const CELL_BARS = mergedBoxes('cellBars', [
  ...Array.from({ length: 14 }, (_, index) => [-0.03, 0.05, 0.06, 3.85, 0.06, -2.3 + index * 0.2] as const),
  [-0.08, 0, 0.16, 0.12, 2.7, -1.0], [-0.08, 3.85, 0.16, 0.15, 2.7, -1.0], [-0.06, 1.9, 0.12, 0.08, 2.7, -1.0],
  [-0.15, 0, 0.3, 4, 0.14, -2.33], [-0.15, 0, 0.3, 4, 0.14, 0.3],
])

const cellBars = prop((group) => {
  place(group, CELL_BARS, photo('paint', 0x3a3e42, 0.6))
})

const cellBench = prop((group) => {
  const steel = photo('paint', 0x7a7e82, 0.6)
  box(group, steel, -1.1, 0.44, 2.2, 0.07, 0.5, -1.95)
  place(group, mergedBoxes('cellBenchLegs', [[-0.95, 0, 0.08, 0.44, 0.4, -1.98], [0.87, 0, 0.08, 0.44, 0.4, -1.98]]), steel)
  box(group, matte(0x5a5e58, 0.95), 0.2, 0.51, 0.6, 0.07, 0.42, -1.95)
  quiet(box(group, matte(0xe8e4dc, 0.9), -0.85, 0.51, 0.12, 0.08, 0.12, -1.85))
})

// ---------- Vault ----------

const depositBoxes = prop((group) => {
  box(group, depositGrid(), -1.5, -2.8, 3, 2.8, 0.3, 0.15)
  place(group, mergedBoxes('depositFrame', [[-1.56, -2.86, 3.12, 0.08, 0.34, 0.17], [-1.56, -0.06, 3.12, 0.08, 0.34, 0.17], [-1.56, -2.86, 0.08, 2.88, 0.34, 0.17], [1.48, -2.86, 0.08, 2.88, 0.34, 0.17]]), FINISH.darkSteel)
  // One box pulled out and one door left open.
  const drawer = pick([0, 1, 2])
  box(group, FINISH.steel, -1.1 + drawer * 0.75, -1.2, 0.36, 0.22, 0.5, 0.45)
  const door = box(group, FINISH.steel, 0.4 - drawer * 0.4, -0.7, 0.36, 0.2, 0.02, 0.4)
  door.rotation.y = -1.1
})

const GOLD_STACK = (key: string, along: number, deep: number, layers: number, bar: readonly [number, number, number]) => mergedPieces(key, FRUSTUM, (() => {
  const bars: Piece[] = []
  for (let layer = 0; layer < layers; layer += 1) {
    const count = Math.max(1, along - Math.floor(layer / 2))
    for (let index = 0; index < count; index += 1) {
      for (let row = 0; row < deep; row += 1) {
        const x = (index - (count - 1) / 2) * bar[0] * 1.08
        bars.push([x, bar[1] * (layer + 0.5), (row - (deep - 1) / 2) * bar[2] * 1.1, bar[0], bar[1], bar[2]])
      }
    }
  }
  return bars
})())

const gold = prop((group) => {
  const stack = place(group, GOLD_STACK('gold', 4, 3, 5, [0.27, 0.1, 0.14]), FINISH.gold)
  stack.position.z = -1.3
})

const goldPallet = prop((group) => {
  pallet(group, 0, -1.4, 1.8)
  const stack = place(group, GOLD_STACK('goldPallet', 6, 5, 7, [0.27, 0.12, 0.17]), FINISH.gold)
  stack.position.set(0, 0.25, -1.4)
  stack.scale.y = 0.98
  for (const x of [-0.5, 0.45]) quiet(box(group, FINISH.black, x, 0.23, 0.04, 0.82, 1.0, -1.4))
})

const cashPallet = prop((group) => {
  pallet(group, 0, -1.4, 1.8)
  stackedBlocks(group, cashFace(), 0, 0.25, 1.66, 0.82, 1.0, -1.4, 3, 2)
  const film = once('cashFilm', () => {
    const material = matte(0xdde6ea, 0.08).clone()
    material.transparent = true
    material.opacity = 0.14
    material.depthWrite = false
    return material
  })
  quiet(box(group, film, -0.86, 0.24, 1.72, 0.86, 1.06, -1.4))
  for (const x of [-0.42, 0.38]) quiet(box(group, matte(0x2a5aa0, 0.6), x, 0.22, 0.04, 0.88, 1.08, -1.4))
})

const vaultShelves = prop((group) => {
  place(group, mergedBoxes('vaultShelfFrame', [
    ...[-1.2, 1.14].flatMap((x) => [[x, 0, 0.06, 2.6, 0.06, -1.25], [x, 0, 0.06, 2.6, 0.06, -2.1]] as const),
    ...[0.08, 0.72, 1.36, 2.0].map((y) => [-1.2, y, 2.4, 0.04, 0.9, -1.68] as const),
  ]), photo('paint', 0x5a6068, 0.6))
  const bars = place(group, GOLD_STACK('vaultGold', 4, 2, 3, [0.24, 0.08, 0.13]), FINISH.gold)
  bars.position.set(-0.5, 0.12, -1.7)
  stackedBlocks(group, cashFace(), 0.55, 0.12, 0.9, 0.36, 0.6, -1.75, 3, 2)
  box(group, matte(0xb8bcc0, 0.3, 0.8), -1.05, 0.76, 0.9, 0.34, 0.6, -1.7)
  box(group, matte(0x24282c, 0.5, 0.3), 0.1, 0.76, 0.8, 0.28, 0.6, -1.7)
  stackedBlocks(group, cashFace(), -0.1, 1.4, 1.6, 0.4, 0.6, -1.75, 4, 2)
  const top = place(group, GOLD_STACK('vaultGoldTop', 3, 2, 2, [0.24, 0.08, 0.13]), FINISH.gold)
  top.position.set(0.5, 2.04, -1.7)
  box(group, matte(0x8a6a44, 0.8), -1.0, 2.04, 0.7, 0.4, 0.55, -1.75)
})

const WHEEL = once('safeWheel', () => new TorusGeometry(1, 0.08, 8, 24))

const safeLarge = prop((group) => {
  const body = photo('paint', 0x34423c, 0.5)
  box(group, FINISH.darkSteel, -0.85, 0, 1.7, 0.1, 0.95, -1.62)
  box(group, body, -0.9, 0.1, 1.8, 2.1, 1.0, -1.62)
  box(group, body, -0.74, 0.26, 1.48, 1.78, 0.06, -1.1)
  place(group, mergedBoxes('safeDoorGap', [[-0.76, 0.24, 1.52, 0.02, 1.01, -1.62], [-0.76, 2.04, 1.52, 0.02, 1.01, -1.62], [-0.76, 0.24, 0.02, 1.82, 1.01, -1.62], [0.74, 0.24, 0.02, 1.82, 1.01, -1.62]]), FINISH.black, false)
  const wheel = new Mesh(WHEEL, FINISH.chrome)
  wheel.scale.setScalar(0.2)
  wheel.position.set(0.1, 1.05, -1.02)
  group.add(wheel)
  for (const angle of [0, Math.PI / 3, (2 * Math.PI) / 3]) {
    quiet(rod(group, FINISH.chrome, 0.1 - Math.cos(angle) * 0.2, 1.05 - Math.sin(angle) * 0.2, 0.1 + Math.cos(angle) * 0.2, 1.05 + Math.sin(angle) * 0.2, 0.015, -1.02))
  }
  quiet(disc(group, FINISH.black, 0.1, 1.5, -1.04, 0.09, 0.04))
  quiet(disc(group, FINISH.chrome, 0.1, 1.5, -1.02, 0.06, 0.02))
  for (const y of [0.55, 1.75]) quiet(cylinder(group, FINISH.darkSteel, -0.78, y, 0.04, 0.22, -1.08))
  quiet(box(group, safePlate(), -0.3, 1.78, 0.6, 0.18, 0.01, -1.065))
})

const keyBox = prop((group) => {
  box(group, steelGrey(), -0.3, -0.7, 0.6, 0.7, 0.1, 0.05)
  quiet(box(group, keyBoard(), -0.26, -0.66, 0.52, 0.6, 0.01, 0.101))
  quiet(box(group, FINISH.clearGlass, -0.27, -0.67, 0.54, 0.64, 0.01, 0.11))
  quiet(box(group, FINISH.brass, 0.2, -0.4, 0.04, 0.06, 0.03, 0.115))
})

export const SECURITY_PROPS: PropSet = {
  securityDesk, monitorWall, radioStation, weaponRack, ammoLocker, gunCage, riotShields, sandbags, barricade, metalDetector,
  cellBars, cellBench, depositBoxes, vaultShelves, gold, goldPallet, cashPallet, safeLarge, keyBox,
}
