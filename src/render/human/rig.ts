import type { Vec } from '../../game/types'
import { reachToward, solveJoint } from './ik'

/** Body height in tiles. Every length below is a fraction of this. */
export const HEIGHT = 1.6
/** Bone lengths, shared with the 3D body so its parts are built to the same size. */
export const BONES = {
  /** Sole to ankle. Legs end at the ankle; the boot hangs below it. */
  ankle: 0.05,
  upperLeg: 0.25 * HEIGHT,
  lowerLeg: 0.26 * HEIGHT,
  /** Hip joint to the base of the neck. */
  torso: 0.275 * HEIGHT,
  /** Base of the neck to the middle of the head. */
  neck: 0.12 * HEIGHT,
  upperArm: 0.17 * HEIGHT,
  forearm: 0.16 * HEIGHT,
} as const
export const LEG = BONES.upperLeg + BONES.lowerLeg
export const ARM = BONES.upperArm + BONES.forearm
/** Knees and elbows always keep a little bend; a locked joint looks stiff and robotic. */
export const LEG_REACH = 0.985 * LEG
export const ARM_REACH = 0.97 * ARM
export const STAND_HIP = BONES.ankle + 0.975 * LEG
export const CROUCH_HIP = BONES.ankle + 0.62 * LEG

export type Limb = { root: Vec; joint: Vec; end: Vec }

/** Something held in the off hand besides the weapon. A ballistic shield is the only one so far. */
export type OffHand = { item: 'shield'; at: Vec }

export type Skeleton = {
  hip: Vec
  shoulder: Vec
  head: Vec
  /** Tilt of the spine from upright. Positive leans toward +x. */
  lean: number
  /** Near leg first, then far. Each ends at the ankle. */
  legs: [Limb, Limb]
  /** Near arm (the gun hand) first, then far (the support hand). */
  arms: [Limb, Limb]
  grip: Vec
  gunAngle: number
  /** Tilt of the pelvis from upright, same sign as `lean`. */
  pelvis: number
  /** Direction the eyes look, in radians like `gunAngle`. */
  look: number
  /** Direction each hand's fingers point, in radians. */
  hands: [number, number]
  /** Tilt of each boot: 0 flat on the ground, positive lifts the heel. */
  feet: [number, number]
  /** False when the tool is slung on the back (ladders, parachute) or the hands are busy with something else. */
  armed: boolean
  /** 0 side-on to the camera, 1 back to the camera (climbing a ladder). */
  turn: number
  /** Held on the far arm, in front of the body. */
  offHand?: OffHand | null
}

export const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
export const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const smooth = (t: number) => t * t * (3 - 2 * t)
export const frac = (value: number) => value - Math.floor(value)
export const mixVec = (a: Vec, b: Vec, t: number): Vec => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) })

/** Rises over `[start, peak]`, holds until `fall`, and is back to 0 at `end`. Times in the same units as `t`. */
export function envelope(t: number, start: number, peak: number, fall: number, end: number): number {
  if (t <= start || t >= end) return 0
  if (t < peak) return smooth((t - start) / (peak - start))
  if (t <= fall) return 1
  return 1 - smooth((t - fall) / (end - fall))
}

/**
 * Where a foot (or a climbing hand) is at cycle position `q`: `along` is ahead of the body in the
 * direction of travel, `lift` is off the ground. While planted, `along` falls exactly as fast as the
 * body moves, so the foot stays put in the world.
 */
export function stepAt(q: number, stride: number, stance: number): { along: number; swing: number } {
  const span = stride * stance
  if (q < stance) return { along: span * (0.5 - q / stance), swing: 0 }
  const t = (q - stance) / (1 - stance)
  return { along: span * (smooth(t) - 0.5), swing: t }
}

export function legLimb(root: Vec, ankle: Vec, facing: number): Limb {
  const end = reachToward(root, ankle, LEG_REACH)
  return { root, joint: solveJoint(root, end, BONES.upperLeg, BONES.lowerLeg, -facing), end }
}

export function armLimb(root: Vec, hand: Vec, facing: number): Limb {
  const end = reachToward(root, hand, ARM_REACH)
  return { root, joint: solveJoint(root, end, BONES.upperArm, BONES.forearm, facing), end }
}

/** A free arm: `swing` is the upper arm's angle forward of straight down, `elbow` how far the forearm folds on. */
export function swingHand(root: Vec, swing: number, elbow: number, facing: number): Vec {
  const fore = swing + elbow
  return {
    x: root.x + (Math.sin(swing) * BONES.upperArm + Math.sin(fore) * BONES.forearm) * facing,
    y: root.y + Math.cos(swing) * BONES.upperArm + Math.cos(fore) * BONES.forearm,
  }
}

