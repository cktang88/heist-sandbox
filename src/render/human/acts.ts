import type { Vec } from '../../game/types'
import type { Motion } from './pose'
import {
  aimPoint, ARM_REACH, assemble, BONES, clamp, clamp01, envelope, fromPitch, lerp, mixVec, pitchOf, rigOf, shiftHips, shoulderOf,
  smooth, STAND_HIP, stepAt, frac, tiltUpper, type Rig, type Skeleton,
} from './rig'

/**
 * Things a body can be busy with besides walking, climbing and aiming. Each one is a few points (hips, spine, hands,
 * ankles) chosen by a small function below and solved into limbs by `assemble`. Points are in game space (y down).
 * Times: `t` is seconds since the move started, or progress 0..1 where it says so.
 */
export type Act =
  /** On the grappling line: `line` is where the line runs to from the hands (the hook, or the corner it bends round). */
  | { kind: 'hang'; line: Vec; reel: -1 | 0 | 1 }
  /** Climbing a rope hanging at column centre `x`. */
  | { kind: 'rope'; x: number }
  /** Over a ledge or through a window: `t` 0..1, `edge` the corner the hands are on. */
  | { kind: 'vault'; t: number; edge: Vec }
  | { kind: 'punch'; t: number }
  | { kind: 'kick'; t: number }
  /** Hauling furniture by the point `grip`. */
  | { kind: 'drag'; grip: Vec }
  /** Holding a man in front as a shield, the off arm round his neck at `neck`. */
  | { kind: 'hostage'; neck: Vec }
  /** Held as a shield: pulled back off balance, hands at the arm round his throat. */
  | { kind: 'captive' }
  /** Just let go of something thrown. */
  | { kind: 'throw'; t: number }
  /** Pressing a charge onto the spot `at`. */
  | { kind: 'plant'; t: number; at: Vec }
  /** Hands busy at `at`: kneeling over a man, hunched at a lock, or reaching to a panel. */
  | { kind: 'work'; at: Vec; how: 'kneel' | 'hunch' | 'reach' }
  | { kind: 'slide' }
  | { kind: 'surrender' }
  | { kind: 'restrained' }
  | { kind: 'cower' }
  | { kind: 'blindFire' }
  /** Down behind cover between peeks. */
  | { kind: 'duck' }
  /** `t` 0..1 through the reload. */
  | { kind: 'reload'; t: number }
  /** `t` 0..1 through a dive away from a grenade: flying, flat, then pushing up. */
  | { kind: 'dive'; t: number }
  | { kind: 'blinded'; how: 'wild' | 'stumble' | 'cover' }
  /** Hauled along the floor by a colleague whose hands are at x `byX`. */
  | { kind: 'dragged'; byX: number }
  /** Hauling a wounded colleague by the collar at `at`. */
  | { kind: 'dragging'; at: Vec }
  /** Ballistic shield on the off arm. */
  | { kind: 'shield' }
  /** In a column behind a shield, hand on the shoulder `at` of the man in front. */
  | { kind: 'stack'; at: Vec }
  | { kind: 'radio' }
  /** Searching: torch held under the gun hand. */
  | { kind: 'torch' }
  /** Looking around for whatever caught his attention. */
  | { kind: 'scan' }
  /** A body over the shoulder: the off hand holds its legs, the gun hand stays free for the pistol. */
  | { kind: 'carry' }
  /** Caught off guard at arm's length: recoiling, the off hand going for the radio. `t` 0..1 through the beat. */
  | { kind: 'startled'; t: number }

type Of<K extends Act['kind']> = Extract<Act, { kind: K }>

const FLOOR_GAP = BONES.ankle
const KNEEL_HIP = 0.5
/** Seconds a punch and a kick take, start to finish. */
export const PUNCH_SECONDS = 0.25
export const KICK_SECONDS = 0.3
const DIVE_FLIGHT = 0.35
const DIVE_RISE = 0.78

const floorAt = (m: Motion) => m.feetY - FLOOR_GAP
const add = (point: Vec, dx: number, dy: number): Vec => ({ x: point.x + dx, y: point.y + dy })
const sideOf = (from: number, to: number, fallback: number) => (Math.abs(to - from) > 0.02 ? Math.sign(to - from) : fallback)

/** Eye direction from the head toward `at`, as a pitch. */
function lookAt(rig: Rig, at: Vec): number {
  const head = add(shoulderOf(rig.hip, rig.lean), 0.1 * rig.facing, -0.18)
  return clamp(pitchOf(Math.atan2(at.y - head.y, at.x - head.x), rig.facing), -1.2, 1.2)
}

