import { Group, Mesh, type Material } from 'three'
import type { SurfaceMaterials } from '../levelMesh'
import type { PropSet } from './index'
import { BOX, CYLINDER, TILES_PER_METRE, ball, box, cylinder, glow, matte } from './kit'
import {
  BLACK_PLASTIC, BLANKETS, BRASS, CHROME, COOL_LAMP, DARK_STEEL, DARK_WOOD, ENAMEL, FROSTED, GLASS, GLOSS_BLACK, HEX,
  HOSPITAL_BLUE, INTERIOR_DARK, IRON, LEATHER_BLACK, LEATHER_RED, LED_AMBER, LED_GREEN, LED_RED, LINEN, MATTRESS, NET, PALE_WOOD, PAPER,
  PORCELAIN, RING, RUBBER, STEEL, WARM_LAMP, WARM_WOOD, arcadeMarquee, arcadeScreen, coffeeFront, coolerFront, cupboardFronts, flames,
  hinge, lockerDoors, medicineShelves, mirrorGlass, noShadow, panel, pick, repeated, repeatedPrint, rod, scan, screenPanel, stencil,
  subwayTiles, trayEdges, tvPicture, vendingFront, wallTiles,
} from './livingParts'

/**
 * 3D models for the 'living' props: barracks, bathrooms, kitchens, canteens, rec rooms, gyms, the infirmary and the penthouse.
 * Each matches its catalogue footprint (w across, h tall) and stands with its back near the wall (z about -2.2).
 * Photo-scanned models are used where one fits (iron bed frames, nightstand, chairs, stove, microwave, bottles);
 * the rest are built from shared boxes and cylinders with painted faces for anything that needs a picture.
 */

/** Back face of furniture that stands against the wall. */
const WALL = -2.2
/** Centre depth for something `depth` deep standing against the wall. */
const against = (depth: number): number => WALL + depth / 2

// --- Bedding and the scanned iron bed frame. ---

/** The scanned frame is two metres long; turned side-on it spans this many tiles before stretching. */
const FRAME_LENGTH = 2.002 * TILES_PER_METRE
const FRAME_HEIGHT = 1.201 * TILES_PER_METRE
/** The spring deck sits at this fraction of the frame's height. */
const FRAME_DECK = 0.36

/** Mattress, pillow and a blanket draped over the front. Unmade blankets ride up and leave the sheet showing. */
function bedding(group: Group, left: number, w: number, top: number, z: number, depth: number, blanket: Material, made: boolean): void {
  box(group, MATTRESS, left, top - 0.17, w, 0.17, depth, z)
  box(group, LINEN, left + 0.06, top - 0.01, 0.42, 0.12, depth * 0.7, z - 0.04)
  const start = made ? 0.5 : 0.85
  const cover = box(group, blanket, left + start, top - 0.15, w - start - 0.02, 0.19, depth + 0.05, z + 0.01)
  if (!made) cover.rotation.z = 0.03
}

function ironFrame(group: Group, lift: number, w: number, h: number, z: number): number {
  scan(group, 'old_bed_frame', { turn: Math.PI / 2, z, lift, stretch: [w / FRAME_LENGTH, h / FRAME_HEIGHT, 1] })
  return lift + h * FRAME_DECK
}

function bunkBed(): Group {
  const g = new Group()
  const z = -1.75
  const lowerDeck = ironFrame(g, 0, 2.4, 1.2, z)
  const upperDeck = ironFrame(g, 1.2, 2.4, 1.2, z)
  const look = pick(4)
  bedding(g, -1.1, 2.2, lowerDeck + 0.17, z, 0.74, BLANKETS[look], look !== 2)
  bedding(g, -1.1, 2.2, upperDeck + 0.17, z, 0.74, BLANKETS[(look + 1) % 4], true)
  // A towel hung over the foot rail of the top bunk.
  noShadow(box(g, look % 2 ? LINEN : BLANKETS[2], 0.95, upperDeck + 0.05, 0.12, 0.42, 0.34, z + 0.25))
  return g
}

function bed(): Group {
  const g = new Group()
  const z = -1.7
  const look = pick(3)
  if (look < 2) {
    const deck = ironFrame(g, 0, 2.6, 0.9, z)
    bedding(g, -1.2, 2.4, deck + 0.2, z, 0.8, BLANKETS[look * 3], look === 0)
    return g
  }
  // A plain wooden bed with an upholstered headboard.
  box(g, DARK_WOOD, -1.3, 0.1, 2.6, 0.22, 0.95, z)
  box(g, DARK_WOOD, -1.28, 0, 0.1, 0.1, 0.9, z)
  box(g, DARK_WOOD, 1.18, 0, 0.1, 0.1, 0.9, z)
  box(g, matte(0x3d3a44, 0.9), -1.3, 0.1, 0.14, 0.8, 1.0, z)
  box(g, DARK_WOOD, 1.2, 0.1, 0.1, 0.42, 1.0, z)
  bedding(g, -1.14, 2.32, 0.55, z, 0.9, matte(0x7a6a58, 0.95), true)
  return g
}

// --- Storage. ---

const LOCKER_PAINT = [0x7d8a74, 0x7e8b98, 0xa49a82, 0x6f7d86]

function footlocker(): Group {
  const g = new Group()
  const z = -1.15
  const paint = [0x5d6a48, 0x3d4d66, 0x7a5a3a][pick(3)]
  const body = matte(paint, 0.7, 0.2)
  box(g, body, -0.55, 0, 1.1, 0.44, 0.55, z)
  box(g, body, -0.57, 0.44, 1.14, 0.14, 0.58, z)
  panel(g, stencil(paint), -0.35, 0.12, 0.7, 0.26, z + 0.276)
  for (const y of [0.02, 0.42]) noShadow(box(g, DARK_STEEL, -0.56, y, 1.12, 0.04, 0.565, z))
  noShadow(box(g, BRASS, -0.05, 0.36, 0.1, 0.14, 0.04, z + 0.3))
  for (const x of [-0.6, 0.56]) noShadow(box(g, IRON, x, 0.24, 0.04, 0.06, 0.2, z))
  return g
}

function wallLocker(): Group {
  const g = new Group()
  const z = -1.92
  const paint = LOCKER_PAINT[pick(4)]
  const body = matte(paint, 0.55, 0.35)
  box(g, body, -0.45, 0.1, 0.9, 2.2, 0.55, z)
  box(g, DARK_STEEL, -0.43, 0, 0.86, 0.1, 0.5, z)
  if (pick(4) === 0) {
    // Left open: the dark inside, a hanging jacket and the door swung out.
    box(g, INTERIOR_DARK, -0.4, 0.15, 0.8, 2.1, 0.02, z + 0.27)
    box(g, matte(0x3a4030, 0.9), -0.28, 0.9, 0.5, 0.95, 0.3, z)
    box(hinge(g, -0.43, z + 0.29, -1.9), body, 0, 0.14, 0.86, 2.12, 0.02, 0)
  } else {
    panel(g, lockerDoors(1, paint), -0.43, 0.14, 0.86, 2.12, z + 0.277)
  }
  return g
}

