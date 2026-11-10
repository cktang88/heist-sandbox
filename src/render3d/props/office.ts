import { Group, Mesh, type Material } from 'three'
import type { SurfaceMaterials } from '../levelMesh'
import type { PropSet } from './index'
import { ball, box, cylinder, glow, matte, scanned, TILES_PER_METRE } from './kit'
import {
  bit, C, drawers, FROND, GLASS, keyboard, KIOSK_UI, knob, LOGO, monitor, mug, officeChair, panel, papers, pick,
  plane, PLANE, RUGS, rod, screenMaterial, WATER_BOTTLE, WHITEBOARDS, type ScreenImage,
} from './officeParts'

/**
 * 3D models for the 'office' props. Scanned furniture is used where one fits (desk, filing cabinet,
 * bookshelf, sofa, armchairs, coffee table, plants) and dressed with built parts; the rest is built from
 * the kit's shared shapes. Floor props sit back between z = -2.2 and -0.6, leaving the walking lane clear.
 */

/** Height of the scanned metal desk's top, in tiles. */
const DESK_TOP = 0.788 * TILES_PER_METRE
const SCREENS: ScreenImage[] = ['code', 'sheet', 'cctv']

function desk(): Group {
  const g = new Group()
  const v = pick('desk', 3)
  scanned(g, 'metal_office_desk', { z: -1.75 })
  monitor(g, -0.2, DESK_TOP, -2.0, SCREENS[v], 0.72, 0.44)
  keyboard(g, -0.2, DESK_TOP, -1.55)
  mug(g, 0.38, DESK_TOP, -1.55, [0xd8d2c4, 0x8a2a2a, 0x2a3a5a][v])
  papers(g, 0.62, DESK_TOP, -1.85)
  if (v === 0) scanned(g, 'desk_lamp_arm_01', { x: 0.7, z: -2.0, lift: DESK_TOP, turn: -0.6 })
  else if (v === 1) scanned(g, 'potted_plant_04', { x: -0.75, z: -1.9, lift: DESK_TOP, scale: 1.4 })
  else monitor(g, 0.5, DESK_TOP, -2.02, 'sheet', 0.5, 0.32)
  return g
}

function deskCorner(): Group {
  const g = new Group()
  const v = pick('deskCorner', 2)
  scanned(g, 'metal_office_desk', { x: -0.55, z: -1.75 })
  // The return: a laminate wing that runs from the corner toward the room, on a drawer pedestal.
  const top = C.greyLaminate()
  box(g, top, 0.4, DESK_TOP - 0.04, 1.05, 0.04, 0.86, -1.75)
  box(g, top, 0.9, DESK_TOP - 0.04, 0.55, 0.04, 0.7, -0.97)
  box(g, C.darkSteel(), 0.95, 0, 0.45, DESK_TOP - 0.04, 0.6, -1.0)
  drawers(g, C.steel(), 0.95, 0.04, 0.45, DESK_TOP - 0.1, 3, -0.69)
  box(g, C.darkSteel(), 1.38, 0, 0.05, DESK_TOP - 0.04, 0.7, -1.85)
  monitor(g, -0.85, DESK_TOP, -2.0, SCREENS[v + 1], 0.62, 0.38)
  monitor(g, -0.15, DESK_TOP, -2.02, SCREENS[v], 0.62, 0.38)
  keyboard(g, -0.5, DESK_TOP, -1.55)
  papers(g, 1.12, DESK_TOP, -1.0)
  mug(g, 0.75, DESK_TOP, -1.6)
  return g
}

function executiveDesk(): Group {
  const g = new Group()
  const wood = C.walnut()
  const z = -1.75
  // The visitor's side faces the room: two solid pedestals and a recessed modesty panel with a brass line.
  box(g, wood, -1.5, 0.74, 3, 0.07, 1.0, z)
  box(g, wood, -1.42, 0.02, 0.62, 0.72, 0.9, z)
  box(g, wood, 0.8, 0.02, 0.62, 0.72, 0.9, z)
  box(g, matte(0x3a281e, 0.6), -0.8, 0.12, 1.6, 0.62, 0.05, z - 0.25)
  bit(g, C.brass(), -1.42, 0.62, 2.84, 0.015, 0.02, z + 0.46)
  box(g, C.black(), -1.45, 0, 2.9, 0.03, 0.85, z)
  box(g, C.black(), -0.35, 0.81, 0.6, 0.36, 0.03, z - 0.2)
  bit(g, C.black(), -0.07, 0.81, 0.05, 0.1, 0.05, z - 0.24)
  papers(g, 0.55, 0.81, z + 0.1)
  bit(g, C.brass(), -1.05, 0.81, 0.3, 0.06, 0.05, z + 0.3).rotation.x = -0.4
  scanned(g, 'desk_lamp_arm_01', { x: 1.1, z: z - 0.15, lift: 0.81, scale: 0.6, turn: -0.9 })
  return g
}

