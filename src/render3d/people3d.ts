import { Group, Mesh, type BufferGeometry, type Material } from 'three'
import { JOINT, type Ragdoll } from '../game/ragdoll'
import type { ToolId } from '../game/toolDefs'
import type { Vec } from '../game/types'
import { advanceStride, BONES, poseHuman, type Limb, type Motion, type Skeleton } from '../render/human/pose'
import { bodyParts } from './people/body'
import type { Outfit } from './people/looks'
import { FAR_SURFACE, HIT_SURFACE, NEAR_SURFACE } from './people/surface'
import { shieldGeometry, weaponGeometry } from './people/weapons'

export type { Outfit } from './people/looks'
export { outfitFor, weaponFor } from './people/looks'

/** How far each limb sits from the body's centre line, toward the camera (near) or away (far). */
const ARM_Z = 0.19
const LEG_Z = 0.085
const WEAPON_Z = 0.21
/** A shield is carried out in front of the body, just on the camera side of its middle. */
const SHIELD_Z = 0.03
/** Climbing a ladder, the body turns its back to the camera and steps back toward the rungs. */
const LADDER_DEPTH = -0.38
/** A landing hard enough to squash the legs, and how long the squash and a hit flinch last. */
const HARD_LANDING_SPEED = 6
const SQUASH_SECONDS = 0.28
const FLINCH_SECONDS = 0.22

/** Angle relative to straight ahead for someone facing `facing`, positive downward. */
function pitchOf(angle: number, facing: number): number {
  const relative = facing > 0 ? angle : Math.PI - angle
  return Math.atan2(Math.sin(relative), Math.cos(relative))
}

type Memory = { x: number; feetY: number; clock: number; onGround: boolean; vy: number; flash: boolean }

/** One 3D figure. It is posed every frame from the same skeleton the 2D game used. */
export class Figure {
  readonly group = new Group()
  /** Holds every part; turning it lets a climber face the ladder. */
  private readonly body = new Group()
  private readonly head: Mesh
  private readonly torso: Mesh
  private readonly pelvis: Mesh
  private readonly upperArms: [Mesh, Mesh]
  private readonly forearms: [Mesh, Mesh]
  private readonly thighs: [Mesh, Mesh]
  private readonly shins: [Mesh, Mesh]
  private readonly boots: [Mesh, Mesh]
  private readonly weapon: Mesh
  private readonly meshes: Mesh[]
  private readonly far: Set<Mesh>
  private held: ToolId | null = null
  private flashing = false
  private origin = 0
  private stride = 0
  private squash = 0
  private flinch = 0
  private memory: Memory | null = null
  /** Made only for people who ever need them, so everyone else keeps to the usual draw calls. */
  private shield: Mesh | null = null
  private dropped: { mesh: Mesh; tool: ToolId } | null = null
  private limp: { ragdoll: Ragdoll; facing: 1 | -1; body: Skeleton } | null = null

  constructor(readonly outfit: Outfit) {
    const parts = bodyParts(outfit)
    const part = (geometry: BufferGeometry, material: Material = NEAR_SURFACE) => {
      const mesh = new Mesh(geometry, material)
      mesh.castShadow = true
      return mesh
    }
    this.head = part(parts.head)
    this.torso = part(parts.torso)
    this.pelvis = part(parts.pelvis)
    this.upperArms = [part(parts.upperArm), part(parts.upperArm, FAR_SURFACE)]
    this.forearms = [part(parts.forearm), part(parts.forearm, FAR_SURFACE)]
    this.thighs = [part(parts.thighNear), part(parts.thighFar, FAR_SURFACE)]
    this.shins = [part(parts.shin), part(parts.shin, FAR_SURFACE)]
    this.boots = [part(parts.boot), part(parts.boot, FAR_SURFACE)]
    this.weapon = part(weaponGeometry('pistol'))
    this.weapon.visible = false
    this.far = new Set([this.upperArms[1], this.forearms[1], this.thighs[1], this.shins[1], this.boots[1]])
    // Far limbs first so near ones draw over them where they cross.
    this.meshes = [
      this.upperArms[1], this.forearms[1], this.thighs[1], this.shins[1], this.boots[1],
      this.pelvis, this.torso, this.head,
      this.thighs[0], this.shins[0], this.boots[0], this.weapon, this.upperArms[0], this.forearms[0],
    ]
    this.body.add(...this.meshes)
    this.group.add(this.body)
  }