function lockerRow(): Group {
  const g = new Group()
  const z = -1.92
  const paint = LOCKER_PAINT[pick(4)]
  box(g, matte(paint, 0.55, 0.35), -1.5, 0.1, 3, 2.2, 0.55, z)
  box(g, DARK_STEEL, -1.48, 0, 2.96, 0.1, 0.5, z)
  panel(g, lockerDoors(4, paint), -1.48, 0.14, 2.96, 2.12, z + 0.277)
  // Lived in: a padlock on one door, a towel over another, a sticker.
  noShadow(box(g, BRASS, -0.12, 1.05, 0.06, 0.09, 0.03, z + 0.29))
  noShadow(box(g, [LINEN, LEATHER_RED][pick(2)], 0.82, 1.25, 0.32, 0.55, 0.05, z + 0.3))
  noShadow(panel(g, matte(0xd8402a, 0.8), -1.22, 1.62, 0.16, 0.12, z + 0.282))
  return g
}

function bench(): Group {
  const g = new Group()
  const z = -1.2
  const top = matte([0x9a7a56, 0x7a5a3c][pick(2)], 0.7)
  box(g, top, -1.1, 0.36, 2.2, 0.06, 0.18, z - 0.1)
  box(g, top, -1.1, 0.36, 2.2, 0.06, 0.18, z + 0.11)
  for (const x of [-0.85, 0.75]) {
    box(g, DARK_STEEL, x, 0.02, 0.1, 0.34, 0.08, z)
    noShadow(box(g, DARK_STEEL, x - 0.08, 0, 0.26, 0.03, 0.38, z))
  }
  const extra = pick(3)
  if (extra === 0) box(g, BLANKETS[1], 0.1, 0.42, 0.5, 0.06, 0.32, z)
  if (extra === 1) box(g, matte(0x22303f, 0.8), -0.7, 0.42, 0.62, 0.2, 0.3, z)
  return g
}

function nightstand(): Group {
  const g = new Group()
  if (pick(2) === 0) {
    scan(g, 'ClassicNightstand_01', { z: against(0.45), scale: 1.12 })
  } else {
    // A plain steel bedside cabinet, as issued to barracks.
    const z = against(0.5)
    box(g, matte(0x6f7a72, 0.6, 0.3), -0.32, 0.06, 0.64, 0.66, 0.5, z)
    box(g, DARK_STEEL, -0.3, 0, 0.6, 0.06, 0.46, z)
    noShadow(box(g, matte(0x5f6a62, 0.6, 0.3), -0.29, 0.5, 0.58, 0.18, 0.02, z + 0.255))
    noShadow(box(g, CHROME, -0.08, 0.57, 0.16, 0.03, 0.03, z + 0.27))
  }
  // An alarm clock on top.
  const zc = against(0.45)
  box(g, BLACK_PLASTIC, -0.1, 0.72, 0.2, 0.08, 0.08, zc)
  noShadow(box(g, glow(0xff3b30, 2.5), -0.07, 0.735, 0.14, 0.05, 0.005, zc + 0.041))
  return g
}

function wardrobe(materials: SurfaceMaterials): Group {
  const g = new Group()
  const z = against(0.65)
  const wood = pick(2) === 0 ? materials.wood : WARM_WOOD
  box(g, wood, -0.8, 0.08, 1.6, 2.18, 0.65, z)
  box(g, DARK_WOOD, -0.78, 0, 1.56, 0.08, 0.6, z)
  box(g, DARK_WOOD, -0.84, 2.26, 1.68, 0.06, 0.7, z)
  for (const left of [-0.77, 0.01]) {
    box(g, wood, left, 0.14, 0.76, 2.06, 0.03, z + 0.33)
    noShadow(box(g, DARK_WOOD, left + 0.1, 0.3, 0.56, 1.74, 0.01, z + 0.35))
  }
  for (const x of [-0.08, 0.06]) noShadow(box(g, BRASS, x, 1.05, 0.03, 0.22, 0.04, z + 0.37))
  // A battered suitcase stored on top.
  box(g, matte(0x5a3e2c, 0.8), -0.55, 2.32, 0.8, 0.18, 0.5, z)
  return g
}

// --- Bathroom. ---

function showerStall(): Group {
  const g = new Group()
  const back = WALL + 0.02
  const tiles = wallTiles()
  panel(g, tiles, -0.6, 0.12, 1.2, 2.48, back)
  for (const x of [-0.62, 0.58]) box(g, tiles, x, 0.12, 0.04, 2.48, 1.2, -1.6)
  box(g, PORCELAIN, -0.6, 0, 1.2, 0.12, 1.2, -1.6)
  noShadow(box(g, INTERIOR_DARK, -0.06, 0.121, 0.12, 0.004, 0.12, -1.7))
  // Riser pipe, arm and head.
  cylinder(g, CHROME, 0.3, 0.9, 0.025, 1.2, back + 0.06)
  rod(g, CHROME, 0.3, 2.12, back + 0.2, 0.025, 0.3, 'z')
  noShadow(cylinder(g, CHROME, 0.3, 2.06, 0.1, 0.05, back + 0.34))
  noShadow(box(g, CHROME, 0.22, 1.2, 0.16, 0.08, 0.06, back + 0.06))
  // Frosted door in a chrome frame.
  box(g, FROSTED, -0.56, 0.14, 1.12, 2.2, 0.02, -1.0)
  noShadow(box(g, CHROME, -0.6, 2.34, 1.2, 0.05, 0.06, -1.0))
  noShadow(box(g, CHROME, 0.4, 1.0, 0.03, 0.4, 0.05, -0.97))
  return g
}

function sink(): Group {
  const g = new Group()
  const z = -2.0
  panel(g, subwayTiles(), -0.45, 0.6, 0.9, 0.6, WALL + 0.01)
  box(g, PORCELAIN, -0.36, 0.72, 0.72, 0.16, 0.48, z)
  noShadow(box(g, matte(0xa8aaa6, 0.3), -0.3, 0.875, 0.6, 0.01, 0.36, z + 0.02))
  cylinder(g, PORCELAIN, 0, 0, 0.11, 0.73, z - 0.05)
  cylinder(g, CHROME, 0, 0.88, 0.025, 0.14, z - 0.16)
  noShadow(rod(g, CHROME, 0, 1.0, z - 0.09, 0.018, 0.16, 'z'))
  noShadow(box(g, CHROME, -0.2, 0.89, 0.06, 0.05, 0.05, z - 0.16))
  box(g, matte(0xd8d4c8, 0.4), 0.22, 0.98, 0.14, 0.2, 0.08, WALL + 0.05)
  return g
}