function receptionDesk(): Group {
  const g = new Group()
  const v = pick('receptionDesk', 2)
  const face = v === 0 ? C.oak() : matte(0xd6d2c8, 0.5)
  const stone = matte(0xcfc9bd, 0.3)
  // A gently curved counter, faked with an angled panel at each end.
  box(g, face, -1.6, 0.06, 3.2, 1.0, 0.1, -1.0)
  for (const side of [-1, 1]) {
    const wing = box(g, face, -0.45, 0.06, 0.9, 1.0, 0.1, 0)
    wing.position.set(side * 2.02, 0.56, -1.17)
    wing.rotation.y = side * 0.38
    const ledge = box(g, stone, -0.48, 1.06, 0.96, 0.05, 0.3, 0)
    ledge.position.set(side * 2.04, 1.085, -1.12)
    ledge.rotation.y = side * 0.38
  }
  box(g, stone, -1.62, 1.06, 3.24, 0.05, 0.3, -0.98)
  bit(g, glow(0xffd9a0, 3), -1.6, 1.0, 3.2, 0.03, 0.02, -0.94)
  box(g, C.black(), -2.4, 0, 4.8, 0.06, 0.4, -1.1)
  panel(g, C.alu(), -0.45, 0.42, 0.9, 0.3, 0.02, -0.94)
  plane(g, LOGO(), -0.42, 0.44, 0.84, 0.28, -0.925)
  // The work surface behind, with the backs of two monitors showing.
  box(g, C.greyLaminate(), -2.3, 0.66, 4.6, 0.05, 0.7, -1.75)
  box(g, C.black(), -1.3, 0.75, 0.6, 0.4, 0.06, -1.8)
  box(g, C.black(), 0.7, 0.75, 0.6, 0.4, 0.06, -1.8)
  scanned(g, 'potted_plant_04', { x: 1.6, z: -1.0, lift: 1.11, scale: 1.3 })
  return g
}

function officeChairProp(): Group {
  const g = new Group()
  const v = pick('officeChair', 3)
  const fabric = [C.black(), C.fabricBlue(), C.fabricGrey()][v]
  officeChair(g, 0, -1.25, fabric, 1.2, [0.35, -0.5, 2.7][v])
  return g
}

function filingCabinet(): Group {
  const g = new Group()
  const v = pick('filingCabinet', 3)
  scanned(g, 'drawer_cabinet', { z: -1.95 })
  const top = 1.881 * TILES_PER_METRE
  if (v === 0) scanned(g, 'cardboard_box_01', { x: -0.1, z: -1.95, lift: top, scale: 0.9, turn: 1.4 })
  else if (v === 1) {
    for (const [index, colour] of [0x1d3f6e, 0x8a2a2a, 0x2a2c30].entries()) {
      bit(g, matte(colour, 0.6), -0.35 + index * 0.075, top, 0.07, 0.26, 0.26, -1.95).rotation.z = index === 2 ? -0.25 : 0
    }
  } else {
    scanned(g, 'potted_plant_04', { x: 0.25, z: -1.95, lift: top, scale: 1.2 })
    papers(g, -0.2, top, -1.95)
  }
  return g
}

function bookshelf(): Group {
  const g = new Group()
  scanned(g, 'wooden_bookshelf_worn', { z: -1.95, scale: 1.38 })
  return g
}

