import type { BufferGeometry } from 'three'
import { BONES } from '../../render/human/pose'
import { LOOKS, type Look, type Outfit } from './looks'
import { Kit, type Finish, type Ring } from './shapes'
import { buildHead } from './head'

/**
 * The parts of one outfit. Each limb part hangs from its root joint along -y and faces +x; the torso
 * hangs from the base of the neck to the hip joint; the pelvis sits on the hip joint; the head is
 * centred on the head point. Clothing and gear are merged into the part they move with.
 */
export type BodyParts = {
  head: BufferGeometry
  torso: BufferGeometry
  pelvis: BufferGeometry
  upperArm: BufferGeometry
  forearm: BufferGeometry
  thighNear: BufferGeometry
  thighFar: BufferGeometry
  shin: BufferGeometry
  boot: BufferGeometry
}

const widen = (rings: readonly Ring[], bulk: number): Ring[] => rings.map((ring) => ({ ...ring, front: ring.front * bulk, back: ring.back * bulk, side: ring.side * bulk }))
const loosen = (rings: readonly Ring[], by: number): Ring[] => rings.map((ring) => ({ ...ring, front: ring.front + by, back: ring.back + by, side: ring.side + by }))
const DARK_RUBBER: Finish = { color: 0x0b0b0b, rough: 0.9 }
const STEEL: Finish = { color: 0x8c8c8c, rough: 0.4, metal: 1 }
const DETAIL = 12

const THIGH: Ring[] = [
  { y: 0.07, front: 0.05, back: 0.06, side: 0.06 },
  { y: 0.03, front: 0.085, back: 0.095, side: 0.085 },
  { y: -0.06, front: 0.095, back: 0.09, side: 0.085 },
  { y: -0.2, front: 0.08, back: 0.075, side: 0.072 },
  { y: -0.33, front: 0.063, back: 0.06, side: 0.06 },
  { y: -0.4, front: 0.057, back: 0.053, side: 0.056 },
  { y: -0.445, front: 0.035, back: 0.03, side: 0.035 },
]

function thigh(look: Look, near: boolean): BufferGeometry {
  const kit = new Kit().shape(look.legs, widen(THIGH, look.bulk * 1.12), {}, DETAIL)
  const outside = 0.075 * look.bulk
  if (look.vest === 'carrier' || look.vest === 'rig') kit.box(look.legs, [0.1, 0.1, 0.03], { y: -0.19, z: outside, x: -0.005 })
  if (near && look.headgear === 'nvg') {
    // Drop-leg holster with the pistol's grip showing.
    kit.box(look.strap, [0.08, 0.025, 0.17], { y: -0.06, z: 0.01 })
      .box(look.pouch, [0.075, 0.15, 0.045], { y: -0.15, z: outside + 0.02, x: -0.005 })
      .box(look.strap, [0.035, 0.05, 0.035], { y: -0.06, z: outside + 0.02, x: -0.02, rz: 0.3 })
  }
  return kit.build()
}

const SHIN: Ring[] = [
  { y: 0.04, front: 0.045, back: 0.045, side: 0.048 },
  { y: 0, front: 0.055, back: 0.055, side: 0.053 },
  { y: -0.08, front: 0.05, back: 0.068, side: 0.055 },
  { y: -0.2, front: 0.043, back: 0.055, side: 0.048 },
  { y: -0.33, front: 0.04, back: 0.042, side: 0.042 },
  { y: -0.42, front: 0.038, back: 0.038, side: 0.04 },
  { y: -0.45, front: 0.02, back: 0.02, side: 0.02 },
]

function shin(look: Look): BufferGeometry {
  const kit = new Kit().shape(look.legs, widen(SHIN, look.bulk * 1.1), {}, DETAIL)
  if (look.kneePads) {
    const pad = look.vest === 'armour' ? look.vestFinish : { color: 0x1a1b1c, rough: 0.55 }
    kit.ball(pad, [0.04, 0.06, 0.055 * look.bulk], { x: 0.05 * look.bulk, y: -0.01 })
      .box(look.strap, [0.08, 0.018, 0.115 * look.bulk], { y: -0.055, x: 0.005 })
  }
  if (look.vest === 'armour') kit.box(look.vestFinish, [0.03, 0.22, 0.08], { x: 0.055 * look.bulk, y: -0.18 })
  return kit.build()
}