/** A toilet pan facing the camera with its cistern against the wall. */
function toiletParts(group: Group, x: number): void {
  const z = -1.85
  box(group, PORCELAIN, x - 0.22, 0.42, 0.44, 0.5, 0.18, WALL + 0.1)
  noShadow(box(group, CHROME, x - 0.06, 0.84, 0.12, 0.05, 0.02, WALL + 0.2))
  const pan = cylinder(group, PORCELAIN, x, 0, 0.17, 0.4, z + 0.1)
  pan.scale.z = 0.24
  const seat = cylinder(group, matte(0xece9e0, 0.35), x, 0.4, 0.2, 0.04, z + 0.12)
  seat.scale.z = 0.27
  noShadow(box(group, matte(0xece9e0, 0.35), x - 0.2, 0.44, 0.4, 0.42, 0.03, WALL + 0.21)).rotation.x = -0.12
}

function toilet(): Group {
  const g = new Group()
  toiletParts(g, 0)
  noShadow(rod(g, CHROME, 0.33, 0.7, WALL + 0.08, 0.012, 0.1, 'z'))
  noShadow(rod(g, PAPER, 0.33, 0.7, WALL + 0.12, 0.06, 0.12, 'x'))
  return g
}

function toiletStall(): Group {
  const g = new Group()
  const laminate = matte([0x6f7d74, 0x8c8577, 0x4f6470][pick(3)], 0.5)
  toiletParts(g, 0)
  for (const x of [-0.7, 0.66]) box(g, laminate, x, 0.15, 0.04, 2.15, 1.5, -1.45)
  noShadow(box(g, CHROME, -0.7, 2.38, 1.4, 0.05, 0.05, -0.68))
  for (const x of [-0.7, 0.66]) noShadow(box(g, CHROME, x, 0, 0.04, 0.15, 0.05, -0.75))
  // The door hangs off the left post, mostly closed; an engaged lock shows red.
  const ajar = pick(3) === 0
  const door = hinge(g, -0.66, -0.7, ajar ? 0.9 : 0.04)
  box(door, laminate, 0, 0.15, 1.3, 2.15, 0.035, 0)
  if (!ajar) noShadow(box(door, LED_RED, 1.16, 1.15, 0.08, 0.04, 0.02, 0.025))
  return g
}

// --- Recreation. ---

function tvStand(): Group {
  const g = new Group()
  const z = against(0.5)
  box(g, DARK_WOOD, -1, 0.06, 2, 0.5, 0.5, z)
  noShadow(box(g, BLACK_PLASTIC, -0.98, 0, 1.96, 0.06, 0.46, z))
  for (const left of [-0.95, 0.35]) noShadow(box(g, WARM_WOOD, left, 0.1, 0.6, 0.42, 0.02, z + 0.25))
  box(g, INTERIOR_DARK, -0.3, 0.1, 0.6, 0.42, 0.02, z + 0.24)
  box(g, BLACK_PLASTIC, -0.25, 0.14, 0.5, 0.1, 0.3, z)
  noShadow(box(g, LED_GREEN, 0.15, 0.17, 0.03, 0.02, 0.01, z + 0.151))
  // Flat screen on a pedestal.
  box(g, BLACK_PLASTIC, -0.2, 0.56, 0.4, 0.03, 0.25, z)
  box(g, BLACK_PLASTIC, -0.04, 0.58, 0.08, 0.2, 0.05, z - 0.05)
  box(g, BLACK_PLASTIC, -0.76, 0.72, 1.52, 0.88, 0.06, z - 0.02)
  panel(g, tvPicture(pick(2) as 0 | 1), -0.72, 0.76, 1.44, 0.8, z + 0.011)
  return g
}

function poolTable(): Group {
  const g = new Group()
  const z = -1.45
  const wood = [DARK_WOOD, WARM_WOOD][pick(2)]
  box(g, wood, -1.55, 0.5, 3.1, 0.2, 1.3, z)
  box(g, wood, -1.6, 0.66, 3.2, 0.1, 1.42, z)
  box(g, matte(0x1f5a3a, 0.95), -1.5, 0.7, 3.0, 0.07, 1.22, z)
  repeated(g, CYLINDER, wood, [[-1.4, 0.25, z + 0.5, 0.09, 0.5, 0.09], [1.4, 0.25, z + 0.5, 0.09, 0.5, 0.09], [-1.4, 0.25, z - 0.5, 0.09, 0.5, 0.09], [1.4, 0.25, z - 0.5, 0.09, 0.5, 0.09]])
  for (const x of [-1.58, -0.04, 1.5]) noShadow(box(g, INTERIOR_DARK, x, 0.64, 0.08, 0.1, 0.02, z + 0.71))
  const balls = [[0.6, 0x9a1a1a], [0.68, 0xd0a020], [0.64, 0x1a3a8a], [-0.8, 0xe8e4d8]] as const
  for (const [x, colour] of balls) ball(g, matte(colour, 0.25), x, 0.81, 0.045, z + (x > 0 ? (x - 0.64) * 3 : 0.1))
  // A cue left on the table, poking up off one end.
  const cue = rod(g, PALE_WOOD, 0.1, 0.84, z + 0.35, 0.02, 2.2, 'x')
  cue.rotation.y = 0.06
  cue.rotation.z = Math.PI / 2 + 0.22
  return g
}


function tableTennis(): Group {
  const g = new Group()
  const z = -1.45
  const top = matte(0x1d3f6b, 0.6)
  box(g, top, -1.55, 0.68, 3.1, 0.04, 1.4, z)
  noShadow(box(g, matte(0xe8e8e2, 0.6), -1.55, 0.675, 3.1, 0.05, 0.02, z + 0.705))
  noShadow(box(g, matte(0xe8e8e2, 0.6), -0.01, 0.721, 0.02, 0.002, 1.4, z))
  // Net and its posts.
  box(g, NET, -0.01, 0.72, 0.02, 0.15, 1.5, z)
  noShadow(box(g, LINEN, -0.012, 0.85, 0.024, 0.02, 1.5, z))
  // Folding undercarriage.
  for (const x of [-1.2, 1.1]) {
    box(g, DARK_STEEL, x, 0.06, 0.06, 0.62, 0.06, z + 0.55)
    box(g, DARK_STEEL, x, 0.06, 0.06, 0.62, 0.06, z - 0.55)
  }
  rod(g, DARK_STEEL, 0, 0.3, z + 0.55, 0.025, 2.4, 'x')
  repeated(g, CYLINDER, RUBBER, [[-1.17, 0.04, z + 0.58, 0.05, 0.08, 0.05], [1.13, 0.04, z + 0.58, 0.05, 0.08, 0.05]])
  // Two bats and a ball.
  for (const [x, colour, turn] of [[-0.9, 0xa01a1a, 0.3], [0.7, 0x16161a, -0.5]] as const) {
    const bat = rod(g, matte(colour, 0.6), x, 0.73, z + 0.2, 0.09, 0.015, 'x')
    bat.rotation.set(0, turn, 0)
  }
  ball(g, matte(0xf2efe6, 0.4), 0.3, 0.74, 0.02, z + 0.3)
  return g
}