function printer(): Group {
  const g = new Group()
  const z = -1.75
  const body = C.offWhite()
  box(g, C.fabricGrey(), -0.58, 0.04, 0.84, 0.46, 0.66, z)
  drawers(g, body, -0.58, 0.06, 0.84, 0.42, 2, z + 0.34)
  box(g, body, -0.6, 0.5, 0.88, 0.55, 0.7, z)
  box(g, C.black(), -0.5, 0.72, 0.68, 0.12, 0.05, z + 0.34)
  bit(g, C.paper(), -0.45, 0.76, 0.5, 0.02, 0.3, z + 0.2)
  box(g, matte(0x9b978e, 0.5), -0.6, 1.05, 0.88, 0.1, 0.68, z)
  box(g, body, -0.5, 1.15, 0.68, 0.1, 0.5, z - 0.05)
  const deck = box(g, C.black(), 0.02, 1.0, 0.28, 0.05, 0.22, z + 0.38)
  deck.rotation.x = 0.5
  plane(g, glow(0x3ab8ff, 1.6), 0.06, 1.0, 0.14, 0.08, z + 0.5).rotation.x = -1.07
  // A finisher on the right with sheets waiting in its tray.
  box(g, body, 0.28, 0.3, 0.3, 0.62, 0.5, z)
  bit(g, C.paper(), 0.3, 0.92, 0.3, 0.03, 0.34, z)
  bit(g, C.ledGreen(), -0.52, 0.98, 0.03, 0.03, 0.02, z + 0.36)
  return g
}

function waterCooler(): Group {
  const g = new Group()
  const z = -1.95
  const shell = C.offWhite()
  box(g, shell, -0.18, 0, 0.36, 1.0, 0.34, z)
  box(g, C.black(), -0.13, 0.55, 0.26, 0.24, 0.03, z + 0.165)
  bit(g, C.ledBlue(), -0.08, 0.72, 0.04, 0.05, 0.05, z + 0.19)
  bit(g, glow(0xff5040, 2), 0.04, 0.72, 0.04, 0.05, 0.05, z + 0.19)
  bit(g, C.steel(), -0.12, 0.55, 0.24, 0.03, 0.12, z + 0.2)
  cylinder(g, WATER_BOTTLE(), 0, 1.0, 0.15, 0.04, z).castShadow = false
  cylinder(g, WATER_BOTTLE(), 0, 1.07, 0.15, 0.4, z).castShadow = false
  ball(g, WATER_BOTTLE(), 0, 1.47, 0.15, z).scale.set(0.15, 0.08, 0.15)
  cylinder(g, C.alu(), 0.27, 0.55, 0.04, 0.42, z + 0.05)
  return g
}

function plant(): Group {
  const g = new Group()
  const v = pick('plant', 2)
  const pot = v === 0 ? matte(0x2f3134, 0.6) : C.concretePot()
  box(g, pot, -0.24, 0, 0.48, 0.5, 0.48, -1.6)
  bit(g, C.soil(), -0.21, 0.5, 0.42, 0.01, 0.42, -1.6)
  scanned(g, 'potted_plant_02', { z: -1.55, lift: 0.36, scale: 1.4, turn: v * 2.1 })
  return g
}

function plantTall(): Group {
  const g = new Group()
  const v = pick('plantTall', 2)
  const z = -1.7
  cylinder(g, v === 0 ? C.concretePot() : C.terracotta(), 0, 0, 0.26, 0.55, z)
  bit(g, C.soil(), -0.2, 0.55, 0.4, 0.01, 0.4, z)
  const trunk = matte(0x5a4632, 0.9)
  const stems: [number, number, number][] = [[-0.05, 1.75, -0.08], [0.06, 1.45, 0.1]]
  for (const [x, top, lean] of stems) {
    const stem = cylinder(g, trunk, x, 0.5, 0.035, top - 0.5, z)
    stem.rotation.z = lean
  }
  // Fronds fan out from the crown of each stem and droop at the tips.
  const fronds = 9
  for (let index = 0; index < fronds; index += 1) {
    const [x, top, lean] = stems[index % 2]
    const holder = new Group()
    holder.position.set(x - Math.sin(lean) * (top - 0.5), top, z)
    holder.rotation.y = (index / fronds) * Math.PI * 2 + v
    const leaf = new Mesh(PLANE, FROND())
    leaf.scale.set(0.75, 0.38, 1)
    leaf.position.set(0.36, -0.08, 0)
    leaf.rotation.set(-Math.PI / 2 + 0.5, 0, -0.35)
    leaf.castShadow = true
    holder.add(leaf)
    g.add(holder)
  }
  return g
}