  /** Lays a part from joint `from` toward joint `to`. Parts are built hanging along -y at rest length `rest`. */
  private span(mesh: Mesh, from: Vec, to: Vec, z: number, rest: number, facing: number): void {
    const dx = to.x - from.x
    const dy = from.y - to.y
    mesh.position.set(from.x - this.origin, -from.y, z)
    mesh.rotation.z = Math.atan2(dx, -dy)
    mesh.scale.set(facing, Math.hypot(dx, dy) / rest, 1)
  }

  /** Puts a rigid part at `at`, turned so its forward axis points along `angle` (game radians). */
  private aim(mesh: Mesh, at: Vec, z: number, angle: number, facing: number): void {
    mesh.position.set(at.x - this.origin, -at.y, z)
    mesh.rotation.z = -pitchOf(angle, facing) * facing
    mesh.scale.set(facing, 1, 1)
  }

  pose(body: Skeleton, facing: 1 | -1, held: ToolId | null, flash = false): void {
    this.origin = body.hip.x
    this.body.position.set(body.hip.x, 0, LADDER_DEPTH * body.turn)
    this.body.rotation.y = facing * (Math.PI / 2) * body.turn

    for (const side of [0, 1] as const) {
      const sign = side === 0 ? 1 : -1
      const arm = body.arms[side]
      const leg = body.legs[side]
      this.span(this.upperArms[side], arm.root, arm.joint, ARM_Z * sign, BONES.upperArm, facing)
      this.span(this.forearms[side], arm.joint, arm.end, ARM_Z * sign, BONES.forearm, facing)
      this.span(this.thighs[side], leg.root, leg.joint, LEG_Z * sign, BONES.upperLeg, facing)
      this.span(this.shins[side], leg.joint, leg.end, LEG_Z * sign, BONES.lowerLeg, facing)
      const boot = this.boots[side]
      boot.position.set(leg.end.x - this.origin, -leg.end.y, LEG_Z * sign)
      boot.rotation.z = -body.feet[side] * facing
      boot.scale.set(facing, 1, 1)
    }
    this.span(this.torso, body.shoulder, body.hip, 0, BONES.torso, facing)
    this.pelvis.position.set(0, -body.hip.y, 0)
    this.pelvis.rotation.z = -body.pelvis
    this.pelvis.scale.set(facing, 1, 1)
    this.aim(this.head, body.head, 0, body.look, facing)

    if (held !== this.held) {
      if (held) this.weapon.geometry = weaponGeometry(held)
      this.held = held
    }
    this.weapon.visible = held !== null && body.armed
    if (this.weapon.visible) this.aim(this.weapon, body.grip, WEAPON_Z, body.hands[0], facing)

    this.poseShield(body, facing)

    if (flash !== this.flashing) {
      this.flashing = flash
      for (const mesh of this.meshes) mesh.material = flash ? HIT_SURFACE : this.far.has(mesh) ? FAR_SURFACE : NEAR_SURFACE
    }
  }

  private poseShield(body: Skeleton, facing: 1 | -1): void {
    const at = body.offHand?.at
    if (at && !this.shield) {
      this.shield = new Mesh(shieldGeometry(), NEAR_SURFACE)
      this.shield.castShadow = true
      this.body.add(this.shield)
    }
    if (!this.shield) return
    this.shield.visible = Boolean(at)
    if (!at) return
    this.shield.position.set(at.x - this.origin, -at.y, SHIELD_Z)
    this.shield.scale.set(facing, 1, 1)
  }

  /** The weapon a man let go of, lying on the floor where he dropped it; `at` is null while he holds it. */
  showDropped(at: Vec | null, tool: ToolId | null): void {
    if (!at || !tool) {
      if (this.dropped) this.dropped.mesh.visible = false
      return
    }
    if (!this.dropped) {
      const mesh = new Mesh(weaponGeometry(tool), NEAR_SURFACE)
      this.group.add(mesh)
      this.dropped = { mesh, tool }
    }
    if (this.dropped.tool !== tool) this.dropped = { mesh: Object.assign(this.dropped.mesh, { geometry: weaponGeometry(tool) }), tool }
    const { mesh } = this.dropped
    mesh.visible = true
    mesh.position.set(at.x, -at.y + 0.05, 0.1)
    mesh.rotation.z = 0.08
  }

