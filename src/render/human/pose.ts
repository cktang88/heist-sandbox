import type { ToolId } from '../../game/toolDefs'
import type { Vec } from '../../game/types'
import { applyAct, type Act } from './acts'
import {
  aimPoint as onLine, armLimb, BONES, clamp01, CROUCH_HIP, frac, fromPitch, legLimb, LEG_REACH, lerp, pitchOf, smooth,
  STAND_HIP, stepAt, swingHand, type Limb, type Skeleton,
} from './rig'

export { BONES, HEIGHT } from './rig'
export type { Limb, Skeleton } from './rig'
export type { Act } from './acts'

const RUN_SPEED = 9
/**
 * Ladder rungs sit at every quarter and three-quarter tile. Each hand and foot moves up two rungs per
 * climbing cycle; hands sit 1.5 tiles above the feet and feet a quarter tile above, with the feet a
 * quarter cycle behind the hands, so every planted hand and foot lands exactly on a rung.
 */
const RUNG_CYCLE = 1
const LADDER_HIP = 0.82
const LADDER_HANDS = 1.5
const LADDER_FEET = 0.25

export type Mode = 'normal' | 'ladder' | 'chute' | 'crouch' | 'stairs'

/** What the body is doing this frame. The skeleton is worked out from this alone. */
export type Motion = {
  /** Centre of the feet. */
  x: number
  feetY: number
  facing: 1 | -1
  vx: number
  vy: number
  onGround: boolean
  mode: Mode
  /** Direction the gun points, in radians. */
  aim: number
  /** 0..1 recoil push, straight after firing. */
  kick: number
  /** Seconds on a steady clock. Drives breathing and small idle shifts. */
  clock?: number
  /** Progress through the stepping cycle, in cycles (see `advanceStride`). Without it, one is derived from x. */
  stride?: number
  /** What is in the hands. Undefined is treated as a pistol; null means empty hands. */
  held?: ToolId | null
  /** Weapon up and eyes on the target. A calm guard carries the weapon low. Defaults to true. */
  alert?: boolean
  /** 0..1, straight after being hit. */
  flinch?: number
  /** 0..1, straight after landing from a fall. */
  land?: number
  /** 0..1 from rounds cracking past: the body hunches and the head ducks. */
  cower?: number
  /** Something other than walking, climbing or aiming that the body is busy with. See `acts.ts`. */
  act?: Act
}

/** How a tool is held. `reach` and `drop` place the grip hand from the shoulder along and below the aim line. */
export type Carry = 'pistol' | 'shouldered' | 'launcher' | 'tool' | 'thrown' | 'device' | 'coil'
export type Hold = { carry: Carry; reach: number; drop: number; support: Vec; flip: number }

const THROWN: Hold = { carry: 'thrown', reach: 0, drop: 0, support: { x: 0, y: 0 }, flip: 0.1 }
/**
 * `support` is where the other hand goes, from the grip hand: `x` along the barrel and `y` below it.
 * The 3D weapons put their fore-ends exactly there. `flip` is how far the muzzle climbs on a full kick.
 */
export const HOLDS: Record<ToolId, Hold> = {
  pistol: { carry: 'pistol', reach: 0.4, drop: 0.035, support: { x: -0.012, y: 0.028 }, flip: 0.4 },
  rifle: { carry: 'shouldered', reach: 0.2, drop: 0.075, support: { x: 0.3, y: -0.035 }, flip: 0.16 },
  shotgun: { carry: 'shouldered', reach: 0.2, drop: 0.075, support: { x: 0.35, y: -0.03 }, flip: 0.42 },
  sniper: { carry: 'shouldered', reach: 0.2, drop: 0.075, support: { x: 0.34, y: -0.035 }, flip: 0.3 },
  rocket: { carry: 'launcher', reach: 0.1, drop: 0.12, support: { x: 0.28, y: 0 }, flip: 0.22 },
  drill: { carry: 'tool', reach: 0.3, drop: 0.12, support: { x: 0.1, y: -0.12 }, flip: 0.04 },
  drone: { carry: 'device', reach: 0, drop: 0, support: { x: 0.07, y: 0 }, flip: 0 },
  c4: THROWN,
  smoke: THROWN,
  flash: THROWN,
  frag: THROWN,
  rope: { carry: 'coil', reach: 0, drop: 0, support: { x: 0.02, y: -0.1 }, flip: 0 },
  grapple: { carry: 'pistol', reach: 0.36, drop: 0.04, support: { x: 0.12, y: 0.02 }, flip: 0.3 },
}