function sofa(): Group {
  const g = new Group()
  const v = pick('sofa', 3)
  scanned(g, 'sofa_02', { z: -1.6, scale: 1.75 })
  const cushion = [matte(0x8a6a2e, 0.95), C.fabricRust(), matte(0x2f5a5a, 0.95)][v]
  const a = box(g, cushion, -0.18, 0, 0.36, 0.34, 0.12, 0)
  a.position.set(-1.0, 0.72, -1.75)
  a.rotation.set(-0.3, 0.3, 0.15)
  if (v !== 1) {
    const b = box(g, cushion, -0.16, 0, 0.32, 0.3, 0.11, 0)
    b.position.set(1.05, 0.7, -1.75)
    b.rotation.set(-0.3, -0.25, -0.2)
  }
  return g
}

function armchair(): Group {
  const g = new Group()
  const v = pick('armchair', 2)
  if (v === 0) scanned(g, 'ArmChair_01', { z: -1.5, scale: 1.12, turn: 0.45 })
  else scanned(g, 'modern_arm_chair_01', { z: -1.45, scale: 1.15, turn: -0.45 })
  return g
}

function coffeeTable(): Group {
  const g = new Group()
  const v = pick('coffeeTable', 2)
  scanned(g, 'CoffeeTable_01', { z: -1.35, scale: 1.15 })
  const top = 0.523 * TILES_PER_METRE * 1.15
  bit(g, matte(0x9a2f2a, 0.7), -0.5, top, 0.28, 0.012, 0.2, -1.3).rotation.y = 0.3
  bit(g, matte(0x2a4a6a, 0.7), -0.45, top + 0.012, 0.26, 0.012, 0.19, -1.32).rotation.y = -0.15
  mug(g, 0.3, top, -1.2)
  if (v === 1) scanned(g, 'potted_plant_04', { x: 0.1, z: -1.45, lift: top, scale: 1.2 })
  return g
}

function conferenceTable(materials: SurfaceMaterials): Group {
  const g = new Group()
  const z = -1.5
  // Chair backs behind the table, seen above its top; the modesty panel hides their bases.
  const seat = pick('conferenceTable', 2) === 0 ? C.black() : C.fabricBlue()
  for (let index = 0; index < 5; index += 1) {
    const back = box(g, seat, -0.25 + (index - 2) * 1.12, 0.45, 0.5, 0.55, 0.08, z - 0.6)
    back.rotation.x = -0.1
  }
  box(g, materials.wood, -3, 0.66, 6, 0.06, 1.2, z)
  box(g, C.walnut(), -2.6, 0.3, 5.2, 0.36, 0.04, z + 0.2)
  box(g, C.darkSteel(), -2.0, 0, 0.3, 0.66, 0.55, z)
  box(g, C.darkSteel(), 1.7, 0, 0.3, 0.66, 0.55, z)
  const phone = cylinder(g, C.black(), 0, 0.72, 0.14, 0.04, z)
  phone.castShadow = false
  scanned(g, 'classic_laptop', { x: -1.5, z: z - 0.2, lift: 0.72, scale: 0.8 })
  papers(g, 1.3, 0.72, z)
  cylinder(g, GLASS(), 0.7, 0.72, 0.035, 0.12, z + 0.2).castShadow = false
  cylinder(g, GLASS(), -0.6, 0.72, 0.035, 0.12, z + 0.25).castShadow = false
  return g
}

function partition(): Group {
  const g = new Group()
  const v = pick('partition', 2)
  const z = -1.45
  const fabric = v === 0 ? C.fabricBlue() : C.fabricGrey()
  box(g, fabric, -0.04, 0.06, 0.08, 1.45, 1.5, z)
  box(g, GLASS(), -0.02, 1.51, 0.04, 0.36, 1.5, z).castShadow = false
  box(g, C.alu(), -0.05, 0, 0.1, 1.9, 0.05, z + 0.75)
  box(g, C.alu(), -0.05, 1.86, 0.1, 0.04, 1.55, z)
  bit(g, C.alu(), -0.15, 0, 0.3, 0.04, 0.3, z + 0.6)
  bit(g, C.alu(), -0.15, 0, 0.3, 0.04, 0.3, z - 0.6)
  // Notes pinned to both faces of the fabric.
  bit(g, C.paper(), 0.04, 1.0, 0.004, 0.3, 0.22, z + 0.3)
  bit(g, matte(0xf2e26a, 0.8), 0.04, 1.2, 0.004, 0.08, 0.08, z + 0.05)
  bit(g, C.paperOld(), -0.044, 0.9, 0.004, 0.28, 0.2, z - 0.2)
  return g
}

