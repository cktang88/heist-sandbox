import { BoxGeometry, CapsuleGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, type Material } from 'three'
import { JOINT, type Ragdoll } from '../game/ragdoll'
import type { ToolId } from '../game/toolDefs'
import type { Vec } from '../game/types'
import type { Limb, Skeleton } from '../render/human/pose'

/** Which outfit a figure wears. */
export type Outfit = 'operative' | 'guard' | 'responder'

const fabric = (color: number, roughness = 0.9) => new MeshStandardMaterial({ color, roughness, metalness: 0 })
const SKIN = fabric(0xc99a78, 0.65)
const BLACK_KIT = new MeshStandardMaterial({ color: 0x0c0e11, roughness: 0.55, metalness: 0.3 })
const GUN_METAL = new MeshStandardMaterial({ color: 0x15171a, roughness: 0.38, metalness: 0.85 })
const WOOD_STOCK = fabric(0x4a2f1a, 0.6)
const OLIVE = fabric(0x3c4632, 0.8)
const BRASS = new MeshStandardMaterial({ color: 0xe8c96a, roughness: 0.3, metalness: 1 })
const GOGGLE_GLOW = new MeshStandardMaterial({ color: 0x0a1a0e, emissive: 0x39ff6a, emissiveIntensity: 6 })
const FLASH_WHITE = new MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2 })

type OutfitMaterials = { suit: Material; legs: Material; vest: Material | null; head: Material; hat: Material; hands: Material; boots: Material }
const OUTFITS: Record<Outfit, OutfitMaterials> = {
  operative: { suit: fabric(0x23282f), legs: fabric(0x1d2127), vest: fabric(0x2f3a2c, 0.75), head: fabric(0x14171b, 0.8), hat: fabric(0x30363a, 0.5), hands: BLACK_KIT, boots: BLACK_KIT },
  guard: { suit: fabric(0x4f6a90, 0.75), legs: fabric(0x1f283b), vest: null, head: SKIN, hat: fabric(0x161d30, 0.7), hands: SKIN, boots: BLACK_KIT },
  responder: { suit: fabric(0x2c323d), legs: fabric(0x22272f), vest: fabric(0x3d4656, 0.7), head: SKIN, hat: fabric(0x2a2f38, 0.45), hands: BLACK_KIT, boots: BLACK_KIT },
}

const LIMB = new CapsuleGeometry(1, 1, 5, 10)
const BALL = new SphereGeometry(1, 16, 12)
const DOME = new SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.55)
const BOX = new BoxGeometry(1, 1, 1)

function part(geometry: typeof LIMB | typeof BALL | typeof BOX, material: Material): Mesh {
  const mesh = new Mesh(geometry, material)
  mesh.castShadow = true
  return mesh
}

/** Stretches a capsule between two joints. Game y points down; the 3D world's y points up. */
function span(mesh: Mesh, from: Vec, to: Vec, z: number, radius: number): void {
  const dx = to.x - from.x
  const dy = -(to.y - from.y)
  const length = Math.hypot(dx, dy)
  mesh.position.set((from.x + to.x) / 2, -(from.y + to.y) / 2, z)
  mesh.rotation.z = Math.atan2(dy, dx) - Math.PI / 2
  // The unit capsule is 3 long (a 1-long tube plus two 1-radius caps).
  mesh.scale.set(radius, Math.max(0.01, length / 3 + radius * 0.3), radius)
}