function arcadeCabinet(): Group {
  const g = new Group()
  const z = against(0.75)
  const front = z + 0.375
  const paint = [0x1a1a22, 0x5a1218, 0x14284a][pick(3)]
  const side = matte(paint, 0.4)
  // Side panels carry the cabinet outline; the front is set back between them.
  for (const x of [-0.5, 0.45]) box(g, side, x, 0, 0.05, 2.3, 0.75, z)
  box(g, BLACK_PLASTIC, -0.45, 0, 0.9, 1.0, 0.6, z - 0.05)
  box(g, matte(0x24242a, 0.4, 0.5), -0.18, 0.3, 0.36, 0.4, 0.02, front - 0.13)
  noShadow(box(g, LED_AMBER, -0.1, 0.55, 0.05, 0.08, 0.01, front - 0.115))
  noShadow(box(g, LED_AMBER, 0.05, 0.55, 0.05, 0.08, 0.01, front - 0.115))
  // Control deck sloping toward the player, with stick and buttons.
  const deck = box(g, matte(0x2a2a30, 0.5), -0.45, 1.0, 0.9, 0.08, 0.36, front - 0.12)
  deck.rotation.x = 0.2
  cylinder(g, BLACK_PLASTIC, -0.22, 1.06, 0.012, 0.12, front - 0.12)
  ball(g, LEATHER_RED, -0.22, 1.19, 0.035, front - 0.12)
  noShadow(box(g, glow(0x00e5ff, 2.5), 0.02, 1.08, 0.28, 0.025, 0.06, front - 0.1))
  // Screen in a tilted bezel, then the lit marquee.
  const bezel = box(g, BLACK_PLASTIC, -0.45, 1.12, 0.9, 0.7, 0.05, front - 0.3)
  bezel.rotation.x = -0.18
  const screen = panel(g, arcadeScreen(), -0.36, 1.2, 0.72, 0.56, front - 0.27)
  screen.rotation.x = -0.18
  box(g, BLACK_PLASTIC, -0.45, 1.82, 0.9, 0.48, 0.6, z - 0.08)
  panel(g, arcadeMarquee(), -0.44, 1.92, 0.88, 0.3, z + 0.225)
  return g
}

function vendingMachine(): Group {
  const g = new Group()
  const z = against(0.85)
  const brand = pick(2) as 0 | 1
  const body = matte(brand === 0 ? 0x8a1a1e : 0x1e3a6a, 0.45, 0.3)
  box(g, body, -0.65, 0.08, 1.3, 2.42, 0.85, z)
  box(g, DARK_STEEL, -0.63, 0, 1.26, 0.08, 0.8, z)
  panel(g, vendingFront(brand), -0.6, 0.14, 1.2, 2.3, z + 0.426)
  noShadow(box(g, GLASS, -0.57, 0.62, 0.93, 1.58, 0.02, z + 0.44))
  return g
}

function fridge(): Group {
  const g = new Group()
  const z = against(0.8)
  if (pick(3) === 0) {
    // A glass-door drinks cooler.
    const shell = matte(0x1b1d22, 0.45, 0.4)
    box(g, shell, -0.55, 0.1, 1.1, 2.3, 0.8, z)
    box(g, DARK_STEEL, -0.53, 0, 1.06, 0.1, 0.76, z)
    panel(g, coolerFront(), -0.48, 0.2, 0.96, 1.8, z + 0.401)
    noShadow(box(g, GLASS, -0.48, 0.2, 0.96, 1.8, 0.02, z + 0.42))
    panel(g, glow(0x00b8ff, 1.6), -0.48, 2.06, 0.96, 0.24, z + 0.401)
    noShadow(box(g, CHROME, 0.4, 0.8, 0.04, 0.7, 0.05, z + 0.45))
    return g
  }
  const finish = pick(2) === 0 ? matte(0xa8acae, 0.32, 0.8) : matte(0xd8d3c4, 0.4)
  box(g, finish, -0.55, 0.08, 1.1, 2.32, 0.75, z)
  box(g, DARK_STEEL, -0.53, 0, 1.06, 0.08, 0.7, z)
  noShadow(box(g, INTERIOR_DARK, -0.55, 1.62, 1.1, 0.02, 0.01, z + 0.376))
  for (const [bottom, h] of [[1.7, 0.45], [0.8, 0.7]] as const) noShadow(box(g, CHROME, 0.38, bottom, 0.05, h, 0.05, z + 0.4))
  // Notes and a takeaway menu under magnets.
  noShadow(panel(g, PAPER, -0.35, 1.15, 0.22, 0.3, z + 0.377)).rotation.z = 0.06
  noShadow(panel(g, matte(0xe0c040, 0.9), -0.05, 1.3, 0.16, 0.16, z + 0.377))
  noShadow(panel(g, matte(0xc8402a, 0.9), -0.3, 1.9, 0.2, 0.26, z + 0.377)).rotation.z = -0.05
  return g
}

// --- Kitchen and canteen. ---

function kitchenCounter(): Group {
  const g = new Group()
  const z = against(0.65)
  const paint = [0xc8c4b8, 0x8a9a88, 0x6a7480][pick(3)]
  box(g, matte(paint, 0.6), -1.5, 0.1, 3, 0.68, 0.6, z - 0.02)
  noShadow(box(g, BLACK_PLASTIC, -1.48, 0, 2.96, 0.1, 0.54, z - 0.04))
  panel(g, cupboardFronts(paint), -1.48, 0.12, 2.96, 0.64, z + 0.281)
  box(g, matte(0x3a3a3c, 0.35), -1.52, 0.78, 3.04, 0.05, 0.66, z)
  panel(g, subwayTiles(), -1.5, 0.83, 3, 0.37, WALL + 0.01)
  // Sink and tap at one end, a microwave and a kettle at the other.
  noShadow(box(g, STEEL, 0.25, 0.8, 0.6, 0.035, 0.42, z))
  cylinder(g, CHROME, 0.55, 0.83, 0.022, 0.24, z - 0.18)
  noShadow(rod(g, CHROME, 0.55, 1.06, z - 0.08, 0.016, 0.2, 'z'))
  scan(g, 'vintage_microwave', { x: -0.85, z: z - 0.05, lift: 0.83, scale: 0.6 })
  cylinder(g, matte(0xd8d4cc, 0.4), -0.2, 0.83, 0.08, 0.2, z)
  return g
}