function turnstile(): Group {
  const g = new Group()
  const z = -1.4
  const cabinet = C.steel()
  for (const side of [-1, 1]) {
    const left = side < 0 ? -0.5 : 0.3
    box(g, cabinet, left, 0, 0.2, 1.0, 1.2, z)
    bit(g, C.black(), left - 0.005, 1.0, 0.21, 0.025, 1.21, z)
    plane(g, glow(0x39ff6a, 2.5), left + 0.04, 1.026, 0.12, 0.16, z + 0.45).rotation.x = -Math.PI / 2
    bit(g, glow(0x19e3ff, 2.5), side < 0 ? -0.302 : 0.296, 0.7, 0.006, 0.02, 1.1, z)
    box(g, GLASS(), side < 0 ? -0.3 : 0.02, 0.38, 0.28, 0.8, 0.02, z).castShadow = false
  }
  return g
}

function kiosk(): Group {
  const g = new Group()
  const z = -1.7
  const shell = pick('kiosk', 2) === 0 ? C.black() : C.offWhite()
  box(g, C.darkSteel(), -0.32, 0, 0.64, 0.06, 0.5, z)
  box(g, shell, -0.3, 0.06, 0.6, 1.44, 0.2, z)
  plane(g, KIOSK_UI(), -0.24, 0.78, 0.48, 0.64, z + 0.101)
  box(g, shell, -0.42, 1.5, 0.84, 0.3, 0.16, z)
  plane(g, LOGO(), -0.38, 1.54, 0.76, 0.24, z + 0.081)
  bit(g, C.plastic(), -0.12, 0.56, 0.24, 0.12, 0.08, z + 0.13)
  bit(g, C.ledGreen(), 0.06, 0.64, 0.03, 0.02, 0.02, z + 0.17)
  bit(g, C.black(), -0.1, 0.42, 0.2, 0.02, 0.04, z + 0.1)
  return g
}

function bin(): Group {
  const g = new Group()
  const v = pick('bin', 3)
  const z = -1.6
  const shell = [C.steel(), matte(0x3d4a3a, 0.6), C.plastic()][v]
  cylinder(g, shell, 0, 0, 0.21, 0.62, z)
  cylinder(g, C.black(), 0, 0.6, 0.225, 0.04, z).castShadow = false
  if (v === 0) ball(g, C.steel(), 0, 0.64, 0.2, z).scale.set(0.2, 0.06, 0.2)
  else {
    ball(g, C.paper(), -0.06, 0.66, 0.07, z + 0.04)
    ball(g, C.paperOld(), 0.07, 0.65, 0.06, z - 0.05)
  }
  return g
}

function cardboardBoxes(): Group {
  const g = new Group()
  const v = pick('cardboardBoxes', 2)
  const z = -1.7
  scanned(g, 'cardboard_box_01', { x: -0.38, z, scale: 1.6, turn: 0.05 })
  scanned(g, 'cardboard_box_01', { x: 0.36, z, scale: 1.6, turn: 1.62 })
  scanned(g, 'cardboard_box_01', { x: v === 0 ? -0.25 : 0.3, z: z + 0.05, lift: 0.49, scale: 1.55, turn: v === 0 ? -0.2 : 1.4 })
  return g
}

function paperStack(): Group {
  const g = new Group()
  const z = -1.5
  box(g, C.cardboard(), -0.28, 0, 0.5, 0.16, 0.36, z)
  const a = bit(g, C.paper(), -0.25, 0.16, 0.44, 0.06, 0.32, z)
  a.rotation.y = 0.1
  const b = bit(g, C.paperOld(), -0.2, 0.22, 0.4, 0.04, 0.3, z)
  b.rotation.y = -0.15
  scanned(g, 'binder_notebook', { x: -0.12, z: z + 0.02, lift: 0.26, turn: 0.2 })
  return g
}

function rug(): Group {
  const g = new Group()
  const mesh = plane(g, RUGS[pick('rug', 2)](), -2, 0, 4, 2.2, -1.2)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = 0.012
  return g
}