  /**
   * Works out the skeleton from `motion` and poses the figure. Unlike `poseHuman` alone, it remembers the
   * last frame: the step cycle follows the distance actually travelled (so strides lengthen with speed
   * without feet sliding), hard landings squash the legs and a hit makes the body flinch.
   */
  animate(motion: Motion, held: ToolId | null, flash = false): Skeleton {
    const clock = motion.clock ?? 0
    const last = this.memory
    const dt = last ? Math.max(0, Math.min(0.1, clock - last.clock)) : 0
    let { vx, vy } = motion
    // Staircases move people directly, so their speed has to be measured.
    if (last && motion.mode === 'stairs' && dt > 0) {
      vx = (motion.x - last.x) / dt
      vy = (motion.feetY - last.feetY) / dt
    }
    const moved = last ? Math.hypot(motion.x - last.x, motion.mode === 'stairs' ? motion.feetY - last.feetY : 0) : 0
    const speed = motion.mode === 'stairs' ? Math.hypot(vx, vy) : Math.abs(vx)
    // A jump of more than a tile in one frame is a teleport, not a step.
    if (moved < 1) this.stride = advanceStride(this.stride, moved, speed, motion.mode)
    if (last && !last.onGround && motion.onGround && last.vy > HARD_LANDING_SPEED) this.squash = Math.min(1, (last.vy - 3) / 12)
    if (flash && !(last?.flash ?? false)) this.flinch = 1
    this.squash = Math.max(0, this.squash - dt / SQUASH_SECONDS)
    this.flinch = Math.max(0, this.flinch - dt / FLINCH_SECONDS)
    const memory = this.memory ?? (this.memory = { x: 0, feetY: 0, clock: 0, onGround: false, vy: 0, flash: false })
    Object.assign(memory, { x: motion.x, feetY: motion.feetY, clock, onGround: motion.onGround, vy: motion.vy, flash })

    const body = poseHuman({
      ...motion, vx, vy, held, stride: this.stride,
      land: Math.sin(this.squash * Math.PI * 0.5), flinch: Math.sin(this.flinch * Math.PI * 0.5),
    })
    this.pose(body, motion.facing, held, flash)
    return body
  }

  /** Poses the figure from a limp body's joints. */
  poseRagdoll(ragdoll: Ragdoll): void {
    if (this.limp?.ragdoll !== ragdoll) this.limp = { ragdoll, facing: limpFacing(ragdoll), body: limpSkeleton(ragdoll) }
    const { facing, body } = this.limp
    const at = (joint: number) => ragdoll.points[joint]
    const neck = at(JOINT.neck)
    const hip = at(JOINT.hip)
    const head = at(JOINT.head)
    body.lean = Math.atan2(neck.x - hip.x, hip.y - neck.y)
    body.pelvis = body.lean
    body.look = Math.atan2(head.y - neck.y, head.x - neck.x) + facing * (Math.PI / 2)
    for (const side of [0, 1] as const) {
      const arm = body.arms[side]
      body.hands[side] = Math.atan2(arm.end.y - arm.joint.y, arm.end.x - arm.joint.x)
      // The ankle stays stiff: the boot turns with the shin.
      const leg = body.legs[side]
      body.feet[side] = -Math.atan2(leg.end.x - leg.joint.x, leg.end.y - leg.joint.y) * facing
    }
    this.pose(body, facing, null, false)
  }
}

/** A limp body keeps facing the way its knees bend. */
function limpFacing(ragdoll: Ragdoll): 1 | -1 {
  const p = ragdoll.points
  const bend = (knee: number, foot: number) => (p[foot].x - p[JOINT.hip].x) * (p[knee].y - p[JOINT.hip].y) - (p[foot].y - p[JOINT.hip].y) * (p[knee].x - p[JOINT.hip].x)
  return bend(JOINT.kneeA, JOINT.footA) + bend(JOINT.kneeB, JOINT.footB) <= 0 ? 1 : -1
}

/** A skeleton that points straight at the ragdoll's joints, so it follows them without copying. */
function limpSkeleton(ragdoll: Ragdoll): Skeleton {
  const p = ragdoll.points
  const limb = (root: number, joint: number, end: number): Limb => ({ root: p[root], joint: p[joint], end: p[end] })
  return {
    hip: p[JOINT.hip], shoulder: p[JOINT.neck], head: p[JOINT.head], lean: 0,
    legs: [limb(JOINT.hip, JOINT.kneeA, JOINT.footA), limb(JOINT.hip, JOINT.kneeB, JOINT.footB)],
    arms: [limb(JOINT.neck, JOINT.elbowA, JOINT.handA), limb(JOINT.neck, JOINT.elbowB, JOINT.handB)],
    grip: p[JOINT.handA], gunAngle: 0, pelvis: 0, look: 0, hands: [0, 0], feet: [0, 0], armed: false, turn: 0,
  }
}