/** The weapon pulled in against the chest, muzzle down, while the hands do something else. */
function tuckGun(rig: Rig): Rig {
  const shoulder = shoulderOf(rig.hip, rig.lean)
  const grip = add(shoulder, 0.14 * rig.facing, 0.36)
  const gunAngle = fromPitch(0.75, rig.facing)
  return { ...rig, grip, gunAngle, hands: [grip, rig.hands[1]], handAngles: [gunAngle, rig.handAngles?.[1] ?? gunAngle] }
}

/** Turns the weapon (and the hands on it) about the shoulder by `delta`, away from where it was aimed. */
function swingGun(rig: Rig, delta: number): Rig {
  const shoulder = shoulderOf(rig.hip, rig.lean)
  const turn = (point: Vec): Vec => {
    const dx = point.x - shoulder.x
    const dy = point.y - shoulder.y
    return { x: shoulder.x + dx * Math.cos(delta) - dy * Math.sin(delta), y: shoulder.y + dx * Math.sin(delta) + dy * Math.cos(delta) }
  }
  const gunAngle = (rig.gunAngle ?? 0) + delta
  return { ...rig, grip: rig.grip && turn(rig.grip), gunAngle, hands: [turn(rig.hands[0]), rig.hands[1]], handAngles: [gunAngle, rig.handAngles?.[1] ?? gunAngle] }
}

/** Both knees down (`both`), or one knee down and the near foot planted ahead. */
function kneeling(m: Motion, both: boolean): Pick<Rig, 'hip' | 'ankles' | 'feet' | 'pelvis'> {
  const facing = m.facing
  const floor = floorAt(m)
  const back = (reach: number): Vec => ({ x: m.x - reach * facing, y: floor - 0.02 })
  return {
    hip: { x: m.x, y: m.feetY - KNEEL_HIP - (both ? 0 : 0.04) },
    ankles: both ? [back(0.36), back(0.42)] : [{ x: m.x + 0.34 * facing, y: floor }, back(0.4)],
    feet: both ? [1.35, 1.35] : [0, 1.35],
    pelvis: facing * 0.1,
  }
}

// ---------------------------------------------------------------- the player

/** Hanging on the line: the body swings under it, one hand on it, the other free to aim a one-handed gun. */
function hang(body: Skeleton, m: Motion, act: Of<'hang'>): Skeleton {
  const facing = m.facing
  const hip = { x: m.x, y: m.feetY - STAND_HIP + 0.04 }
  const lean = clamp(Math.atan2(act.line.x - hip.x, hip.y - act.line.y) * 0.75, -0.7, 0.7)
  const shoulder = shoulderOf(hip, lean)
  const gap = Math.hypot(act.line.x - shoulder.x, act.line.y - shoulder.y) || 1
  const up = { x: (act.line.x - shoulder.x) / gap, y: (act.line.y - shoulder.y) / gap }
  // Reeling, the hands go over each other up the line.
  const onLine = (phase: number) => {
    const reach = act.reel === 0 ? 0.92 - phase * 0.1 : 0.72 + 0.2 * Math.sin((m.clock ?? 0) * 8 * act.reel + phase * Math.PI)
    return add(shoulder, up.x * reach * ARM_REACH, up.y * reach * ARM_REACH)
  }
  // Legs hang loose with soft knees and trail behind the swing.
  const trail = clamp(-m.vx * 0.05, -0.32, 0.32)
  const ankles: [Vec, Vec] = [add(hip, 0.2 * facing + trail, 0.6), add(hip, -0.1 * facing + trail * 1.3, 0.7)]
  const rig: Rig = {
    facing, hip, lean, pelvis: lean * 0.6, ankles, feet: [0.6, 0.9], hands: [onLine(0), onLine(1)], armed: false, lookPitch: pitchOf(Math.atan2(up.y, up.x), facing) * 0.5,
  }
  if (m.held === 'grapple') {
    const gunAngle = Math.atan2(up.y, up.x)
    const grip = aimPoint(shoulder, gunAngle, 0.38, 0.04, facing)
    return assemble({ ...rig, armed: true, grip, gunAngle, hands: [grip, onLine(1)], handAngles: [gunAngle, gunAngle] })
  }
  if (m.held === 'pistol' && body.armed) {
    // The aimed pistol keeps its place relative to the shoulder it was posed from.
    const shift = (point: Vec) => add(point, shoulder.x - body.shoulder.x, shoulder.y - body.shoulder.y)
    return assemble({
      ...rig, armed: true, grip: shift(body.grip), gunAngle: body.gunAngle, hands: [shift(body.arms[0].end), onLine(0)],
      handAngles: [body.hands[0], Math.atan2(up.y, up.x)], lookPitch: pitchOf(m.aim, facing) * 0.8,
    })
  }
  return assemble(rig)
}