function stove(): Group {
  const g = new Group()
  const z = against(0.75)
  if (pick(3) === 0) {
    // A domestic cooker between two bits of worktop.
    scan(g, 'electric_stove', { z: z - 0.02, scale: 1.18 })
    for (const left of [-0.7, 0.3]) {
      box(g, matte(0xb8b2a2, 0.6), left, 0, 0.4, 0.78, 0.6, z - 0.05)
      box(g, matte(0x3a3a3c, 0.35), left - 0.01, 0.78, 0.42, 0.05, 0.65, z)
    }
    cylinder(g, STEEL, -0.12, 0.93, 0.13, 0.17, z + 0.05)
    panel(g, subwayTiles(), -0.7, 0.83, 1.4, 0.37, WALL + 0.01)
    return g
  }
  // A commercial range: two ovens, a knob rail, burners with pans and a splash shelf.
  box(g, STEEL, -0.7, 0.1, 1.4, 0.78, 0.75, z)
  noShadow(box(g, DARK_STEEL, -0.68, 0, 1.36, 0.1, 0.7, z))
  for (const left of [-0.64, 0.04]) {
    noShadow(box(g, matte(0x7d848b, 0.35, 0.8), left, 0.16, 0.6, 0.5, 0.02, z + 0.38))
    noShadow(box(g, INTERIOR_DARK, left + 0.1, 0.3, 0.4, 0.22, 0.01, z + 0.395))
    noShadow(rod(g, CHROME, left + 0.3, 0.6, z + 0.43, 0.015, 0.5, 'x'))
  }
  noShadow(box(g, DARK_STEEL, -0.7, 0.7, 1.4, 0.12, 0.04, z + 0.38))
  repeated(g, CYLINDER, BLACK_PLASTIC, [-0.55, -0.33, -0.11, 0.11, 0.33, 0.55].map((x) => [x, 0.76, z + 0.41, 0.035, 0.04, 0.035, Math.PI / 2]))
  box(g, IRON, -0.68, 0.88, 1.36, 0.05, 0.7, z)
  cylinder(g, STEEL, -0.35, 0.93, 0.2, 0.22, z + 0.05)
  cylinder(g, DARK_STEEL, 0.32, 0.93, 0.18, 0.08, z)
  rod(g, DARK_STEEL, 0.62, 0.98, z, 0.015, 0.3, 'x')
  box(g, STEEL, -0.7, 0.93, 1.4, 0.27, 0.04, WALL + 0.03)
  return g
}

function servingCounter(): Group {
  const g = new Group()
  const z = -1.6
  box(g, STEEL, -2.5, 0.1, 5, 0.78, 0.9, z)
  noShadow(box(g, DARK_STEEL, -2.48, 0, 4.96, 0.1, 0.85, z))
  panel(g, repeatedPrint('cupboards', cupboardFronts(0xa8b0b6), 2), -2.45, 0.14, 4.9, 0.7, z + 0.451)
  box(g, matte(0xb0b6bb, 0.3, 0.85), -2.52, 0.88, 5.04, 0.05, 0.95, z)
  // Food pans in the hot wells.
  const food = [0xb8622a, 0x6a8a3a, 0xd8b850, 0x6a3a22, 0xc8c0a8]
  repeated(g, BOX, STEEL, food.map((_, i) => [-1.9 + i * 0.95, 0.94, z, 0.82, 0.04, 0.5]))
  food.forEach((colour, i) => noShadow(box(g, matte(colour, 0.85), -2.28 + i * 0.95, 0.935, 0.76, 0.05, 0.44, z)))
  // Sneeze guard on posts, with a warm heat lamp under its lid.
  for (const x of [-2.4, 0, 2.36]) noShadow(box(g, CHROME, x, 0.93, 0.04, 0.37, 0.04, z + 0.25))
  const guard = box(g, GLASS, -2.45, 1.0, 4.9, 0.32, 0.02, z + 0.33)
  guard.rotation.x = -0.35
  box(g, STEEL, -2.45, 1.26, 4.9, 0.04, 0.4, z + 0.12)
  noShadow(box(g, WARM_LAMP, -2.4, 1.245, 4.8, 0.015, 0.25, z + 0.12))
  // Tray slide along the customer side.
  rod(g, CHROME, 0, 0.82, z + 0.6, 0.02, 5, 'x')
  return g
}


function cafeteriaTable(): Group {
  const g = new Group()
  const z = -1.5
  box(g, matte(0xc8c6be, 0.45), -1.55, 0.66, 3.1, 0.05, 0.85, z)
  noShadow(box(g, STEEL, -1.56, 0.64, 3.12, 0.03, 0.87, z))
  for (const x of [-1.05, 0.95]) {
    box(g, DARK_STEEL, x, 0.04, 0.1, 0.6, 0.1, z)
    noShadow(box(g, DARK_STEEL, x - 0.04, 0, 0.18, 0.04, 0.7, z))
  }
  const chair = pick(2) === 0 ? 'plastic_monobloc_chair_01' : 'dining_chair_02'
  const scale = chair === 'dining_chair_02' ? 1.05 : 1.12
  for (const x of [-0.9, 0, 0.9]) scan(g, chair, { x, z: z - 0.5, scale, turn: chair === 'dining_chair_02' ? 0 : Math.PI / 2 })
  // Trays with a meal and a cup.
  for (const x of [-0.75, 0.5]) {
    noShadow(box(g, matte(0xa5521e, 0.5), x, 0.71, 0.45, 0.02, 0.32, z + 0.1))
    noShadow(cylinder(g, matte(0xe8e2d4, 0.5), x + 0.33, 0.73, 0.04, 0.1, z + 0.12))
  }
  return g
}

function trayRack(): Group {
  const g = new Group()
  const z = -1.6
  for (const x of [-0.5, 0.45]) box(g, CHROME, x, 0.08, 0.05, 1.82, 0.6, z)
  box(g, CHROME, -0.5, 1.84, 1.0, 0.04, 0.6, z)
  box(g, CHROME, -0.5, 0.1, 1.0, 0.04, 0.6, z)
  panel(g, trayEdges(), -0.45, 0.2, 0.9, 1.6, z + 0.28)
  panel(g, trayEdges(), -0.45, 0.2, 0.9, 1.6, z - 0.28)
  repeated(g, CYLINDER, RUBBER, [[-0.45, 0.04, z + 0.25, 0.05, 0.03, 0.04, Math.PI / 2], [0.45, 0.04, z + 0.25, 0.05, 0.03, 0.04, Math.PI / 2], [-0.45, 0.04, z - 0.25, 0.05, 0.03, 0.04, Math.PI / 2], [0.45, 0.04, z - 0.25, 0.05, 0.03, 0.04, Math.PI / 2]])
  return g
}