function drinksCabinet(): Group {
  const g = new Group()
  const z = -2.0
  const wood = C.walnut()
  box(g, C.black(), -0.72, 0, 1.44, 0.08, 0.46, z)
  box(g, wood, -0.78, 0.08, 1.56, 0.86, 0.5, z)
  bit(g, matte(0x3a281e, 0.5), -0.74, 0.12, 0.72, 0.78, 0.02, z + 0.255)
  bit(g, matte(0x3a281e, 0.5), 0.02, 0.12, 0.72, 0.78, 0.02, z + 0.255)
  bit(g, C.brass(), -0.07, 0.48, 0.04, 0.14, 0.03, z + 0.27)
  bit(g, C.brass(), 0.03, 0.48, 0.04, 0.14, 0.03, z + 0.27)
  box(g, matte(0xd9d4cc, 0.3), -0.8, 0.94, 1.6, 0.04, 0.54, z)
  scanned(g, 'wine_bottles_01', { x: -0.66, z: z - 0.05, lift: 0.98 })
  cylinder(g, matte(0x6a3410, 0.2), 0.35, 0.98, 0.06, 0.18, z).castShadow = false
  cylinder(g, GLASS(), 0.55, 0.98, 0.04, 0.1, z + 0.1).castShadow = false
  // An open shelf above, lit from underneath.
  panel(g, matte(0x2a1e18, 0.6), -0.78, 0.98, 1.56, 0.52, 0.04, z - 0.23)
  box(g, wood, -0.78, 1.28, 1.56, 0.04, 0.22, z - 0.12)
  bit(g, glow(0xffc27a, 3), -0.7, 1.275, 1.4, 0.01, 0.02, z - 0.04)
  return g
}

function trophyCase(): Group {
  const g = new Group()
  const z = -2.0
  const wood = C.walnut()
  box(g, wood, -0.8, 0, 1.6, 0.7, 0.45, z)
  bit(g, matte(0x3a281e, 0.5), -0.76, 0.05, 1.52, 0.6, 0.02, z + 0.23)
  panel(g, matte(0x2a2228, 0.9), -0.78, 0.7, 1.56, 1.4, 0.04, z - 0.2)
  box(g, wood, -0.8, 2.1, 1.6, 0.1, 0.45, z)
  bit(g, glow(0xfff0d0, 3), -0.7, 2.09, 1.4, 0.01, 0.03, z + 0.1)
  box(g, GLASS(), -0.79, 0.7, 1.58, 1.4, 0.01, z + 0.22).castShadow = false
  for (const y of [1.15, 1.6]) bit(g, GLASS(), -0.78, y, 1.56, 0.015, 0.38, z)
  const gold = C.gold()
  cylinder(g, gold, -0.45, 0.7, 0.06, 0.28, z)
  ball(g, gold, -0.45, 1.02, 0.08, z)
  box(g, wood, 0.15, 0.7, 0.2, 0.26, 0.04, z - 0.1)
  cylinder(g, C.silver(), 0.4, 1.165, 0.05, 0.3, z)
  ball(g, gold, -0.2, 1.7, 0.09, z)
  return g
}

function safeSmall(): Group {
  const g = new Group()
  const v = pick('safeSmall', 2)
  const z = -1.75
  const paint = v === 0 ? matte(0x34403a, 0.45, 0.5) : matte(0x2b2e33, 0.4, 0.6)
  box(g, C.black(), -0.43, 0, 0.86, 0.05, 0.76, z)
  box(g, paint, -0.45, 0.05, 0.9, 1.0, 0.8, z)
  box(g, paint, -0.38, 0.13, 0.76, 0.84, 0.04, z + 0.41)
  knob(g, C.chrome(), 0.05, 0.68, 0.09, 0.05, z + 0.45)
  knob(g, C.black(), 0.05, 0.68, 0.05, 0.06, z + 0.47)
  bit(g, C.chrome(), 0.02, 0.38, 0.24, 0.04, 0.05, z + 0.45).rotation.z = -0.3
  bit(g, C.darkSteel(), -0.42, 0.25, 0.05, 0.12, 0.06, z + 0.42)
  bit(g, C.darkSteel(), -0.42, 0.75, 0.05, 0.12, 0.06, z + 0.42)
  bit(g, C.brass(), -0.12, 0.88, 0.24, 0.05, 0.01, z + 0.43)
  return g
}