/** Hand over hand up a rope, feet clamped on it below; side-on, unlike a ladder. */
function rope(_body: Skeleton, m: Motion, act: Of<'rope'>): Skeleton {
  const facing = m.facing
  const floor = floorAt(m)
  const hip = { x: act.x - 0.2 * facing, y: m.feetY - 0.84 }
  const hand = (arm: number): Vec => {
    const step = stepAt(frac(-m.feetY / 0.9 + arm * 0.5), 0.9, 0.5)
    return { x: act.x - 0.03 * facing, y: m.feetY - 1.48 - step.along }
  }
  return assemble({
    facing, hip, lean: facing * 0.1, pelvis: facing * 0.2,
    ankles: [{ x: act.x - 0.02 * facing, y: floor - 0.3 }, { x: act.x - 0.08 * facing, y: floor - 0.1 }], feet: [0.5, -0.2],
    hands: [hand(0), hand(1)], armed: false, lookPitch: -0.5,
  })
}

/** Hands on the edge, bending over it while the near knee comes up to step through. */
function vault(_body: Skeleton, m: Motion, act: Of<'vault'>): Skeleton {
  const facing = m.facing
  const p = clamp01(act.t)
  const hip = { x: m.x - 0.05 * facing, y: m.feetY - STAND_HIP * lerp(0.8, 0.7, p) }
  return assemble({
    facing, hip, lean: facing * lerp(0.35, 0.8, p), pelvis: facing * lerp(0.3, 0.6, p),
    ankles: [add(hip, 0.32 * facing, lerp(0.58, 0.32, p)), { x: hip.x - 0.18 * facing, y: Math.min(hip.y + 0.68, floorAt(m)) }], feet: [0.4, 0.9],
    hands: [add(act.edge, 0.06 * facing, -0.02), add(act.edge, -0.06 * facing, -0.02)], armed: false, lookPitch: 0.5,
  })
}

/** A quick jab with the lead (far) hand; the weapon hand stays in by the chest. */
function punch(body: Skeleton, m: Motion, act: Of<'punch'>): Skeleton {
  const facing = m.facing
  const out = envelope(act.t, 0, 0.06, 0.1, PUNCH_SECONDS)
  let rig = rigOf(body, facing)
  rig = tiltUpper(rig, rig.lean + facing * 0.2 * out)
  rig = tuckGun(rig)
  const shoulder = shoulderOf(rig.hip, rig.lean)
  const guard = add(shoulder, 0.22 * facing, 0.16)
  const strike = add(shoulder, ARM_REACH * facing, 0.02)
  return assemble({ ...rig, hands: [rig.hands[0], mixVec(guard, strike, out)], handAngles: [rig.gunAngle ?? 0, fromPitch(0, facing)] })
}

/** A front kick: knee up, hips thrust through as the near foot snaps out, then back down. */
function kick(body: Skeleton, m: Motion, act: Of<'kick'>): Skeleton {
  const facing = m.facing
  const lift = envelope(act.t, 0, 0.06, 0.2, KICK_SECONDS)
  const out = envelope(act.t, 0.03, 0.11, 0.15, 0.25)
  let rig = rigOf(body, facing)
  // The hips drive forward and sink a little onto the standing leg, so its foot stays planted.
  rig = shiftHips(rig, 0.1 * facing * out, 0.06 * lift)
  rig = tiltUpper(rig, rig.lean - facing * 0.32 * out)
  rig = tuckGun(rig)
  const hip = rig.hip
  const chamber = add(hip, 0.3 * facing, 0.4)
  const extended = add(hip, 0.8 * facing, 0.12)
  const foot = mixVec(mixVec(body.legs[0].end, chamber, lift), extended, out)
  const shoulder = shoulderOf(hip, rig.lean)
  return assemble({
    ...rig, ankles: [foot, body.legs[1].end], feet: [lerp(body.feet[0], -0.6, lift), body.feet[1]],
    hands: [rig.hands[0], add(shoulder, -0.22 * facing, 0.3)],
  })
}