function coffeeMachine(): Group {
  const g = new Group()
  const z = against(0.7)
  box(g, matte(0x24201e, 0.4, 0.3), -0.4, 0.06, 0.8, 1.54, 0.7, z)
  noShadow(box(g, DARK_STEEL, -0.38, 0, 0.76, 0.06, 0.66, z))
  panel(g, coffeeFront(), -0.36, 0.72, 0.72, 0.82, z + 0.351)
  box(g, INTERIOR_DARK, -0.2, 0.32, 0.4, 0.34, 0.02, z + 0.345)
  noShadow(cylinder(g, matte(0xe8e2d4, 0.5), 0, 0.36, 0.05, 0.12, z + 0.3))
  noShadow(box(g, STEEL, -0.2, 0.3, 0.4, 0.04, 0.1, z + 0.36))
  return g
}

// --- Gym. ---

function treadmill(): Group {
  const g = new Group()
  const z = -1.45
  // Deck and belt run the length of the machine, motor hood at the right.
  box(g, matte(0x2a2c30, 0.5), -1.0, 0.05, 1.9, 0.14, 0.75, z)
  noShadow(box(g, RUBBER, -0.95, 0.19, 1.6, 0.03, 0.6, z))
  box(g, matte(0x3a3d42, 0.4, 0.4), 0.55, 0.05, 0.45, 0.24, 0.8, z)
  // Uprights, handrails and console.
  for (const side of [0.36, -0.36]) {
    const post = box(g, matte(0x9aa0a6, 0.35, 0.7), 0.7, 0.2, 0.07, 1.1, 0.07, z + side)
    post.rotation.z = 0.18
    rod(g, BLACK_PLASTIC, 0.35, 1.08, z + side, 0.03, 0.75, 'x')
  }
  const head = box(g, BLACK_PLASTIC, 0.48, 1.24, 0.42, 0.26, 0.7, z)
  head.rotation.z = 0.5
  const screen = noShadow(panel(g, glow(0x6ad0ff, 1.8), 0.47, 1.31, 0.18, 0.1, z + 0.36))
  screen.rotation.z = 0.5
  return g
}

function weightRack(): Group {
  const g = new Group()
  const z = -1.65
  // Two sloped shelves on A-frame ends, loaded with hex dumbbells seen end-on.
  for (const x of [-0.98, 0.9]) {
    box(g, DARK_STEEL, x, 0, 0.08, 1.05, 0.08, z + 0.25)
    box(g, DARK_STEEL, x, 0, 0.08, 1.05, 0.08, z - 0.25)
    noShadow(box(g, DARK_STEEL, x, 0, 0.08, 0.05, 0.75, z))
  }
  for (const [y, zs] of [[0.42, z + 0.2], [0.85, z - 0.1]] as const) box(g, matte(0x3a3e44, 0.5, 0.6), -1, y, 2, 0.05, 0.42, zs)
  const bells: number[][] = []
  for (let i = 0; i < 7; i++) bells.push([-0.82 + i * 0.27, 0.54, z + 0.22, 0.1 + i * 0.006, 0.5, 0.1 + i * 0.006, Math.PI / 2])
  for (let i = 0; i < 8; i++) bells.push([-0.84 + i * 0.24, 0.95, z - 0.08, 0.07 + i * 0.004, 0.42, 0.07 + i * 0.004, Math.PI / 2])
  repeated(g, HEX, IRON, bells)
  return g
}

function benchPress(): Group {
  const g = new Group()
  const z = -1.45
  // Padded bench along the room, uprights at the head end, the bar across them with plates facing out.
  box(g, LEATHER_BLACK, -0.85, 0.36, 1.25, 0.1, 0.32, z)
  box(g, DARK_STEEL, -0.6, 0.05, 0.08, 0.31, 0.08, z)
  box(g, DARK_STEEL, 0.15, 0.05, 0.08, 0.31, 0.08, z)
  box(g, DARK_STEEL, -0.9, 0, 1.4, 0.05, 0.12, z)
  for (const side of [-0.45, 0.45]) {
    box(g, DARK_STEEL, 0.5, 0, 0.07, 1.12, 0.07, z + side)
    noShadow(box(g, DARK_STEEL, 0.45, 0, 0.2, 0.05, 0.4, z + side))
  }
  rod(g, CHROME, 0.54, 1.08, z, 0.02, 1.6, 'z')
  repeated(g, CYLINDER, matte(0x1a1c1f, 0.6, 0.3), [[0.54, 1.08, z + 0.6, 0.22, 0.05, 0.22, Math.PI / 2], [0.54, 1.08, z + 0.66, 0.17, 0.04, 0.17, Math.PI / 2], [0.54, 1.08, z - 0.6, 0.22, 0.05, 0.22, Math.PI / 2]])
  // A pair of dumbbells left on the floor.
  repeated(g, HEX, IRON, [[-0.3, 0.07, z + 0.55, 0.07, 0.3, 0.07, Math.PI / 2], [0.1, 0.07, z + 0.55, 0.07, 0.3, 0.07, Math.PI / 2]])
  return g
}

function punchingBag(): Group {
  const g = new Group()
  const z = -0.5
  const leather = [LEATHER_RED, LEATHER_BLACK, matte(0x2a3a5a, 0.5)][pick(3)]
  cylinder(g, IRON, 0, -0.55, 0.012, 0.55, z)
  noShadow(cylinder(g, IRON, 0, -0.62, 0.2, 0.06, z))
  cylinder(g, leather, 0, -1.78, 0.27, 1.16, z)
  noShadow(cylinder(g, LEATHER_BLACK, 0, -1.8, 0.255, 0.04, z))
  for (const y of [-0.85, -1.5]) noShadow(cylinder(g, BLACK_PLASTIC, 0, y, 0.274, 0.025, z))
  return g
}

// --- Infirmary. ---

