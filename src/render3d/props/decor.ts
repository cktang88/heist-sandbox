import { Group, Mesh } from 'three'
import type { PropSet } from './index'
import { ball, box, cylinder, glow, matte, scanned } from './kit'
import {
  ART, BLINDS, CABLE_TUBES, CITY_VIEW, EXIT_SIGN, GLASS_SHEEN, GRAFFITI, HAZARD, NEON_SIGNS, NOTICE_BOARD, POSTERS, ROOM_PLATES,
  STAINS, TORN_POSTERS,
} from './decorParts'
import { bit, C, knob, panel, pick, plane, rod } from './officeParts'

/**
 * 3D models for the 'decor' props: thin things on the back wall (their top edge at y = 0, built forward
 * from z = 0) and fittings that hang from the ceiling (down from y = 0). Most are one to four meshes.
 */

function poster(): Group {
  const g = new Group()
  const v = pick('poster', POSTERS.length)
  const tilt = [0.02, -0.015, 0, 0.03][v]
  plane(g, POSTERS[v](), -0.46, -1.33, 0.92, 1.29, 0.006).rotation.z = tilt
  return g
}

function posterTorn(): Group {
  const g = new Group()
  const v = pick('posterTorn', TORN_POSTERS.length)
  plane(g, TORN_POSTERS[v](), -0.46, -1.33, 0.92, 1.29, 0.006).rotation.z = -0.03 + v * 0.03
  return g
}

function graffiti(): Group {
  const g = new Group()
  plane(g, GRAFFITI[pick('graffiti', GRAFFITI.length)](), -1.2, -1.4, 2.4, 1.4, 0.004)
  return g
}

function noticeBoard(): Group {
  const g = new Group()
  const frame = C.oak()
  panel(g, frame, -0.8, -1.2, 1.6, 1.2, 0.04, 0.02)
  plane(g, NOTICE_BOARD(), -0.75, -1.15, 1.5, 1.1, 0.041)
  return g
}

function picture(): Group {
  const g = new Group()
  if (pick('picture', 2) === 0) {
    scanned(g, 'fancy_picture_frame_01', { z: 0, lift: -0.5, scale: 2.05 })
  } else {
    panel(g, C.black(), -0.6, -0.95, 1.2, 0.9, 0.03, 0.015)
    plane(g, matte(0xe8e4da, 0.8), -0.54, -0.89, 1.08, 0.78, 0.031)
    plane(g, ART[1](), -0.42, -0.79, 0.84, 0.58, 0.032)
  }
  return g
}

function artLarge(): Group {
  const g = new Group()
  panel(g, matte(0x1c1a18, 0.6), -1.3, -1.6, 2.6, 1.6, 0.05, 0.03)
  plane(g, ART[pick('artLarge', ART.length)](), -1.26, -1.56, 2.52, 1.52, 0.056)
  return g
}

function wallClock(): Group {
  const g = new Group()
  scanned(g, 'wall_clock', { z: 0, lift: -0.3, scale: 2.05 })
  return g
}

function ventGrille(): Group {
  const g = new Group()
  const metal = C.offWhite()
  panel(g, metal, -0.5, -0.6, 1, 0.6, 0.03, 0.015)
  panel(g, C.black(), -0.44, -0.54, 0.88, 0.48, 0.01, 0.031)
  for (let index = 0; index < 5; index += 1) {
    bit(g, metal, -0.44, -0.52 + index * 0.095, 0.88, 0.05, 0.02, 0.04).rotation.x = -0.6
  }
  return g
}

function pipeRun(): Group {
  const g = new Group()
  const v = pick('pipeRun', 2)
  const paint = v === 0 ? matte(0x4b5560, 0.5, 0.6) : matte(0x3a5a7a, 0.55, 0.4)
  rod(g, paint, -3, -0.17, 6, 0.11, 0.14)
  rod(g, matte(0x5a4a3c, 0.7, 0.5), -3, -0.42, 6, 0.06, 0.09)
  for (const x of [-2.4, 0, 2.4]) bit(g, C.darkSteel(), x - 0.04, -0.5, 0.08, 0.5, 0.06, 0.03)
  for (const x of [-1.2, 1.6]) rod(g, paint, x - 0.04, -0.17, 0.08, 0.14, 0.14)
  knob(g, matte(0xb0201c, 0.6), 0.6, -0.17, 0.12, 0.03, 0.29)
  return g
}

function conduitRun(): Group {
  const g = new Group()
  const grey = C.steel()
  rod(g, grey, -2.5, -0.08, 5, 0.025, 0.04)
  rod(g, grey, -2.5, -0.17, 5, 0.025, 0.04)
  rod(g, matte(0x6b6f73, 0.8), -2.5, -0.25, 3.2, 0.03, 0.045)
  box(g, C.darkSteel(), 0.6, -0.3, 0.26, 0.3, 0.08, 0.05)
  bit(g, matte(0xd8a520, 0.6), 0.66, -0.2, 0.14, 0.08, 0.005, 0.092)
  return g
}