/** Leaning into a piece of furniture with both hands on it: well over it pushing, sitting back pulling. */
function drag(body: Skeleton, m: Motion, act: Of<'drag'>): Skeleton {
  const toward = sideOf(m.x, act.grip.x, m.facing)
  const pulling = m.vx * toward < -0.2
  let rig = shiftHips(rigOf(body, m.facing), 0, 0.1)
  rig = tiltUpper(rig, toward * (pulling ? 0.16 : 0.45))
  return assemble({ ...rig, hands: [add(act.grip, 0, -0.03), add(act.grip, -0.07 * toward, 0.06)], handAngles: undefined, armed: false, lookPitch: lookAt(rig, act.grip) })
}

function hostage(body: Skeleton, m: Motion, act: Of<'hostage'>): Skeleton {
  const rig = tiltUpper(rigOf(body, m.facing), body.lean - m.facing * 0.04)
  return assemble({ ...rig, hands: [rig.hands[0], act.neck], handAngles: [body.hands[0], fromPitch(0.2, m.facing)] })
}

const CAPTIVE_LEAN = 0.32
const captiveHip = (feet: Vec, facing: number): Vec => ({ x: feet.x + 0.06 * facing, y: feet.y - STAND_HIP + 0.05 })

/** Where a captive's throat is, for the arm of the man holding him. */
export function captiveNeck(feet: Vec, facing: 1 | -1): Vec {
  return add(shoulderOf(captiveHip(feet, facing), -facing * CAPTIVE_LEAN), 0.1 * facing, -0.04)
}

function captive(_body: Skeleton, m: Motion): Skeleton {
  const facing = m.facing
  const feet = { x: m.x, y: m.feetY }
  const hip = captiveHip(feet, facing)
  const lean = -facing * CAPTIVE_LEAN
  const shoulder = shoulderOf(hip, lean)
  const floor = floorAt(m)
  const shuffle = Math.sin((m.clock ?? 0) * 6) * 0.05
  return assemble({
    facing, hip, lean, pelvis: lean * 0.3,
    ankles: [{ x: m.x + 0.24 * facing, y: floor }, { x: m.x + (0.02 + shuffle) * facing, y: floor }], feet: [-0.2, 0.3],
    hands: [add(shoulder, 0.17 * facing, 0.02), add(shoulder, 0.12 * facing, 0.08)], armed: false, nod: -0.3, lookPitch: -0.3,
  })
}

/** The throwing arm whips over the top along the aim and follows through; the other arm pulls in. */
function throwing(body: Skeleton, m: Motion, act: Of<'throw'>): Skeleton {
  const facing = m.facing
  const swing = envelope(act.t, 0, 0.06, 0.12, 0.34)
  let rig = rigOf(body, facing)
  rig = tiltUpper(rig, rig.lean + facing * 0.28 * swing)
  const shoulder = shoulderOf(rig.hip, rig.lean)
  const release = aimPoint(shoulder, m.aim, ARM_REACH * 0.95, 0, facing)
  const follow = add(shoulder, 0.3 * facing, 0.45)
  const arc = act.t < 0.1 ? mixVec(rig.hands[0], release, smooth(act.t / 0.1)) : mixVec(release, follow, smooth(clamp01((act.t - 0.1) / 0.12)))
  return assemble({
    ...rig, hands: [mixVec(rig.hands[0], arc, swing), mixVec(rig.hands[1], add(shoulder, -0.1 * facing, 0.32), swing)],
    handAngles: undefined, grip: undefined, gunAngle: undefined, armed: act.t > 0.26,
  })
}

/** Reaching out to press a charge onto a wall, door or floor, crouching for a low spot. */
function plant(body: Skeleton, m: Motion, act: Of<'plant'>): Skeleton {
  const facing = m.facing
  const reach = envelope(act.t, 0, 0.08, 0.26, 0.4)
  const low = clamp01((act.at.y - (m.feetY - 0.9)) / 0.8)
  let rig = shiftHips(rigOf(body, facing), 0, 0.32 * low * reach)
  rig = tiltUpper(rig, rig.lean + sideOf(m.x, act.at.x, facing) * 0.35 * reach)
  return assemble({ ...rig, hands: [mixVec(rig.hands[0], act.at, reach), rig.hands[1]], handAngles: undefined, armed: reach < 0.2 })
}