function buildGun(held: ToolId): Group {
  const gun = new Group()
  const add = (material: Material, x: number, y: number, w: number, h: number, depth = 0.07) => {
    const piece = part(BOX, material)
    piece.scale.set(w, h, depth)
    piece.position.set(x + w / 2, -(y + h / 2), 0)
    gun.add(piece)
  }
  switch (held) {
    case 'pistol':
      add(GUN_METAL, -0.02, -0.06, 0.3, 0.11)
      add(BLACK_KIT, 0.28, -0.045, 0.32, 0.08, 0.06)
      add(GUN_METAL, 0, 0.02, 0.09, 0.17)
      break
    case 'rifle':
      add(BLACK_KIT, -0.32, -0.05, 0.34, 0.11)
      add(GUN_METAL, 0, -0.08, 0.5, 0.15)
      add(GUN_METAL, 0.5, -0.045, 0.28, 0.07, 0.05)
      add(BLACK_KIT, 0.76, -0.06, 0.22, 0.1, 0.08)
      add(GUN_METAL, 0.2, 0.05, 0.1, 0.22, 0.05)
      add(BLACK_KIT, 0.12, -0.15, 0.2, 0.07, 0.05)
      break
    case 'shotgun':
      add(WOOD_STOCK, -0.34, -0.03, 0.36, 0.13)
      add(GUN_METAL, 0, -0.08, 0.9, 0.1)
      add(WOOD_STOCK, 0.3, 0.02, 0.32, 0.08, 0.09)
      break
    case 'sniper':
      add(BLACK_KIT, -0.36, -0.04, 0.38, 0.12)
      add(GUN_METAL, 0, -0.07, 0.6, 0.13)
      add(GUN_METAL, 0.6, -0.035, 0.7, 0.06, 0.05)
      add(BLACK_KIT, 0.1, -0.18, 0.4, 0.09, 0.08)
      add(GUN_METAL, 0.22, 0.05, 0.09, 0.16, 0.05)
      break
    case 'rocket':
      add(OLIVE, -0.5, -0.11, 1.3, 0.2, 0.2)
      add(BLACK_KIT, -0.56, -0.14, 0.12, 0.26, 0.26)
      add(BLACK_KIT, 0.76, -0.13, 0.1, 0.24, 0.24)
      add(GUN_METAL, 0.1, 0.08, 0.09, 0.16)
      break
    case 'drill':
      add(fabric(0xc8862a, 0.5), -0.1, -0.1, 0.4, 0.2, 0.14)
      add(BRASS, 0.3, -0.035, 0.34, 0.07, 0.07)
      add(BLACK_KIT, 0, 0.08, 0.1, 0.17)
      break
    case 'c4':
      add(fabric(0xb9b08c, 0.8), 0, -0.08, 0.26, 0.18, 0.12)
      break
    case 'drone':
      add(BLACK_KIT, -0.02, -0.07, 0.26, 0.15, 0.1)
      break
    case 'smoke':
    case 'flash':
      add(held === 'smoke' ? OLIVE : GUN_METAL, 0, -0.07, 0.14, 0.2, 0.14)
      break
  }
  return gun
}

/** One 3D figure. It is posed every frame from the same skeleton the 2D game used. */
export class Figure {
  readonly group = new Group()
  private readonly look: OutfitMaterials
  private readonly limbs: Mesh[] = []
  private readonly torso: Mesh
  private readonly vest: Mesh | null
  private readonly head: Mesh
  private readonly hat: Mesh
  private readonly hands: Mesh[]
  private readonly boots: Mesh[]
  private readonly goggles: Mesh[] = []
  private readonly brim: Mesh | null
  private gun: Group | null = null
  private held: ToolId | null = null

  constructor(private readonly outfit: Outfit) {
    this.look = OUTFITS[outfit]
    // Order: far arm (2), far leg (2), near leg (2), near arm (2).
    for (let index = 0; index < 8; index += 1) {
      const isLeg = index >= 2 && index < 6
      this.limbs.push(part(LIMB, isLeg ? this.look.legs : this.look.suit))
    }
    this.torso = part(LIMB, this.look.suit)
    this.vest = this.look.vest ? part(BOX, this.look.vest) : null
    this.head = part(BALL, this.look.head)
    this.hat = part(DOME, this.look.hat)
    this.hands = [part(BALL, this.look.hands), part(BALL, this.look.hands)]
    this.boots = [part(BOX, this.look.boots), part(BOX, this.look.boots)]
    this.brim = outfit === 'guard' ? part(BOX, this.look.hat) : null
    if (outfit === 'operative') for (let index = 0; index < 3; index += 1) this.goggles.push(new Mesh(BALL, GOGGLE_GLOW))
    this.group.add(...this.limbs, this.torso, this.head, this.hat, ...this.hands, ...this.boots, ...this.goggles)
    if (this.vest) this.group.add(this.vest)
    if (this.brim) this.group.add(this.brim)
  }