/** Stepping style for one mode at one speed. Lengths in tiles; `stance` is the share of a cycle a foot is planted. */
type Gait = { stride: number; stance: number; clearance: number; hip: number; bob: number; lean: number; swing: number; elbow: number }

function gaitFor(mode: Mode, speed: number): Gait {
  const pace = clamp01(speed / RUN_SPEED)
  if (mode === 'crouch') {
    return { stride: 0.95 + 0.12 * speed, stance: 0.62, clearance: 0.07, hip: CROUCH_HIP, bob: 0.006, lean: 0.08, swing: 0.2, elbow: 0.6 }
  }
  return {
    stride: 1.25 + 0.2 * speed,
    stance: lerp(0.62, 0.36, pace),
    clearance: lerp(0.07, 0.24, pace),
    hip: STAND_HIP,
    bob: lerp(0.012, 0.024, pace),
    lean: lerp(0.05, 0.3, pace),
    swing: lerp(0.3, 0.75, pace),
    elbow: lerp(0.3, 1.5, pace),
  }
}

/**
 * Moves the stepping cycle on by the distance travelled. Driving it by distance, not time, is what
 * keeps planted feet from sliding at any speed.
 */
export function advanceStride(stride: number, distance: number, speed: number, mode: Mode): number {
  return frac(stride + Math.abs(distance) / gaitFor(mode, speed).stride)
}

/** Heel lift through a step: rolls onto the toe before push-off, toe up just before the heel lands. */
function footPitch(q: number, stance: number, pace: number): number {
  if (q < stance) return smooth(clamp01((q / stance - 0.6) / 0.4)) * 0.75
  const t = (q - stance) / (1 - stance)
  return 0.75 * (1 - t) * (1 - t) - 0.3 * (1 - pace) * t * t
}

type Frame = {
  m: Motion
  facing: 1 | -1
  /** Direction of travel, or facing when still. */
  dir: number
  speed: number
  pace: number
  phase: number
  clock: number
  ready: boolean
  hold: Hold | null
}

type Lower = { hip: Vec; legs: [Limb, Limb]; feet: [number, number]; pelvis: number; lean: number; bob: number; along: [number, number]; travel: number }

/** Hip offsets from the pelvis turning with the stride: the leg that is forward has its hip forward too. */
function hipTwist(along: number, span: number): number {
  return span > 0 ? Math.max(-1, Math.min(1, along / span)) * 0.03 : 0
}

/** Walking, running and crouching on flat floor or along a staircase. */
function groundLegs(f: Frame): Lower {
  const { m, facing, dir } = f
  const crouch = m.mode === 'crouch'
  const gait = gaitFor(m.mode, f.speed)
  // Below walking pace the feet settle into a standing stance instead of stepping.
  const moving = clamp01(f.speed / 1.2)
  const slope = m.mode === 'stairs' && Math.abs(m.vx) > 0.05 ? m.vy / m.vx : 0
  const groundAt = (x: number) => m.feetY + slope * (x - m.x)
  const stanceFeet = crouch ? [0.2, -0.2] : f.ready ? [0.1, -0.12] : [0.05, -0.05]
  const stancePitch = crouch ? [0, 0.9] : [0, 0]

  const feet: Vec[] = []
  const pitch: number[] = []
  const along: number[] = []
  for (let leg = 0; leg < 2; leg += 1) {
    const q = frac(f.phase + leg * 0.5)
    const step = stepAt(q, gait.stride, gait.stance)
    const lift = gait.clearance * Math.sin(Math.PI * Math.pow(step.swing, 0.75)) + (slope !== 0 && step.swing > 0 ? 0.08 * Math.sin(Math.PI * step.swing) : 0)
    const offset = lerp(stanceFeet[leg] * facing, step.along * dir, moving)
    const x = m.x + offset
    feet.push({ x, y: groundAt(x) - lift * moving - BONES.ankle })
    pitch.push(lerp(stancePitch[leg], footPitch(q, gait.stance, f.pace), moving))
    along.push(offset * facing)
  }

  // Walking vaults over the planted leg (highest mid-stance); running sinks into it (lowest mid-stance).
  const vault = lerp(1, -1, clamp01((f.pace - 0.3) / 0.3))
  const bob = gait.bob * moving * vault * Math.cos(4 * Math.PI * (f.phase - gait.stance / 2))
  const breathe = Math.sin(f.clock * 1.7) * 0.004 * (1 - moving)
  const squash = (m.land ?? 0) * 0.2 + (m.flinch ?? 0) * 0.05 + (m.cower ?? 0) * 0.14
  const sway = Math.sin(f.clock * 0.55) * 0.012 * (1 - moving)
  const hip = { x: m.x + sway, y: groundAt(m.x) - gait.hip + bob + breathe + squash }
  // Never let the hips rise higher than the planted legs can reach.
  feet.forEach((foot) => {
    if (foot.y < groundAt(foot.x) - BONES.ankle - 0.02) return
    const across = foot.x - hip.x
    hip.y = Math.max(hip.y, foot.y - Math.sqrt(Math.max(0, LEG_REACH * LEG_REACH - across * across)))
  })

  const span = gait.stride * gait.stance * 0.5
  const climbing = slope !== 0 ? Math.sign(-m.vy) * 0.12 : 0
  const posture = (crouch ? 0.42 : f.ready ? 0.1 : 0.03) + (m.cower ?? 0) * 0.25
  const lean = facing * (posture + climbing) + dir * gait.lean * moving * (crouch ? 0.5 : 1) + Math.sin(4 * Math.PI * f.phase) * 0.025 * moving * f.pace
  const legs = [0, 1].map((leg) => legLimb({ x: hip.x + hipTwist(along[leg], span) * facing, y: hip.y }, feet[leg], facing)) as [Limb, Limb]
  return {
    hip, legs, feet: [pitch[0], pitch[1]], pelvis: lean * 0.4 + facing * (crouch ? 0.45 : 0.12), lean, bob,
    along: [along[0] / Math.max(span, 0.01), along[1] / Math.max(span, 0.01)], travel: moving,
  }
}