/** Busy hands: kneeling over a man, hunched at a lock, or reaching to a panel or a cable. */
function work(body: Skeleton, m: Motion, act: Of<'work'>): Skeleton {
  const facing = m.facing
  const toward = sideOf(m.x, act.at.x, facing)
  const fiddle = Math.sin((m.clock ?? 0) * 13) * 0.02
  let rig: Rig = { ...rigOf(body, facing), armed: false, handAngles: undefined }
  if (act.how === 'kneel') rig = { ...rig, ...kneeling(m, false), lean: toward * 0.5 }
  else if (act.how === 'hunch') rig = tiltUpper(shiftHips(rig, -0.05 * toward, 0.22), toward * 0.38)
  else rig = tiltUpper(rig, toward * 0.12)
  const hands: [Vec, Vec] = [add(act.at, 0, fiddle), add(act.at, -0.08 * toward, 0.05 - fiddle)]
  return assemble({ ...rig, hands, lookPitch: lookAt(rig, act.at), nod: 0.15 })
}

/** Low along the floor on the hip, lead leg out, a hand trailing on the floor; the gun stays on target. */
function slide(body: Skeleton, m: Motion): Skeleton {
  const facing = m.facing
  const dir = Math.abs(m.vx) > 0.3 ? Math.sign(m.vx) : facing
  const floor = floorAt(m)
  const hip = { x: m.x, y: m.feetY - 0.32 }
  const lean = -dir * 0.5
  const shoulder = shoulderOf(hip, lean)
  const shift = (point: Vec) => add(point, shoulder.x - body.shoulder.x, shoulder.y - body.shoulder.y)
  return assemble({
    facing, hip, lean, pelvis: -dir * 0.6,
    ankles: [{ x: m.x + 0.74 * dir, y: floor - 0.08 }, { x: m.x + 0.12 * dir, y: floor - 0.04 }], feet: [-0.6, 0.6],
    hands: [shift(body.arms[0].end), { x: m.x - 0.35 * dir, y: floor - 0.04 }], handAngles: [body.hands[0], fromPitch(1.2, facing)],
    grip: shift(body.grip), gunAngle: body.gunAngle, armed: body.armed, lookPitch: pitchOf(body.look, facing),
  })
}

// ---------------------------------------------------------------- guards

function surrender(body: Skeleton, m: Motion): Skeleton {
  const facing = m.facing
  const rig = tiltUpper(rigOf(body, facing), body.lean - facing * 0.06)
  const shoulder = shoulderOf(rig.hip, rig.lean)
  const shake = Math.sin((m.clock ?? 0) * 17) * 0.012
  return assemble({ ...rig, hands: [add(shoulder, 0.14 * facing, -0.4 + shake), add(shoulder, -0.02 * facing, -0.42 - shake)], handAngles: undefined, armed: false, nod: 0.15, lookPitch: 0.1 })
}

function restrained(_body: Skeleton, m: Motion): Skeleton {
  const facing = m.facing
  const pose = kneeling(m, true)
  return assemble({
    facing, ...pose, lean: facing * 0.12,
    hands: [add(pose.hip, -0.17 * facing, -0.1), add(pose.hip, -0.22 * facing, -0.06)], elbows: [-1, -1], armed: false, nod: 0.35, lookPitch: 0.6,
  })
}

/** Panic: curled up low with the arms over the head, or running with them there. */
function cower(body: Skeleton, m: Motion): Skeleton {
  const facing = m.facing
  const cover = (rig: Rig) => {
    const shoulder = shoulderOf(rig.hip, rig.lean)
    return assemble({ ...rig, hands: [add(shoulder, 0.18 * facing, -0.2), add(shoulder, 0.08 * facing, -0.26)], handAngles: undefined, armed: false, nod: 0.6, lookPitch: 0.9 })
  }
  if (Math.abs(m.vx) > 1) return cover(tiltUpper(rigOf(body, facing), body.lean + facing * 0.25))
  const floor = floorAt(m)
  const shiver = Math.sin((m.clock ?? 0) * 21) * 0.008
  return cover({
    facing, hip: { x: m.x - 0.06 * facing + shiver, y: m.feetY - 0.44 }, lean: facing * 0.75, pelvis: facing * 0.6,
    ankles: [{ x: m.x + 0.2 * facing, y: floor }, { x: m.x - 0.12 * facing, y: floor }], feet: [0.3, 0.8], hands: [body.grip, body.grip], armed: false, lookPitch: 0.9,
  })
}