function coatRack(): Group {
  const g = new Group()
  const v = pick('coatRack', 3)
  const z = -1.9
  const metal = C.darkSteel()
  cylinder(g, metal, 0, 0, 0.22, 0.04, z)
  cylinder(g, metal, 0, 0.04, 0.025, 1.88, z)
  ball(g, metal, 0, 1.93, 0.045, z)
  for (const side of [-1, 1]) bit(g, metal, side < 0 ? -0.2 : 0.02, 1.82, 0.18, 0.025, 0.025, z).rotation.z = side * 0.4
  const coat = [matte(0x6b5a3c, 0.9), C.black(), matte(0x2a3a4a, 0.9)][v]
  const body = box(g, coat, -0.2, 0.95, 0.4, 0.82, 0.16, z + 0.06)
  body.rotation.z = 0.05
  ball(g, coat, 0, 1.75, 0.15, z + 0.06).scale.set(0.2, 0.08, 0.1)
  if (v === 2) {
    cylinder(g, C.black(), 0.24, 1.82, 0.16, 0.02, z + 0.04).rotation.z = 0.15
    cylinder(g, C.black(), 0.24, 1.84, 0.09, 0.1, z + 0.04).rotation.z = 0.15
  } else if (v === 0) {
    const umbrella = cylinder(g, C.black(), 0.24, 0.05, 0.035, 0.9, z + 0.1)
    umbrella.rotation.z = -0.1
  }
  return g
}

function whiteboard(): Group {
  const g = new Group()
  const v = pick('whiteboard', 2)
  box(g, C.alu(), -1.2, -1.3, 2.4, 1.3, 0.03, 0.015).castShadow = false
  plane(g, WHITEBOARDS[v](), -1.17, -1.27, 2.34, 1.24, 0.031)
  bit(g, C.alu(), -0.8, -1.38, 1.6, 0.04, 0.08, 0.04)
  rod(g, matte(0xc0262d, 0.5), -0.6, -1.33, 0.14, 0.012, 0.05)
  rod(g, matte(0x1d3f8f, 0.5), -0.35, -1.33, 0.14, 0.012, 0.06)
  return g
}

function wallScreen(): Group {
  const g = new Group()
  const image: ScreenImage = (['dashboard', 'news', 'cctv'] as const)[pick('wallScreen', 3)]
  panel(g, C.darkSteel(), -0.3, -0.9, 0.6, 0.4, 0.04, 0.02)
  box(g, C.black(), -1.1, -1.25, 2.2, 1.24, 0.045, 0.065).castShadow = false
  plane(g, screenMaterial(image), -1.07, -1.22, 2.14, 1.18, 0.089)
  bit(g, glow(0xff3b30, 2), 0.95, -1.245, 0.02, 0.012, 0.01, 0.09)
  return g
}

function logoSign(): Group {
  const g = new Group()
  const v = pick('logoSign', 2)
  const backing: Material = v === 0 ? matte(0x1c2026, 0.35, 0.7) : C.walnut()
  panel(g, backing, -1.5, -1.2, 3, 1.2, 0.04, 0.02)
  plane(g, LOGO(), -1.4, -1.07, 2.8, 0.93, 0.07)
  for (const x of [-1.38, 1.38]) for (const y of [-0.08, -1.12]) knob(g, C.chrome(), x, y, 0.025, 0.04, 0.05)
  return g
}

function projector(): Group {
  const g = new Group()
  cylinder(g, C.darkSteel(), 0, -0.03, 0.08, 0.03, 0)
  cylinder(g, C.darkSteel(), 0, -0.26, 0.022, 0.24, 0)
  box(g, C.offWhite(), -0.28, -0.4, 0.56, 0.14, 0.4, 0)
  knob(g, C.black(), 0.12, -0.33, 0.06, 0.06, 0.22)
  knob(g, glow(0xcfe8ff, 1.5), 0.12, -0.33, 0.04, 0.02, 0.25)
  bit(g, C.ledBlue(), -0.2, -0.3, 0.02, 0.02, 0.01, 0.2)
  bit(g, C.black(), -0.24, -0.38, 0.2, 0.08, 0.01, 0.2)
  return g
}

export const OFFICE_PROPS: PropSet = {
  desk, deskCorner, executiveDesk, receptionDesk, officeChair: officeChairProp, filingCabinet, bookshelf, printer,
  waterCooler, plant, plantTall, sofa, armchair, coffeeTable, conferenceTable, partition, turnstile, kiosk, bin,
  cardboardBoxes, paperStack, rug, drinksCabinet, trophyCase, safeSmall, coatRack, whiteboard, wallScreen, logoSign,
  projector,
}