/** Boots hang from the ankle with the sole `BONES.ankle` below it and the toe forward. */
function boot(look: Look): BufferGeometry {
  const sole = -BONES.ankle
  const low = look.boots.rough < 0.4
  return new Kit()
    .tube(look.boots, 0.046, 0.05, low ? 0.05 : 0.1, { y: low ? sole + 0.04 : sole + 0.06, x: -0.005 })
    .box(look.boots, [0.15, 0.05, 0.085], { x: 0.035, y: sole + 0.028 })
    .ball(look.boots, [0.065, 0.036, 0.045], { x: 0.105, y: sole + 0.026 })
    .ball(look.boots, [0.045, 0.04, 0.045], { x: -0.035, y: sole + 0.03 })
    .box(low ? look.boots : DARK_RUBBER, [0.22, 0.016, 0.094], { x: 0.04, y: sole + 0.008 })
    .build()
}

const PELVIS: Ring[] = [
  { y: 0.13, front: 0.09, back: 0.09, side: 0.14 },
  { y: 0.05, front: 0.1, back: 0.115, side: 0.155 },
  { y: -0.03, front: 0.095, back: 0.12, side: 0.155 },
  { y: -0.09, front: 0.07, back: 0.09, side: 0.12 },
  { y: -0.125, front: 0.03, back: 0.04, side: 0.06 },
]

function pelvis(look: Look): BufferGeometry {
  const b = look.bulk
  const kit = new Kit().shape(look.legs, widen(PELVIS, b), {}, DETAIL)
  kit.shape(look.belt, loosen(widen([PELVIS[0], { ...PELVIS[1], y: 0.07 }], b), 0.012), {}, DETAIL)
  kit.box(look.vest ? look.strap : look.accent.metal ? look.accent : STEEL, [0.02, 0.035, 0.05], { x: 0.105 * b, y: 0.1 })
  if (look.vest === 'carrier' || look.vest === 'rig') {
    // Battle belt: pouches on the hips and a dump pouch at the back.
    kit.box(look.pouch, [0.06, 0.07, 0.04], { x: 0.02, y: 0.07, z: 0.16 * b })
      .box(look.pouch, [0.06, 0.07, 0.04], { x: 0.02, y: 0.07, z: -0.16 * b })
      .box(look.pouch, [0.05, 0.09, 0.12], { x: -0.13 * b, y: 0.06 })
  } else if (look.vest === 'armour') {
    kit.box(look.vestFinish, [0.045, 0.13, 0.15], { x: 0.105 * b, y: -0.03, rz: -0.08 })
      .box(look.pouch, [0.07, 0.08, 0.05], { x: -0.02, y: 0.06, z: 0.17 * b })
      .box(look.pouch, [0.07, 0.08, 0.05], { x: -0.02, y: 0.06, z: -0.17 * b })
  } else {
    // Duty belt: holster on the gun side, pouches and a radio.
    kit.box(look.pouch, [0.075, 0.13, 0.045], { x: -0.03, y: 0.03, z: 0.165 * b })
      .box(look.pouch, [0.04, 0.05, 0.04], { x: 0.07, y: 0.08, z: 0.13 * b })
      .box(look.pouch, [0.035, 0.07, 0.05], { x: -0.11 * b, y: 0.06, z: -0.06 })
  }
  return kit.build()
}

const TORSO: Ring[] = [
  { y: 0.03, front: 0.045, back: 0.05, side: 0.055 },
  { y: -0.01, front: 0.075, back: 0.085, side: 0.14 },
  { y: -0.05, front: 0.1, back: 0.1, side: 0.185 },
  { y: -0.13, front: 0.122, back: 0.1, side: 0.178 },
  { y: -0.22, front: 0.112, back: 0.094, side: 0.16 },
  { y: -0.31, front: 0.095, back: 0.085, side: 0.145 },
  { y: -0.4, front: 0.095, back: 0.1, side: 0.15 },
  { y: -0.47, front: 0.09, back: 0.1, side: 0.145 },
]