/** Jumping and falling: a knee drives up on the way up, the legs reach for the floor on the way down. */
function airLegs(f: Frame): Lower {
  const { m, facing } = f
  const falling = clamp01((m.vy + 3) / 8)
  const hip = { x: m.x, y: m.feetY - STAND_HIP + 0.04 }
  const drive = { x: lerp(0.22, 0.1, falling), y: lerp(0.42, 0.72, falling) }
  const trail = { x: lerp(-0.22, -0.08, falling), y: lerp(0.66, 0.74, falling) }
  const legs: [Limb, Limb] = [
    legLimb(hip, { x: hip.x + drive.x * facing, y: hip.y + drive.y }, facing),
    legLimb(hip, { x: hip.x + trail.x * facing, y: hip.y + trail.y }, facing),
  ]
  const lean = facing * lerp(0.16, 0.04, falling)
  return { hip, legs, feet: [lerp(0.2, -0.1, falling), lerp(0.6, 0.1, falling)], pelvis: lean * 0.5 + facing * 0.1, lean, bob: 0, along: [1, -1], travel: 0 }
}

/** Hanging under the canopy: legs dangle and drift a little. */
function chuteLegs(f: Frame): Lower {
  const { m, facing } = f
  const hip = { x: m.x, y: m.feetY - STAND_HIP + 0.06 }
  const drift = (leg: number) => Math.sin(f.clock * 1.3 + leg * 2) * 0.04
  const legs = [0, 1].map((leg) => legLimb(hip, { x: hip.x + (0.07 - leg * 0.1 + drift(leg)) * facing, y: hip.y + 0.76 }, facing)) as [Limb, Limb]
  return { hip, legs, feet: [0.35, 0.45], pelvis: facing * 0.1, lean: facing * 0.04, bob: 0, along: [0, 0], travel: 0 }
}

/** Climbing a ladder, seen from behind: feet step from rung to rung, opposite to the hands. */
function ladderLegs(f: Frame): Lower {
  const { m, facing } = f
  const hip = { x: m.x, y: m.feetY - LADDER_HIP }
  const travel = -m.feetY
  const feet: Vec[] = []
  const pitch: number[] = []
  for (let leg = 0; leg < 2; leg += 1) {
    const q = frac(travel / RUNG_CYCLE + 0.25 + (1 - leg) * 0.5)
    const step = stepAt(q, RUNG_CYCLE, 0.5)
    const pull = Math.sin(Math.PI * step.swing)
    feet.push({ x: m.x + (0.12 - pull * 0.1) * facing, y: m.feetY - LADDER_FEET - step.along - BONES.ankle })
    pitch.push(0.15 + pull * 0.4)
  }
  const legs = [0, 1].map((leg) => legLimb(hip, feet[leg], facing)) as [Limb, Limb]
  return { hip, legs, feet: [pitch[0], pitch[1]], pelvis: facing * 0.05, lean: facing * 0.06, bob: 0, along: [0, 0], travel: 0 }
}