function wallAc(): Group {
  const g = new Group()
  const shell = matte(0xdad8d0, 0.45)
  box(g, shell, -0.7, -0.62, 1.4, 0.55, 0.26, 0.13)
  bit(g, C.black(), -0.62, -0.62, 1.24, 0.06, 0.2, 0.17)
  bit(g, matte(0xc4c2ba, 0.5), -0.68, -0.18, 1.36, 0.08, 0.02, 0.265)
  bit(g, C.ledGreen(), 0.52, -0.45, 0.025, 0.012, 0.01, 0.262)
  // The drip stain down the wall under the unit's outlet.
  plane(g, STAINS[0](), -0.35, -1.25, 0.5, 0.65, 0.003)
  return g
}

function intercom(): Group {
  const g = new Group()
  box(g, C.steel(), -0.17, -0.48, 0.34, 0.46, 0.05, 0.025)
  plane(g, glow(0x3ab8ff, 1.5), -0.1, -0.18, 0.2, 0.1, 0.051)
  bit(g, C.black(), -0.1, -0.38, 0.2, 0.14, 0.01, 0.052)
  knob(g, glow(0x39ff6a, 2), 0, -0.43, 0.03, 0.02, 0.055)
  return g
}

function lightSwitch(): Group {
  const g = new Group()
  box(g, C.offWhite(), -0.08, -0.25, 0.16, 0.24, 0.015, 0.008).castShadow = false
  bit(g, matte(0xe8e6e0, 0.4), -0.03, -0.18, 0.06, 0.1, 0.02, 0.02).rotation.x = 0.15
  return g
}

function fireExtinguisher(): Group {
  const g = new Group()
  // The red sign above, then the bracket and the scanned extinguisher hanging from it.
  plane(g, matte(0xb0201c, 0.6), -0.13, -0.17, 0.26, 0.15, 0.003)
  bit(g, C.darkSteel(), -0.06, -0.38, 0.12, 0.06, 0.06, 0.03)
  scanned(g, 'korean_fire_extinguisher_01', { z: 0.14, lift: -0.8, scale: 1.05 })
  return g
}

function fireAlarmPull(): Group {
  const g = new Group()
  scanned(g, 'fire_alarm', { z: 0, lift: -0.3, scale: 2.2 })
  return g
}

function exitSign(): Group {
  const g = new Group()
  box(g, C.offWhite(), -0.45, -0.35, 0.9, 0.35, 0.06, 0.03).castShadow = false
  plane(g, EXIT_SIGN(), -0.42, -0.32, 0.84, 0.29, 0.061)
  return g
}

function neonSign(): Group {
  const g = new Group()
  const v = pick('neonSign', NEON_SIGNS.length)
  // Tubes stand off a dark rail; a cable drops from one end to a transformer box.
  bit(g, C.darkSteel(), -1.1, -0.5, 2.2, 0.04, 0.05, 0.025)
  plane(g, NEON_SIGNS[v](), -1.2, -0.9, 2.4, 0.9, 0.07)
  box(g, C.black(), 0.95, -0.9, 0.2, 0.14, 0.08, 0.04)
  return g
}

function roomNumber(): Group {
  const g = new Group()
  box(g, C.black(), -0.3, -0.4, 0.6, 0.4, 0.015, 0.008).castShadow = false
  plane(g, ROOM_PLATES[pick('roomNumber', ROOM_PLATES.length)](), -0.28, -0.38, 0.56, 0.36, 0.017)
  return g
}

function hazardStripe(): Group {
  const g = new Group()
  plane(g, HAZARD(), -1.5, -0.4, 3, 0.4, 0.004)
  return g
}

function stain(): Group {
  const g = new Group()
  plane(g, STAINS[pick('stain', STAINS.length)](), -0.9, -1.6, 1.8, 1.6, 0.003)
  return g
}

/** A window frame with the night city behind the glass, returned so blinds can be added over it. */
function windowFrame(): Group {
  const g = new Group()
  const frame = matte(0x2a2e33, 0.45, 0.5)
  plane(g, CITY_VIEW(), -1.42, -2.1, 2.84, 2.0, 0.01)
  panel(g, frame, -1.5, -0.1, 3, 0.1, 0.12, 0.06)
  panel(g, frame, -1.5, -2.2, 3, 0.1, 0.12, 0.06)
  for (const x of [-1.5, -0.04, 1.42]) panel(g, frame, x, -2.1, 0.08, 2.0, 0.12, 0.06)
  box(g, matte(0xbab4a8, 0.6), -1.6, -2.24, 3.2, 0.05, 0.22, 0.11)
  return g
}

function windowProp(): Group {
  const g = windowFrame()
  plane(g, GLASS_SHEEN(), -1.42, -2.1, 2.84, 2.0, 0.02)
  return g
}