/** Plate carrier, chest rig or heavy armour, plus whatever rides on the back. */
function vest(kit: Kit, look: Look): void {
  const b = look.bulk
  if (look.vest === 'carrier') {
    kit.shape(look.vestFinish, widen([
      { y: -0.045, front: 0.13, back: 0.118, side: 0.165 },
      { y: -0.075, front: 0.145, back: 0.128, side: 0.172 },
      { y: -0.3, front: 0.135, back: 0.118, side: 0.165 },
      { y: -0.33, front: 0.125, back: 0.112, side: 0.16 },
    ], b), {}, DETAIL, 0.55)
    for (const z of [-0.062, 0, 0.062]) kit.box(look.pouch, [0.045, 0.085, 0.05], { x: 0.165 * b, y: -0.255, z })
    kit.box(look.pouch, [0.035, 0.07, 0.11], { x: 0.158 * b, y: -0.14 })
      .box(look.strap, [0.09, 0.022, 0.055], { x: 0.03, y: -0.035, z: 0.12 * b })
      .box(look.strap, [0.09, 0.022, 0.055], { x: 0.03, y: -0.035, z: -0.12 * b })
  } else if (look.vest === 'rig') {
    kit.shape(look.vestFinish, widen([
      { y: -0.15, front: 0.14, back: 0.1, side: 0.17 },
      { y: -0.28, front: 0.13, back: 0.096, side: 0.162 },
    ], b), {}, DETAIL, 0.5)
    for (const z of [-0.09, -0.03, 0.03, 0.09]) kit.box(look.pouch, [0.04, 0.08, 0.05], { x: 0.15 * b, y: -0.22, z })
    kit.box(look.strap, [0.025, 0.2, 0.04], { x: 0.115, y: -0.06, z: 0.09, rz: 0.15 })
      .box(look.strap, [0.025, 0.2, 0.04], { x: -0.1, y: -0.1, z: 0.02, rx: 0.6 })
      .box(look.strap, [0.025, 0.2, 0.04], { x: -0.1, y: -0.1, z: -0.02, rx: -0.6 })
  } else if (look.vest === 'armour') {
    kit.shape(look.vestFinish, widen([
      { y: -0.02, front: 0.13, back: 0.13, side: 0.17 },
      { y: -0.06, front: 0.15, back: 0.14, side: 0.18 },
      { y: -0.33, front: 0.145, back: 0.13, side: 0.175 },
      { y: -0.38, front: 0.13, back: 0.12, side: 0.165 },
    ], b), {}, DETAIL, 0.6)
    // High collar, webbing rows and a warning stripe across the back.
    kit.shape(look.vestFinish, [
      { y: 0.06, front: 0.075, back: 0.09, side: 0.1 },
      { y: -0.01, front: 0.1, back: 0.115, side: 0.15 },
    ], {}, DETAIL)
    for (const y of [-0.15, -0.2, -0.25]) kit.box(look.strap, [0.008, 0.014, 0.27 * b], { x: 0.152 * b, y })
    for (const z of [-0.065, 0, 0.065]) kit.box(look.pouch, [0.05, 0.08, 0.055], { x: 0.17 * b, y: -0.3, z })
    kit.box(look.accent, [0.012, 0.035, 0.3 * b], { x: -0.142 * b, y: -0.11 })
  }
}

function shirtDetails(kit: Kit, look: Look): void {
  const front = TORSO[3].front * look.bulk
  // Collar.
  kit.shape(look.top, [{ y: 0.05, front: 0.055, back: 0.06, side: 0.065 }, { y: 0.0, front: 0.08, back: 0.085, side: 0.1 }], {}, DETAIL)
  if (look.tie) {
    kit.box(look.headgear === 'peaked' ? { color: 0x0e0e0e, rough: 0.6 } : look.legs, [0.014, 0.2, 0.035], { x: front + 0.002, y: -0.12, rz: 0.12 })
    kit.box(look.accent, [0.012, 0.035, 0.03], { x: front - 0.002, y: -0.1, z: 0.075 })
  }
  if (look.headgear === 'cap') {
    // Epaulettes and pocket flaps in the trouser navy, a radio clipped to the shoulder.
    kit.box(look.legs, [0.1, 0.014, 0.045], { y: -0.032, z: 0.15 * look.bulk })
      .box(look.legs, [0.1, 0.014, 0.045], { y: -0.032, z: -0.15 * look.bulk })
      .box(look.legs, [0.008, 0.014, 0.06], { x: front - 0.003, y: -0.075, z: -0.07 })
      .box(look.pouch, [0.035, 0.07, 0.025], { x: 0.08, y: -0.075, z: 0.15 })
      .box(look.pouch, [0.008, 0.06, 0.008], { x: 0.08, y: -0.01, z: 0.155 })
  }
  if (look.headgear === 'peaked') {
    for (const y of [-0.12, -0.19, -0.26]) kit.ball(look.accent, [0.009, 0.009, 0.009], { x: front - 0.004, y, z: 0.01 }, 6)
    kit.box(look.accent, [0.11, 0.016, 0.05], { y: -0.03, z: 0.15 * look.bulk })
      .box(look.accent, [0.11, 0.016, 0.05], { y: -0.03, z: -0.15 * look.bulk })
      .box({ color: 0xeae6dc, rough: 0.7 }, [0.012, 0.06, 0.05], { x: 0.075, y: 0.0, rz: 0.4 })
      .box({ color: 0xa8262a, rough: 0.6 }, [0.008, 0.018, 0.05], { x: front - 0.004, y: -0.085, z: 0.07 })
      .box({ color: 0x3a2516, rough: 0.5 }, [0.02, 0.48, 0.045], { x: 0.02, y: -0.2, z: 0.0, rx: 0.55 })
  }
  if (look.headgear === 'headset') {
    // Lanyard and ID card.
    kit.box(look.strap, [0.006, 0.17, 0.012], { x: front - 0.01, y: -0.08, z: 0.04, rx: 0.3 })
      .box(look.strap, [0.006, 0.17, 0.012], { x: front - 0.01, y: -0.08, z: -0.04, rx: -0.3 })
      .box({ color: 0xf2f2ee, rough: 0.4 }, [0.006, 0.055, 0.04], { x: front + 0.002, y: -0.18 })
  }
}