/** Where each hand goes when it holds nothing: swinging with the stride, out for balance in the air, or on the risers or rungs. */
function freeHands(f: Frame, lower: Lower, roots: [Vec, Vec]): [Vec, Vec] {
  const { m, facing } = f
  if (m.mode === 'chute') return [0, 1].map((arm) => ({ x: roots[arm].x + (0.07 - arm * 0.08) * facing, y: roots[arm].y - 0.44 })) as [Vec, Vec]
  if (m.mode === 'ladder') {
    return [0, 1].map((arm) => {
      const q = frac(-m.feetY / RUNG_CYCLE + arm * 0.5)
      const step = stepAt(q, RUNG_CYCLE, 0.5)
      return { x: m.x + (0.15 - Math.sin(Math.PI * step.swing) * 0.08) * facing, y: m.feetY - LADDER_HANDS - step.along }
    }) as [Vec, Vec]
  }
  if (!m.onGround) {
    const falling = clamp01((m.vy + 3) / 8)
    return [swingHand(roots[0], lerp(1.1, 1.9, falling), 0.5, facing), swingHand(roots[1], lerp(-0.5, 1.2, falling), 0.6, facing)]
  }
  const gait = gaitFor(m.mode, f.speed)
  const breath = Math.sin(f.clock * 1.7) * 0.02
  // Each arm swings against the leg on its own side.
  return [0, 1].map((arm) => {
    const swing = -lower.along[arm] * gait.swing * lower.travel + 0.06 + breath + (m.mode === 'crouch' ? 0.35 : 0)
    return swingHand(roots[arm], swing, lerp(0.25, gait.elbow, lower.travel) + (m.mode === 'crouch' ? 0.4 : 0), facing)
  }) as [Vec, Vec]
}

type Upper = { arms: [Vec, Vec]; grip: Vec; gunAngle: number; hands: [number, number] | null }

/** Hands on the weapon. Calm guards carry it low; everyone else holds it on the aim line. */
function holdTool(f: Frame, hold: Hold, shoulder: Vec, lower: Lower): Upper {
  const { m, facing } = f
  const kick = m.kick
  const sway = Math.sin(4 * Math.PI * f.phase) * 0.035 * f.pace * lower.travel + Math.sin(f.clock * 1.7 + 0.5) * 0.008
  if (hold.carry === 'thrown') {
    // Cocked back ready to throw, the free arm pointing where it will go.
    const grip = { x: shoulder.x - 0.05 * facing, y: shoulder.y - 0.16 }
    const point = onLine(shoulder, m.aim, 0.38, 0, facing)
    return { arms: [grip, point], grip, gunAngle: m.aim, hands: [fromPitch(-1.3, facing), m.aim] }
  }
  if (hold.carry === 'coil') {
    // The coil hangs from the near hand at the hip, the other hand feeding the line off it.
    const grip = { x: shoulder.x + 0.14 * facing, y: shoulder.y + 0.5 }
    const angle = fromPitch(-1.2, facing)
    return { arms: [grip, onLine(grip, angle, hold.support.x, hold.support.y, facing)], grip, gunAngle: angle, hands: [angle, angle] }
  }
  if (hold.carry === 'device') {
    const grip = { x: shoulder.x + 0.2 * facing, y: shoulder.y + 0.22 }
    const angle = fromPitch(-0.35, facing)
    return { arms: [grip, onLine(grip, angle, hold.support.x, hold.support.y, facing)], grip, gunAngle: angle, hands: [angle, angle] }
  }
  if (!f.ready) {
    const low = hold.carry === 'pistol'
    const angle = fromPitch(low ? 1.25 : 0.55, facing)
    const grip = low ? { x: shoulder.x + 0.1 * facing, y: shoulder.y + 0.47 } : { x: shoulder.x + 0.12 * facing, y: shoulder.y + 0.3 }
    const support = onLine(grip, angle, hold.support.x, hold.support.y, facing)
    return { arms: [grip, support], grip, gunAngle: angle, hands: [angle, angle] }
  }
  const gunAngle = m.aim - facing * kick * hold.flip + facing * sway
  const grip = onLine(shoulder, gunAngle, hold.reach - kick * 0.05, hold.drop, facing)
  const support = onLine(grip, gunAngle, hold.support.x, hold.support.y, facing)
  return { arms: [grip, support], grip, gunAngle, hands: [gunAngle, gunAngle] }
}

/**
 * Builds a side-view skeleton. The step cycle is driven by distance travelled, so feet plant on the
 * ground and never slide; the gun points exactly along `aim` apart from recoil and a little sway.
 */