/** Angle relative to straight ahead for someone facing `facing`, positive downward. */
export function pitchOf(angle: number, facing: number): number {
  const relative = facing > 0 ? angle : Math.PI - angle
  return Math.atan2(Math.sin(relative), Math.cos(relative))
}

export function fromPitch(pitch: number, facing: number): number {
  return facing > 0 ? pitch : Math.PI - pitch
}

/** Point `along` the aim line and `below` it, from `origin`. "Below" stays on the gun's underside whichever way the figure faces. */
export function aimPoint(origin: Vec, angle: number, along: number, below: number, facing: number): Vec {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return { x: origin.x + cos * along - sin * below * facing, y: origin.y + sin * along + cos * below * facing }
}

/** Where the base of the neck sits for a spine of tilt `lean` rising from `hip`. */
export function shoulderOf(hip: Vec, lean: number): Vec {
  return { x: hip.x + Math.sin(lean) * BONES.torso, y: hip.y - Math.cos(lean) * BONES.torso }
}

/**
 * The few points a special pose decides: hips and spine, where each ankle and hand goes, where the eyes look and
 * what the hands hold. `assemble` solves the limbs from them. `nod` tips the head forward (down) from its usual carriage.
 */
export type Rig = {
  facing: 1 | -1
  hip: Vec
  lean: number
  pelvis: number
  ankles: [Vec, Vec]
  feet: [number, number]
  hands: [Vec, Vec]
  /** Which way each elbow points: 1 (the default) down and forward like a gun arm, -1 out behind, for hands behind the back. */
  elbows?: [number, number]
  /** Finger directions; by default each hand points along its forearm. */
  handAngles?: [number, number]
  grip?: Vec
  gunAngle?: number
  armed: boolean
  /** Eye direction relative to straight ahead, positive downward. */
  lookPitch: number
  nod?: number
  turn?: number
  offHand?: OffHand | null
}

export function assemble(rig: Rig): Skeleton {
  const { facing, hip, lean } = rig
  const shoulder = shoulderOf(hip, lean)
  const neckLean = lean * 0.45 + facing * (0.14 + (rig.nod ?? 0))
  const head = { x: shoulder.x + Math.sin(neckLean) * BONES.neck, y: shoulder.y - Math.cos(neckLean) * BONES.neck }
  const legs = [0, 1].map((leg) => legLimb(hip, rig.ankles[leg], facing)) as [Limb, Limb]
  const arms = [0, 1].map((arm) => armLimb(shoulder, rig.hands[arm], facing * (rig.elbows?.[arm] ?? 1))) as [Limb, Limb]
  const along = (limb: Limb) => Math.atan2(limb.end.y - limb.joint.y, limb.end.x - limb.joint.x)
  const hands: [number, number] = rig.handAngles ?? [along(arms[0]), along(arms[1])]
  return {
    hip, shoulder, head, lean, legs, arms,
    grip: rig.grip ?? arms[0].end, gunAngle: rig.gunAngle ?? hands[0],
    pelvis: rig.pelvis, look: fromPitch(rig.lookPitch, facing), hands, feet: rig.feet, armed: rig.armed,
    turn: rig.turn ?? 0, offHand: rig.offHand ?? null,
  }
}

/** The rig a finished skeleton was solved from, so a special pose can start from the walking pose and change a few points. */
export function rigOf(body: Skeleton, facing: 1 | -1): Rig {
  return {
    facing, hip: body.hip, lean: body.lean, pelvis: body.pelvis,
    ankles: [body.legs[0].end, body.legs[1].end], feet: [...body.feet], hands: [body.arms[0].end, body.arms[1].end],
    handAngles: [...body.hands], grip: body.grip, gunAngle: body.gunAngle, armed: body.armed,
    lookPitch: pitchOf(body.look, facing), turn: body.turn, offHand: body.offHand ?? null,
  }
}

/** Tilts the spine to `lean` and carries the hands and the weapon along with the shoulders. */
export function tiltUpper(rig: Rig, lean: number): Rig {
  const before = shoulderOf(rig.hip, rig.lean)
  const after = shoulderOf(rig.hip, lean)
  const shift = (point: Vec): Vec => ({ x: point.x + after.x - before.x, y: point.y + after.y - before.y })
  return { ...rig, lean, hands: [shift(rig.hands[0]), shift(rig.hands[1])], grip: rig.grip && shift(rig.grip) }
}

/** Moves the hips (and with them everything above) by `dx`, `dy`, leaving the feet where they are. */
export function shiftHips(rig: Rig, dx: number, dy: number): Rig {
  const shift = (point: Vec): Vec => ({ x: point.x + dx, y: point.y + dy })
  return { ...rig, hip: shift(rig.hip), hands: [shift(rig.hands[0]), shift(rig.hands[1])], grip: rig.grip && shift(rig.grip) }
}