function medicalBed(): Group {
  const g = new Group()
  const z = -1.55
  const panelColour = matte(0xc8ccc8, 0.5)
  box(g, STEEL, -1.1, 0.18, 2.2, 0.1, 0.85, z)
  box(g, DARK_STEEL, -0.9, 0.08, 1.8, 0.1, 0.4, z)
  repeated(g, CYLINDER, RUBBER, [[-1.0, 0.06, z + 0.38, 0.06, 0.04, 0.06, Math.PI / 2], [1.0, 0.06, z + 0.38, 0.06, 0.04, 0.06, Math.PI / 2], [-1.0, 0.06, z - 0.38, 0.06, 0.04, 0.06, Math.PI / 2], [1.0, 0.06, z - 0.38, 0.06, 0.04, 0.06, Math.PI / 2]])
  box(g, panelColour, -1.2, 0.18, 0.08, 0.92, 0.9, z)
  box(g, panelColour, 1.12, 0.18, 0.08, 0.62, 0.9, z)
  // Mattress, back rest raised at the head end, sheet, pillow and a pale blanket.
  box(g, LINEN, -0.4, 0.28, 1.5, 0.14, 0.8, z)
  const rest = box(g, LINEN, -1.12, 0.36, 0.8, 0.14, 0.8, z)
  rest.rotation.z = -0.38
  box(g, HOSPITAL_BLUE, -0.2, 0.32, 1.3, 0.14, 0.84, z + 0.01)
  const pillow = box(g, matte(0xeceae4, 0.9), -1.08, 0.62, 0.38, 0.12, 0.55, z)
  pillow.rotation.z = -0.38
  noShadow(box(g, CHROME, -0.6, 0.48, 1.2, 0.04, 0.03, z + 0.44))
  noShadow(panel(g, PAPER, 1.15, 0.5, 0.2, 0.26, z + 0.47)).rotation.y = 0.2
  return g
}

function ivStand(): Group {
  const g = new Group()
  const z = -1.3
  for (const turn of [0.5, -0.6]) noShadow(box(g, CHROME, -0.24, 0.04, 0.48, 0.03, 0.04, z)).rotation.y = turn
  repeated(g, CYLINDER, RUBBER, [[-0.21, 0.025, z + 0.1, 0.03, 0.05, 0.03], [0.21, 0.025, z - 0.1, 0.03, 0.05, 0.03], [0.2, 0.025, z + 0.12, 0.03, 0.05, 0.03]])
  cylinder(g, CHROME, 0, 0.05, 0.015, 1.9, z)
  noShadow(box(g, CHROME, -0.18, 1.88, 0.36, 0.02, 0.02, z))
  box(g, matte(0xe6e8d8, 0.15), -0.17, 1.5, 0.12, 0.3, 0.05, z)
  noShadow(box(g, matte(0xd8e0e4, 0.3), -0.115, 0.95, 0.01, 0.55, 0.01, z))
  box(g, matte(0xd8dcd8, 0.5), 0.0, 1.05, 0.16, 0.2, 0.12, z)
  noShadow(box(g, glow(0x7cff9f, 1.8), 0.03, 1.12, 0.1, 0.06, 0.005, z + 0.061))
  return g
}

function medCabinet(): Group {
  const g = new Group()
  const z = against(0.5)
  box(g, ENAMEL, -0.6, 0.06, 1.2, 2.14, 0.5, z)
  noShadow(box(g, DARK_STEEL, -0.58, 0, 1.16, 0.06, 0.46, z))
  panel(g, medicineShelves(), -0.54, 1.0, 1.08, 1.12, z + 0.251)
  noShadow(box(g, GLASS, -0.55, 0.98, 1.1, 1.16, 0.02, z + 0.27))
  noShadow(box(g, ENAMEL, -0.01, 0.98, 0.02, 1.16, 0.03, z + 0.27))
  for (const left of [-0.56, 0.02]) noShadow(box(g, matte(0xc8c6be, 0.4), left, 0.1, 0.54, 0.84, 0.02, z + 0.26))
  for (const x of [-0.08, 0.05]) noShadow(box(g, CHROME, x, 0.6, 0.03, 0.18, 0.03, z + 0.28))
  noShadow(panel(g, matte(0xc8202a, 0.6), -0.33, 0.52, 0.06, 0.2, z + 0.272))
  noShadow(panel(g, matte(0xc8202a, 0.6), -0.4, 0.59, 0.2, 0.06, z + 0.272))
  return g
}

function curtainScreen(): Group {
  const g = new Group()
  // Three hinged panels folded in a shallow zigzag.
  const material = screenPanel()
  const width = 0.62
  for (const [x, turn] of [[-0.6, 0.35], [0, -0.35], [0.6, 0.35]] as const) {
    const leaf = panel(g, material, x - width / 2, 0, width, 2.2, -1.3)
    leaf.rotation.y = turn
  }
  return g
}

// --- Penthouse and bar. ---

function piano(): Group {
  const g = new Group()
  const z = -1.5
  // A grand piano side-on: case, propped lid, legs, keyboard at the left, bench beyond it.
  box(g, GLOSS_BLACK, -0.75, 0.62, 2.0, 0.34, 1.3, z)
  box(g, GLOSS_BLACK, -0.75, 0.6, 2.0, 0.04, 1.32, z)
  // The lid hinges along the far side and is propped up at the near edge, so it rises over the case.
  const lid = new Group()
  lid.position.set(0, 0.97, z - 0.65)
  lid.rotation.x = -0.36
  g.add(lid)
  box(lid, GLOSS_BLACK, -0.72, 0, 1.94, 0.025, 1.28, 0.64)
  cylinder(g, GLOSS_BLACK, 0.3, 0.96, 0.012, 0.42, z + 0.35)
  repeated(g, HEX, GLOSS_BLACK, [[-0.6, 0.3, z + 0.45, 0.06, 0.6, 0.06], [-0.6, 0.3, z - 0.45, 0.06, 0.6, 0.06], [1.1, 0.3, z, 0.06, 0.6, 0.06]])
  box(g, GLOSS_BLACK, -0.98, 0.62, 0.24, 0.14, 1.3, z)
  noShadow(box(g, matte(0xf2efe6, 0.3), -0.97, 0.76, 0.2, 0.025, 1.24, z))
  noShadow(box(g, matte(0x101010, 0.3), -0.9, 0.785, 0.12, 0.02, 1.2, z))
  const desk = box(g, GLOSS_BLACK, -0.8, 0.98, 0.04, 0.3, 1.0, z)
  desk.rotation.z = 0.2
  noShadow(box(g, BRASS, -0.85, 0.02, 0.08, 0.06, 0.25, z))
  box(g, GLOSS_BLACK, -1.3, 0.48, 0.32, 0.08, 0.8, z)
  box(g, GLOSS_BLACK, -1.28, 0, 0.28, 0.48, 0.7, z)
  return g
}