export function poseHuman(motion: Motion): Skeleton {
  const { facing, mode } = motion
  const speed = mode === 'stairs' ? Math.hypot(motion.vx, motion.vy) : Math.abs(motion.vx)
  const dir = Math.abs(motion.vx) > 0.05 ? Math.sign(motion.vx) : facing
  const tool = motion.held === undefined ? 'pistol' : motion.held
  const armed = tool !== null && mode !== 'ladder' && mode !== 'chute'
  const hold = armed ? HOLDS[tool] : null
  const frame: Frame = {
    m: motion, facing, dir, speed, pace: clamp01(speed / RUN_SPEED),
    phase: motion.stride ?? frac((motion.x * dir) / gaitFor(mode, speed).stride),
    clock: motion.clock ?? 0,
    ready: motion.alert ?? true,
    hold,
  }
  if (hold && hold.carry !== 'pistol' && hold.carry !== 'shouldered') frame.ready = true

  const grounded = motion.onGround || mode === 'stairs'
  const lower = mode === 'ladder' ? ladderLegs(frame)
    : mode === 'chute' ? chuteLegs(frame)
      : grounded ? groundLegs(frame) : airLegs(frame)

  const kick = motion.kick
  const flinch = motion.flinch ?? 0
  const land = motion.land ?? 0
  // Aiming steeply up leans the shoulders back; aiming down a hole in the floor bends the body over it.
  const steep = hold && frame.ready ? pitchOf(motion.aim, facing) : 0
  const bendDown = Math.max(0, steep - 0.6) * 0.3
  const bendBack = Math.max(0, -steep - 0.6) * 0.45
  const reachLean = facing * (bendDown - bendBack)
  const lean = lower.lean - facing * (kick * 0.06 + flinch * 0.22) + facing * land * 0.3 + reachLean
  const breath = Math.sin(frame.clock * 1.7) * 0.006
  const { hip } = lower
  // Recoil shoves the shoulders back before the hips follow.
  const shoulder = {
    x: hip.x + Math.sin(lean) * BONES.torso - facing * (kick * 0.035 + flinch * 0.03),
    y: hip.y - Math.cos(lean) * BONES.torso - breath,
  }
  // The neck holds the head steadier and more upright than the spine, and soaks up most of the step's rise and fall.
  const neckLean = lean * 0.45 + facing * (0.14 - flinch * 0.35 + (motion.cower ?? 0) * 0.3)
  const head = { x: shoulder.x + Math.sin(neckLean) * BONES.neck, y: shoulder.y - Math.cos(neckLean) * BONES.neck - lower.bob * 0.6 }

  // Shoulders turn against the hips.
  const twist = (arm: number) => -(lower.legs[arm].root.x - hip.x) * 0.8
  const roots: [Vec, Vec] = [{ x: shoulder.x + twist(0), y: shoulder.y }, { x: shoulder.x + twist(1), y: shoulder.y }]
  const free = freeHands(frame, lower, roots)
  let upper: Upper = { arms: free, grip: free[0], gunAngle: fromPitch(1.2, facing), hands: null }
  if (hold) {
    upper = holdTool(frame, hold, shoulder, lower)
    // A calm guard's pistol hangs in one hand; the other arm keeps swinging.
    if (!frame.ready && hold.carry === 'pistol') upper.arms[1] = free[1]
  }
  const arms = [0, 1].map((arm) => armLimb(roots[arm], upper.arms[arm], facing)) as [Limb, Limb]
  const along = (limb: Limb) => Math.atan2(limb.end.y - limb.joint.y, limb.end.x - limb.joint.x)
  const hands: [number, number] = upper.hands ?? [along(arms[0]), along(arms[1])]
  if (hold && !frame.ready && hold.carry === 'pistol') hands[1] = along(arms[1])

  const aimPitch = frame.ready && armed ? pitchOf(motion.aim, facing) : 0.12 + Math.sin(frame.clock * 0.37) * 0.08
  const lookPitch = (hold?.carry === 'device' ? 0.6 : Math.max(-0.72 + Math.min(0, lean * facing), Math.min(0.6 + bendDown, aimPitch))) - flinch * 0.5 + land * 0.2
  const body: Skeleton = {
    hip, shoulder, head, lean, legs: lower.legs, arms, grip: upper.grip, gunAngle: upper.gunAngle,
    pelvis: lower.pelvis, look: fromPitch(lookPitch, facing), hands, feet: lower.feet, armed, turn: mode === 'ladder' ? 1 : 0,
  }
  return motion.act ? applyAct(body, motion, motion.act) : body
}