/** Gun held out at full stretch past the cover, head kept down behind it, the other hand on the helmet. */
function blindFire(body: Skeleton, m: Motion): Skeleton {
  const facing = m.facing
  const rig = tiltUpper(shiftHips(rigOf(body, facing), -0.06 * facing, 0.1), body.lean - facing * 0.15)
  const shoulder = shoulderOf(rig.hip, rig.lean)
  const gunAngle = m.aim + Math.sin((m.clock ?? 0) * 11) * 0.06
  const grip = aimPoint(shoulder, gunAngle, ARM_REACH * 0.94, 0, facing)
  return assemble({ ...rig, grip, gunAngle, hands: [grip, add(shoulder, 0.06 * facing, -0.3)], handAngles: [gunAngle, fromPitch(-0.3, facing)], nod: 0.7, lookPitch: 1 })
}

/** Down behind cover: lower, muzzle up by the chest, head down. */
function duck(body: Skeleton, m: Motion): Skeleton {
  const facing = m.facing
  let rig = shiftHips(rigOf(body, facing), 0, 0.12)
  rig = tiltUpper(rig, facing * 0.5)
  const shoulder = shoulderOf(rig.hip, rig.lean)
  const grip = add(shoulder, 0.17 * facing, 0.3)
  const gunAngle = fromPitch(-1.25, facing)
  return assemble({ ...rig, grip, gunAngle, hands: [grip, add(grip, 0.03 * facing, -0.13)], handAngles: [gunAngle, gunAngle], nod: 0.4, lookPitch: 0.5 })
}

/** Gun canted low; the free hand goes to the pouch, back to the magazine well, then to the charging handle. */
function reload(body: Skeleton, m: Motion, act: Of<'reload'>): Skeleton {
  const facing = m.facing
  const t = clamp01(act.t)
  const rig = rigOf(body, facing)
  const shoulder = shoulderOf(rig.hip, rig.lean)
  const grip = add(shoulder, 0.22 * facing, 0.32)
  const gunAngle = fromPitch(0.35, facing)
  const well = aimPoint(grip, gunAngle, 0.08, 0.1, facing)
  const pouch = add(rig.hip, 0.12 * facing, -0.02)
  const handle = aimPoint(grip, gunAngle, -0.04, -0.1, facing)
  const support = t < 0.25 ? mixVec(well, pouch, smooth(t / 0.25))
    : t < 0.55 ? mixVec(pouch, well, smooth((t - 0.25) / 0.3))
      : t < 0.8 ? well : mixVec(well, handle, envelope(t, 0.8, 0.88, 0.95, 1))
  return assemble({ ...rig, grip, gunAngle, hands: [grip, support], handAngles: [gunAngle, gunAngle], nod: 0.2, lookPitch: 0.7 })
}

/** Launched flat away from a grenade, down on the floor, then up onto a knee. */
function dive(_body: Skeleton, m: Motion, act: Of<'dive'>): Skeleton {
  const facing = m.facing
  const t = clamp01(act.t)
  const floor = floorAt(m)
  const flight = 1 - smooth(clamp01(t / DIVE_FLIGHT))
  const rise = smooth(clamp01((t - DIVE_RISE) / (1 - DIVE_RISE)))
  const prone: Rig = {
    facing, hip: { x: m.x - 0.3 * facing, y: m.feetY - 0.16 - flight * 0.25 }, lean: facing * (1.45 - flight * 0.4), pelvis: facing * 1.4,
    ankles: [{ x: m.x - 1.12 * facing, y: floor - 0.04 - flight * 0.3 }, { x: m.x - 1.08 * facing, y: floor - 0.07 - flight * 0.35 }], feet: [1.5, 1.5],
    hands: [{ x: 0, y: 0 }, { x: 0, y: 0 }], armed: false, nod: -0.4, lookPitch: 0.2,
  }
  const kneel = { ...prone, ...kneeling(m, false), lean: facing * 0.5 }
  const blend: Rig = {
    ...prone, hip: mixVec(prone.hip, kneel.hip, rise), lean: lerp(prone.lean, kneel.lean, rise), pelvis: lerp(prone.pelvis, kneel.pelvis, rise),
    ankles: [mixVec(prone.ankles[0], kneel.ankles[0], rise), mixVec(prone.ankles[1], kneel.ankles[1], rise)],
    feet: [lerp(1.5, kneel.feet[0], rise), lerp(1.5, kneel.feet[1], rise)],
  }
  const shoulder = shoulderOf(blend.hip, blend.lean)
  const ahead = (flight > 0.2 ? 0.5 : 0.3) * facing
  const down = lerp(0.1, 0.4, rise)
  // Flat on the floor the elbows ride up rather than through it.
  const flat = flight < 0.3 && rise < 0.5
  return assemble({ ...blend, hands: [add(shoulder, ahead, down), add(shoulder, ahead - 0.06 * facing, down + 0.04)], elbows: flat ? [-1, -1] : undefined })
}