function windowBlinds(): Group {
  const g = windowFrame()
  const drop = [1.3, 1.75, 0.9][pick('windowBlinds', 3)]
  bit(g, C.offWhite(), -1.5, -0.2, 3, 0.1, 0.08, 0.15)
  plane(g, BLINDS(), -1.45, -0.2 - drop, 2.9, drop, 0.13)
  return g
}

function shelfWall(): Group {
  const g = new Group()
  const v = pick('shelfWall', 2)
  box(g, C.oak(), -1, -0.5, 2, 0.04, 0.26, 0.13)
  for (const x of [-0.7, 0.66]) bit(g, C.darkSteel(), x, -0.62, 0.04, 0.12, 0.2, 0.1)
  scanned(g, 'book_encyclopedia_set_01', { x: -0.85, z: 0.11, lift: -0.46, scale: 1.2 })
  if (v === 0) scanned(g, 'potted_plant_04', { x: 0.55, z: 0.13, lift: -0.46, scale: 1.4 })
  else scanned(g, 'cardboard_box_01', { x: 0.55, z: 0.13, lift: -0.46, scale: 0.8, turn: Math.PI / 2 })
  bit(g, matte(0x8a2a2a, 0.6), 0.1, -0.46, 0.22, 0.03, 0.18, 0.13)
  return g
}

function cableBundle(): Group {
  const g = new Group()
  const colours = [0x15171a, 0x3a3f44, 0x8a6a2e]
  for (const [index, tube] of CABLE_TUBES().entries()) {
    const mesh = new Mesh(tube, matte(colours[index], 0.7))
    g.add(mesh)
  }
  for (const x of [-2.45, 0, 2.45]) bit(g, C.darkSteel(), x - 0.02, -0.1, 0.04, 0.1, 0.16, 0)
  return g
}

function ceilingDuct(): Group {
  const g = new Group()
  const metal = matte(0x9aa0a6, 0.4, 0.75)
  box(g, metal, -3, -0.6, 6, 0.45, 0.6, 0)
  for (let x = -2.7; x < 3; x += 1.35) bit(g, matte(0x7d838a, 0.4, 0.75), x - 0.03, -0.62, 0.06, 0.49, 0.64, 0)
  for (const x of [-2, 0.7, 2.6]) bit(g, C.darkSteel(), x, -0.15, 0.03, 0.15, 0.03, 0)
  return g
}

function sprinkler(): Group {
  const g = new Group()
  cylinder(g, C.steel(), 0, -0.14, 0.02, 0.14, 0).castShadow = false
  cylinder(g, C.brass(), 0, -0.18, 0.06, 0.012, 0).castShadow = false
  ball(g, matte(0xc0262d, 0.3), 0, -0.155, 0.015, 0).castShadow = false
  return g
}

function smokeDetector(): Group {
  const g = new Group()
  cylinder(g, C.offWhite(), 0, -0.05, 0.14, 0.05, 0).castShadow = false
  ball(g, C.offWhite(), 0, -0.05, 0.1, 0).scale.set(0.1, 0.05, 0.1)
  bit(g, C.ledRed(), 0.04, -0.1, 0.012, 0.012, 0.012, 0.05)
  return g
}

function speaker(): Group {
  const g = new Group()
  bit(g, C.darkSteel(), -0.02, -0.12, 0.04, 0.12, 0.04, 0)
  const body = box(g, C.black(), -0.22, -0.4, 0.44, 0.28, 0.24, 0)
  body.rotation.x = 0.35
  const grille = box(g, matte(0x2a2c30, 0.9), -0.2, -0.38, 0.4, 0.24, 0.01, 0.12)
  grille.rotation.x = 0.35
  grille.position.set(0, -0.3, 0.12)
  return g
}

function ceilingFan(): Group {
  const g = new Group()
  const metal = C.darkSteel()
  cylinder(g, metal, 0, -0.05, 0.09, 0.05, 0).castShadow = false
  cylinder(g, metal, 0, -0.32, 0.018, 0.28, 0)
  cylinder(g, metal, 0, -0.42, 0.12, 0.1, 0)
  for (let blade = 0; blade < 4; blade += 1) {
    const holder = new Group()
    holder.position.set(0, -0.38, 0)
    holder.rotation.y = blade * (Math.PI / 2) + 0.4
    const mesh = box(holder, C.walnut(), 0.1, -0.01, 0.88, 0.015, 0.16, 0)
    mesh.rotation.x = 0.12
    g.add(holder)
  }
  ball(g, matte(0xe8e2d0, 0.3), 0, -0.47, 0.08, 0)
  return g
}

export const DECOR_PROPS: PropSet = {
  poster, posterTorn, graffiti, noticeBoard, picture, artLarge, wallClock, ventGrille, pipeRun, conduitRun, wallAc,
  intercom, lightSwitch, fireExtinguisher, fireAlarmPull, exitSign, neonSign, roomNumber, hazardStripe, stain,
  window: windowProp, windowBlinds, shelfWall, cableBundle, ceilingDuct, sprinkler, smokeDetector, speaker, ceilingFan,
}
