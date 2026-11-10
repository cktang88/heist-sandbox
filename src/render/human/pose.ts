import type { Vec } from '../../game/types'
import { solveJoint } from './ik'

/** Body height in tiles. Every length below is a fraction of this. */
export const HEIGHT = 1.6
const HIP_HEIGHT = 0.49 * HEIGHT
const TORSO = 0.3 * HEIGHT
const UPPER_LEG = 0.25 * HEIGHT
const LOWER_LEG = 0.24 * HEIGHT
const UPPER_ARM = 0.17 * HEIGHT
const FOREARM = 0.16 * HEIGHT
const STRIDE = 0.9 * HEIGHT
const RUN_SPEED = 9

/** What the body is doing this frame. The skeleton is worked out from this alone. */
export type Motion = {
  /** Centre of the feet. */
  x: number
  feetY: number
  facing: 1 | -1
  vx: number
  vy: number
  onGround: boolean
  mode: 'normal' | 'ladder' | 'chute' | 'crouch' | 'stairs'
  /** Direction the gun points, in radians. */
  aim: number
  /** 0..1 recoil push, straight after firing. */
  kick: number
}

export type Limb = { root: Vec; joint: Vec; end: Vec }
export type Skeleton = {
  hip: Vec
  shoulder: Vec
  head: Vec
  lean: number
  legs: [Limb, Limb]
  arms: [Limb, Limb]
  grip: Vec
  gunAngle: number
}

function leg(hip: Vec, foot: Vec, facing: number): Limb {
  return { root: hip, joint: solveJoint(hip, foot, UPPER_LEG, LOWER_LEG, -facing), end: foot }
}

function arm(shoulder: Vec, hand: Vec, facing: number): Limb {
  return { root: shoulder, joint: solveJoint(shoulder, hand, UPPER_ARM, FOREARM, facing), end: hand }
}

/**
 * Builds a side-view skeleton. The run cycle is driven by distance travelled (the x position),
 * so feet plant on the ground and never slide.
 */
export function poseHuman(motion: Motion): Skeleton {
  const { x, feetY, facing } = motion
  const pace = Math.min(1, Math.abs(motion.vx) / RUN_SPEED)
  const phase = (x / STRIDE) * Math.PI * 2 * Math.sign(motion.vx || 1)
  const grounded = motion.onGround && motion.mode === 'normal'
  const bob = grounded ? (0.02 + Math.abs(Math.sin(phase)) * 0.03) * HEIGHT * pace : 0
  const lean = motion.mode === 'normal' ? Math.max(-0.3, Math.min(0.3, (motion.vx / RUN_SPEED) * 0.24)) : 0

  const hip = { x, y: feetY - HIP_HEIGHT + bob }
  const shoulder = { x: hip.x + Math.sin(lean) * TORSO, y: hip.y - Math.cos(lean) * TORSO }
  const head = { x: shoulder.x + Math.sin(lean) * 0.13 * HEIGHT + facing * 0.02, y: shoulder.y - 0.13 * HEIGHT }

  const legs = [0, Math.PI].map((offset, index) => {
    const side = index === 0 ? 1 : -1
    if (motion.mode === 'ladder') {
      const step = Math.sin(feetY * 3 + offset) > 0 ? 0.14 * HEIGHT : 0
      return leg(hip, { x: x + side * 0.07, y: feetY - step }, facing)
    }
    if (!grounded) {
      // Tuck the legs on the way up, let them trail on the way down.
      const tuck = motion.mode === 'chute' ? 0.04 : Math.max(-0.1, Math.min(0.22, -motion.vy * 0.012))
      const swing = motion.mode === 'chute' ? Math.sin(feetY * 2 + offset) * 0.06 : side * 0.14
      return leg(hip, { x: x + swing - facing * 0.05, y: hip.y + (UPPER_LEG + LOWER_LEG) * (0.9 - tuck) }, facing)
    }
    const swing = Math.sin(phase + offset)
    const lift = Math.max(0, Math.cos(phase + offset))
    return leg(hip, {
      x: x + swing * 0.22 * HEIGHT * pace * Math.sign(motion.vx || 1) + side * 0.06 * (1 - pace),
      y: feetY - lift * 0.12 * HEIGHT * pace,
    }, facing)
  }) as [Limb, Limb]

  const gunAngle = motion.aim - facing * motion.kick * 0.3
  const direction = { x: Math.cos(gunAngle), y: Math.sin(gunAngle) }
  const hold = 0.2 * HEIGHT - motion.kick * 0.07 * HEIGHT
  const grip = { x: shoulder.x + direction.x * hold, y: shoulder.y + 0.06 + direction.y * hold }

  let arms: [Limb, Limb]
  if (motion.mode === 'ladder') {
    const reach = Math.sin(feetY * 3) > 0 ? 0.1 : -0.1
    arms = [arm(shoulder, { x: x + 0.2, y: shoulder.y - 0.3 + reach }, facing), arm(shoulder, { x: x - 0.2, y: shoulder.y - 0.3 - reach }, facing)]
  } else if (motion.mode === 'chute') {
    arms = [arm(shoulder, { x: x + 0.28, y: shoulder.y - 0.5 }, 1), arm(shoulder, { x: x - 0.28, y: shoulder.y - 0.5 }, -1)]
  } else {
    const support = { x: grip.x + direction.x * 0.14 * HEIGHT, y: grip.y + direction.y * 0.14 * HEIGHT }
    arms = [arm(shoulder, grip, facing), arm(shoulder, support, facing)]
  }

  return { hip, shoulder, head, lean, legs, arms, grip, gunAngle }
}