function barCounter(materials: SurfaceMaterials): Group {
  const g = new Group()
  const z = -1.25
  // Back bar: a shelf against the wall carrying bottles.
  box(g, DARK_WOOD, -1.9, 0, 3.8, 1.0, 0.4, against(0.4))
  scan(g, 'wine_bottles_01', { x: -1.0, z: against(0.12), lift: 1.0, scale: 1.3 })
  scan(g, 'wine_bottles_01', { x: 0.7, z: against(0.12), lift: 1.0, scale: 1.3, turn: Math.PI })
  // Front counter.
  box(g, materials.wood, -2, 0.1, 4, 0.8, 0.75, z)
  noShadow(box(g, BLACK_PLASTIC, -1.98, 0, 3.96, 0.1, 0.7, z - 0.02))
  box(g, matte(0x1c1410, 0.25), -2.05, 0.9, 4.1, 0.07, 0.95, z + 0.05)
  rod(g, LEATHER_BLACK, 0, 0.87, z + 0.48, 0.07, 4.05, 'x')
  rod(g, BRASS, 0, 0.18, z + 0.55, 0.025, 3.9, 'x')
  noShadow(panel(g, glow(0xffb000, 1.6), -1.98, 0.85, 3.96, 0.025, z + 0.3755))
  // Beer taps on the bar top.
  box(g, CHROME, -0.3, 0.97, 0.5, 0.06, 0.08, z - 0.1)
  for (const x of [-0.2, 0.0, 0.18]) noShadow(cylinder(g, CHROME, x, 1.03, 0.018, 0.17, z - 0.1))
  return g
}

function barStool(): Group {
  const g = new Group()
  const z = -0.9
  const seat = [LEATHER_RED, LEATHER_BLACK, matte(0x6a4a2a, 0.5)][pick(3)]
  noShadow(cylinder(g, CHROME, 0, 0, 0.22, 0.03, z))
  cylinder(g, CHROME, 0, 0.03, 0.03, 0.66, z)
  const ring = new Mesh(RING, CHROME)
  ring.scale.setScalar(0.16)
  ring.rotation.x = Math.PI / 2
  ring.position.set(0, 0.3, z)
  g.add(ring)
  cylinder(g, seat, 0, 0.69, 0.21, 0.09, z)
  const back = box(g, seat, -0.18, 0.8, 0.36, 0.2, 0.05, z - 0.18)
  back.rotation.x = -0.12
  noShadow(box(g, CHROME, -0.02, 0.76, 0.04, 0.1, 0.03, z - 0.17))
  return g
}

/** Wall mount: the top edge (mantel) is at y = 0 and it reaches down 1.8 to the floor. */
function fireplace(): Group {
  const g = new Group()
  if (pick(2) === 0) {
    // Stone surround with a mantel shelf, sooty firebox, logs and flames.
    const stone = matte(0x8a8378, 0.85)
    box(g, matte(0x5a5148, 0.6), -1.2, -0.12, 2.4, 0.12, 0.42, 0.21)
    for (const left of [-1.12, 0.74]) box(g, stone, left, -1.72, 0.38, 1.6, 0.3, 0.15)
    box(g, stone, -0.74, -0.52, 1.48, 0.4, 0.3, 0.15)
    box(g, matte(0x161210, 0.95), -0.74, -1.72, 1.48, 1.2, 0.04, 0.02)
    panel(g, flames(), -0.66, -1.66, 1.32, 0.66, 0.08)
    for (const [x, turn] of [[-0.2, 0.15], [0.22, -0.2]] as const) rod(g, matte(0x3a2618, 0.9), x, -1.62, 0.16, 0.06, 0.62, 'x').rotation.y = turn
    box(g, matte(0x4a4440, 0.7), -1.2, -1.8, 2.4, 0.08, 0.55, 0.27)
    noShadow(cylinder(g, matte(0xe8e0c8, 0.6), -0.85, 0, 0.04, 0.18, 0.15))
    noShadow(cylinder(g, matte(0xe8e0c8, 0.6), -0.72, 0, 0.04, 0.12, 0.15))
    return g
  }
  // Modern linear gas fire: black glass slot in a dark plaster chimney breast.
  box(g, matte(0x2a2a2c, 0.8), -1.2, -1.8, 2.4, 1.8, 0.25, 0.125)
  box(g, GLOSS_BLACK, -1.0, -1.25, 2.0, 0.5, 0.02, 0.26)
  panel(g, flames(), -0.94, -1.21, 1.88, 0.42, 0.272)
  noShadow(box(g, matte(0x6a6a6a, 0.9), -0.92, -1.23, 1.84, 0.04, 0.05, 0.25))
  box(g, DARK_WOOD, -1.2, -0.12, 2.4, 0.06, 0.35, 0.175)
  return g
}

/** Ceiling mount, placed at z = -0.9: a canopy hood hanging over the stove line, set back toward the wall. */
function rangeHood(): Group {
  const g = new Group()
  const z = -0.6
  box(g, STEEL, -0.3, -0.42, 0.6, 0.42, 0.4, z - 0.15)
  const canopy = box(g, STEEL, -1.0, -0.8, 2.0, 0.38, 0.85, z)
  canopy.scale.z = 0.85
  noShadow(box(g, matte(0x5a6068, 0.5, 0.6), -0.95, -0.81, 1.9, 0.02, 0.75, z))
  for (const x of [-0.6, 0.4]) noShadow(box(g, WARM_LAMP, x, -0.825, 0.2, 0.02, 0.12, z + 0.25))
  noShadow(box(g, DARK_STEEL, -0.95, -0.62, 1.9, 0.02, 0.01, z + 0.43))
  return g
}

/** Wall mount: top edge at y = 0, hanging 1.2 down. */
function mirror(): Group {
  const g = new Group()
  const look = pick(3)
  const frame = [CHROME, BRASS, BLACK_PLASTIC][look]
  box(g, frame, -0.7, -1.2, 1.4, look === 0 ? 1.08 : 1.2, 0.03, 0.015)
  panel(g, mirrorGlass(), -0.65, -1.15, 1.3, look === 0 ? 0.98 : 1.1, 0.031)
  // Bathroom mirrors get a strip light across the top.
  if (look === 0) box(g, COOL_LAMP, -0.6, -0.1, 1.2, 0.07, 0.06, 0.05)
  return g
}

export const LIVING_PROPS: PropSet = {
  bunkBed, bed, footlocker, wallLocker, lockerRow, bench, nightstand, wardrobe,
  showerStall, sink, toilet, toiletStall,
  tvStand, poolTable, tableTennis, arcadeCabinet, vendingMachine, fridge,
  kitchenCounter, stove, servingCounter, cafeteriaTable, trayRack, coffeeMachine,
  treadmill, weightRack, benchPress, punchingBag,
  medicalBed, ivStand, medCabinet, curtainScreen,
  piano, barCounter, barStool, fireplace, rangeHood, mirror,
}