  pose(body: Skeleton, facing: 1 | -1, held: ToolId | null, flash = false): void {
    const limb = (index: number, source: Limb, z: number, radius: number) => {
      span(this.limbs[index], source.root, source.joint, z, radius)
      span(this.limbs[index + 1], source.joint, source.end, z, radius * 0.88)
    }
    limb(0, body.arms[1], -0.2, 0.062)
    limb(2, body.legs[1], -0.09, 0.08)
    limb(4, body.legs[0], 0.09, 0.08)
    limb(6, body.arms[0], 0.2, 0.062)
    span(this.torso, body.hip, body.shoulder, 0, 0.165)
    this.torso.scale.z = 0.13

    const chest = { x: body.hip.x + (body.shoulder.x - body.hip.x) * 0.62, y: body.hip.y + (body.shoulder.y - body.hip.y) * 0.62 }
    if (this.vest) {
      this.vest.position.set(chest.x, -chest.y, 0)
      this.vest.rotation.z = -body.lean
      this.vest.scale.set(0.37, 0.42, 0.33)
    }
    this.head.position.set(body.head.x, -body.head.y, 0)
    this.head.scale.setScalar(0.15)
    this.hat.position.set(body.head.x, -body.head.y + 0.015, 0)
    this.hat.scale.setScalar(this.outfit === 'guard' ? 0.158 : 0.178)
    if (this.brim) {
      this.brim.position.set(body.head.x + facing * 0.14, -body.head.y + 0.06, 0)
      this.brim.scale.set(0.2, 0.03, 0.24)
    }
    this.goggles.forEach((light, index) => {
      light.position.set(body.head.x + facing * 0.15, -body.head.y + 0.02 + (index === 1 ? 0.035 : -0.01), (index - 1) * 0.07)
      light.scale.setScalar(0.022)
    })

    this.hands.forEach((hand, index) => {
      hand.position.set(body.arms[index].end.x, -body.arms[index].end.y, index === 0 ? 0.2 : -0.2)
      hand.scale.setScalar(0.065)
    })
    this.boots.forEach((boot, index) => {
      const foot = body.legs[index].end
      boot.position.set(foot.x + facing * 0.06, -foot.y + 0.045, index === 0 ? 0.09 : -0.09)
      boot.scale.set(0.26, 0.1, 0.13)
    })

    if (held !== this.held) {
      if (this.gun) this.group.remove(this.gun)
      this.gun = held ? buildGun(held) : null
      if (this.gun) this.group.add(this.gun)
      this.held = held
    }
    if (this.gun) {
      this.gun.position.set(body.grip.x, -body.grip.y, 0.16)
      this.gun.rotation.z = -body.gunAngle
      this.gun.scale.y = facing
    }
    this.limbs.forEach((mesh, index) => (mesh.material = flash ? FLASH_WHITE : index >= 2 && index < 6 ? this.look.legs : this.look.suit))
    this.torso.material = flash ? FLASH_WHITE : this.look.suit
  }

  /** Poses the figure from a limp body's joints. */
  poseRagdoll(ragdoll: Ragdoll): void {
    const at = (joint: number) => ragdoll.points[joint]
    const limb = (root: number, joint: number, end: number): Limb => ({ root: at(root), joint: at(joint), end: at(end) })
    const body: Skeleton = {
      hip: at(JOINT.hip), shoulder: at(JOINT.neck), head: at(JOINT.head),
      lean: Math.atan2(at(JOINT.neck).x - at(JOINT.hip).x, at(JOINT.hip).y - at(JOINT.neck).y),
      legs: [limb(JOINT.hip, JOINT.kneeA, JOINT.footA), limb(JOINT.hip, JOINT.kneeB, JOINT.footB)],
      arms: [limb(JOINT.neck, JOINT.elbowA, JOINT.handA), limb(JOINT.neck, JOINT.elbowB, JOINT.handB)],
      grip: at(JOINT.handA), gunAngle: 0,
    }
    this.pose(body, 1, null)
  }
}