function torso(look: Look): BufferGeometry {
  const kit = new Kit().shape(look.top, widen(TORSO, look.bulk), {}, DETAIL)
  if (look.vest) vest(kit, look)
  else shirtDetails(kit, look)
  if (look.pack === 'assault') {
    kit.shape({ color: 0x25282b, rough: 0.9 }, [
      { y: -0.03, front: 0.05, back: 0.06, side: 0.12, x: -0.19 },
      { y: -0.08, front: 0.06, back: 0.075, side: 0.135, x: -0.2 },
      { y: -0.3, front: 0.06, back: 0.07, side: 0.13, x: -0.2 },
      { y: -0.33, front: 0.05, back: 0.055, side: 0.12, x: -0.19 },
    ], {}, 10, 0.5)
    // A radio antenna rising past the shoulder is a strong silhouette cue.
    kit.tube({ color: 0x0c0c0c, rough: 0.6 }, 0.005, 0.008, 0.42, { x: -0.25, y: 0.13, z: -0.08, rz: 0.1 }, 5)
      .box({ color: 0x1a1a1a, rough: 0.5 }, [0.05, 0.08, 0.04], { x: -0.26, y: -0.06, z: -0.08 })
  }
  return kit.build()
}

const UPPER_ARM: Ring[] = [
  { y: 0.055, front: 0.05, back: 0.05, side: 0.05 },
  { y: 0.02, front: 0.075, back: 0.075, side: 0.07 },
  { y: -0.06, front: 0.068, back: 0.062, side: 0.06 },
  { y: -0.17, front: 0.055, back: 0.05, side: 0.05 },
  { y: -0.26, front: 0.048, back: 0.046, side: 0.047 },
  { y: -0.295, front: 0.025, back: 0.025, side: 0.025 },
]

function upperArm(look: Look): BufferGeometry {
  const short = look.sleeves === 'short'
  const kit = new Kit().shape(short ? look.skin : look.top, widen(UPPER_ARM, look.bulk), {}, DETAIL)
  if (short) kit.shape(look.top, loosen(widen(UPPER_ARM.slice(0, 3).concat({ y: -0.14, front: 0.06, back: 0.056, side: 0.056 }), look.bulk), 0.01), {}, DETAIL)
  if (look.shoulderPads) {
    kit.ball(look.vestFinish, [0.085, 0.075, 0.085], { y: 0.0 })
      .box(look.accent, [0.1, 0.022, 0.01], { y: -0.005, z: 0.084, rz: 0.1 })
  }
  return kit.build()
}

const FOREARM: Ring[] = [
  { y: 0.035, front: 0.04, back: 0.04, side: 0.04 },
  { y: 0, front: 0.045, back: 0.048, side: 0.046 },
  { y: -0.06, front: 0.047, back: 0.05, side: 0.048 },
  { y: -0.17, front: 0.036, back: 0.036, side: 0.037 },
  { y: -0.21, front: 0.03, back: 0.03, side: 0.032 },
  { y: -0.225, front: 0.02, back: 0.02, side: 0.02 },
]

/** The forearm ends in a closed fist centred on the arm's end point, where the grip sits. */
function forearm(look: Look): BufferGeometry {
  const hand = look.gloves ?? look.skin
  const palm = -BONES.forearm
  const kit = new Kit().shape(look.sleeves === 'short' ? look.skin : look.top, widen(FOREARM, look.bulk), {}, DETAIL)
    .ball(hand, [0.042, 0.046, 0.037], { y: palm + 0.005, x: 0.004 }, 8)
    .ball(hand, [0.014, 0.03, 0.014], { y: palm + 0.02, x: 0.032, z: 0.02 }, 6)
  if (look.gloves) kit.tube(look.gloves, 0.036 * look.bulk, 0.034, 0.045, { y: palm + 0.045 }, 8)
  return kit.build()
}

const cache = new Map<Outfit, BodyParts>()

/** Builds an outfit's parts the first time it is needed; every figure in that outfit shares them. */
export function bodyParts(outfit: Outfit): BodyParts {
  let parts = cache.get(outfit)
  if (!parts) {
    const look = LOOKS[outfit]
    parts = {
      head: buildHead(look), torso: torso(look), pelvis: pelvis(look), upperArm: upperArm(look), forearm: forearm(look),
      thighNear: thigh(look, true), thighFar: thigh(look, false), shin: shin(look), boot: boot(look),
    }
    cache.set(outfit, parts)
  }
  return parts
}