/** Flashed: an arm across the eyes, a stagger with hands groping, or the gun swinging wild. */
function blinded(body: Skeleton, m: Motion, act: Of<'blinded'>): Skeleton {
  const facing = m.facing
  const clock = m.clock ?? 0
  const eyes = (rig: Rig) => add(shoulderOf(rig.hip, rig.lean), 0.24 * facing, -0.2)
  if (act.how === 'cover') {
    const rig = tuckGun(tiltUpper(shiftHips(rigOf(body, facing), -0.04 * facing, 0.12), facing * 0.3))
    const low = add(shoulderOf(rig.hip, rig.lean), 0.1 * facing, 0.48)
    return assemble({ ...rig, grip: low, hands: [low, eyes(rig)], handAngles: [rig.gunAngle ?? 0, fromPitch(Math.PI, facing)], nod: 0.5, lookPitch: 0.8 })
  }
  if (act.how === 'wild') {
    const rig = swingGun(tiltUpper(rigOf(body, facing), body.lean - facing * 0.1), Math.sin(clock * 9) * 0.35 + Math.sin(clock * 23) * 0.12)
    return assemble({ ...rig, hands: [rig.hands[0], eyes(rig)], handAngles: [rig.gunAngle ?? 0, fromPitch(Math.PI, facing)], nod: -0.15, lookPitch: -0.2 })
  }
  const wobble = Math.sin(clock * 4.5)
  const rig = tiltUpper(rigOf(body, facing), body.lean + wobble * 0.22)
  const shoulder = shoulderOf(rig.hip, rig.lean)
  return assemble({
    ...rig, hands: [add(shoulder, 0.42 * facing, 0.08 + 0.1 * wobble), add(shoulder, 0.38 * facing, -0.04 - 0.1 * wobble)],
    handAngles: undefined, grip: undefined, gunAngle: undefined, armed: false, nod: -0.25, lookPitch: -0.2,
  })
}

const DRAGGED_RAISE = Math.PI / 2 - 0.5
const draggedHip = (feet: Vec): Vec => ({ x: feet.x, y: feet.y - 0.14 })

/** Where a man being dragged is held: his collar, raised toward whoever drags him. */
export function draggedCollar(feet: Vec, byX: number): Vec {
  return shoulderOf(draggedHip(feet), sideOf(feet.x, byX, 1) * DRAGGED_RAISE)
}

/** On his back, shoulders lifted toward the man hauling him, heels trailing. */
function dragged(_body: Skeleton, m: Motion, act: Of<'dragged'>): Skeleton {
  const toward = sideOf(m.x, act.byX, m.facing)
  const hip = draggedHip({ x: m.x, y: m.feetY })
  const lean = toward * DRAGGED_RAISE
  const shoulder = shoulderOf(hip, lean)
  const floor = floorAt(m)
  return assemble({
    facing: m.facing, hip, lean, pelvis: toward * 1.3,
    ankles: [{ x: hip.x - toward * 0.84, y: floor - 0.06 }, { x: hip.x - toward * 0.8, y: floor - 0.1 }], feet: [-1.3, -1.3],
    hands: [add(shoulder, 0.34 * toward, -0.18), add(shoulder, 0.3 * toward, -0.06)], armed: false, nod: -0.5, lookPitch: 0.4,
  })
}

/** Bent over, both hands in a colleague's collar, backing off with him. */
function dragging(body: Skeleton, m: Motion, act: Of<'dragging'>): Skeleton {
  const toward = sideOf(m.x, act.at.x, m.facing)
  const rig = tiltUpper(shiftHips(rigOf(body, m.facing), 0, 0.3), toward * 0.9)
  return assemble({ ...rig, hands: [add(act.at, 0, -0.02), add(act.at, 0.05 * toward, 0.04)], handAngles: undefined, armed: false, lookPitch: lookAt(rig, act.at) })
}

/** Where the shield's middle sits, from the shoulder of the man carrying it. */
const SHIELD_AHEAD = { x: 0.42, y: 0.34 }

/** A ballistic shield out in front on the off arm, the pistol beside it. */
function shield(body: Skeleton, m: Motion): Skeleton {
  const facing = m.facing
  const rig = rigOf(body, facing)
  const shoulder = shoulderOf(rig.hip, rig.lean)
  const at = add(shoulder, SHIELD_AHEAD.x * facing, SHIELD_AHEAD.y)
  return assemble({ ...rig, hands: [rig.hands[0], add(at, -0.07 * facing, -0.02)], handAngles: [rig.handAngles?.[0] ?? 0, fromPitch(-1.4, facing)], offHand: { item: 'shield', at } })
}

/** Where a man in a shield column puts his hand on the one in front: about that man's shoulder, crouched. */
export function stackShoulder(feet: Vec, facing: 1 | -1): Vec {
  return { x: feet.x + 0.06 * facing, y: feet.y - 1.12 }
}

function stack(body: Skeleton, m: Motion, act: Of<'stack'>): Skeleton {
  // He leans in to keep the hand on; the column is spaced so that it only just reaches.
  const rig = tiltUpper(rigOf(body, m.facing), body.lean + m.facing * 0.2)
  return assemble({ ...rig, hands: [rig.hands[0], act.at], handAngles: [rig.handAngles?.[0] ?? 0, fromPitch(0.4, m.facing)] })
}

/** Talking into the shoulder mic: free hand up to it, head tipped toward it. */
function radio(body: Skeleton, m: Motion): Skeleton {
  const rig = rigOf(body, m.facing)
  const shoulder = shoulderOf(rig.hip, rig.lean)
  return assemble({ ...rig, hands: [rig.hands[0], add(shoulder, 0.1 * m.facing, 0.05)], handAngles: [rig.handAngles?.[0] ?? 0, fromPitch(-1.6, m.facing)], nod: 0.3 })
}

/** The torch hand braced under the gun hand, both pointing where he looks. */
function torch(body: Skeleton, m: Motion): Skeleton {
  const rig = rigOf(body, m.facing)
  return assemble({ ...rig, hands: [rig.hands[0], add(rig.hands[0], -0.03 * m.facing, 0.07)], handAngles: [body.gunAngle, body.gunAngle] })
}

/** Standing still, half turning and looking up and down, a hand resting on the holster. */
function scan(body: Skeleton, m: Motion): Skeleton {
  const clock = m.clock ?? 0
  const rig = rigOf(body, m.facing)
  return assemble({
    ...rig, hands: [rig.hands[0], add(rig.hip, 0.14 * m.facing, 0.02)], handAngles: undefined,
    lookPitch: Math.sin(clock * 0.9) * 0.35, turn: 0.3 * (0.5 + 0.5 * Math.sin(clock * 0.7)),
  })
}

/** Bent a little under the weight, the off hand on the shoulder clamping the legs, the gun hand where it was. */
function carry(body: Skeleton, m: Motion): Skeleton {
  const rig = tiltUpper(shiftHips(rigOf(body, m.facing), 0, 0.05), m.facing * 0.12)
  const shoulder = shoulderOf(rig.hip, rig.lean)
  return assemble({ ...rig, hands: [rig.hands[0], add(shoulder, 0.16 * m.facing, -0.02)], handAngles: [rig.handAngles?.[0] ?? 0, fromPitch(-1.2, m.facing)] })
}

/** Rocked back on his heels, the gun hand dropping, the other hand flying to the radio on his chest. */
function startled(body: Skeleton, m: Motion, act: Of<'startled'>): Skeleton {
  const recoil = envelope(act.t, 0, 0.08, 0.6, 1)
  const rig = tiltUpper(rigOf(body, m.facing), -m.facing * 0.22 * recoil)
  const shoulder = shoulderOf(rig.hip, rig.lean)
  return assemble({
    ...rig, hands: [add(rig.hands[0], 0, 0.18 * recoil), add(shoulder, 0.1 * m.facing, 0.05 + 0.08 * (1 - act.t))],
    handAngles: [rig.handAngles?.[0] ?? 0, fromPitch(-1.6, m.facing)], lookPitch: -0.1, nod: -0.2,
  })
}

type Poser = (body: Skeleton, m: Motion, act: never) => Skeleton
const POSES: { [K in Act['kind']]: (body: Skeleton, m: Motion, act: Of<K>) => Skeleton } = {
  hang, rope, vault, punch, kick, drag, hostage, captive, throw: throwing, plant, work, slide,
  surrender, restrained, cower, blindFire, duck, reload, dive, blinded, dragged, dragging, shield, stack, radio, torch, scan,
  carry, startled,
}

/** Reposes `body` (the walking or aiming pose for `m`) for what the person is busy with. */
export function applyAct(body: Skeleton, m: Motion, act: Act): Skeleton {
  return (POSES[act.kind] as Poser)(body, m, act as never)
}
