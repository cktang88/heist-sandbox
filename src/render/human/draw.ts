import { JOINT, type Ragdoll } from '../../game/ragdoll'
import type { ToolId } from '../../game/toolDefs'
import type { Vec } from '../../game/types'
import type { Limb, Skeleton } from './pose'

type Ctx = CanvasRenderingContext2D

/** Colours and kit for one kind of person. */
export type Look = { kit: 'operative' | 'guard'; suit: string; limbs: string; vest: string; skin: string; boots: string }

export const OPERATIVE: Look = { kit: 'operative', suit: '#2b313a', limbs: '#242a32', vest: '#3d4a3c', skin: '#1b1f25', boots: '#12151a' }
export const RESPONDER: Look = { kit: 'operative', suit: '#39414f', limbs: '#2a303b', vest: '#4a5568', skin: '#e2bd9c', boots: '#12151a' }
export const GUARD: Look = { kit: 'guard', suit: '#7fa0c8', limbs: '#2c3850', vest: '#7fa0c8', skin: '#e2bd9c', boots: '#14171c' }

const OUTLINE = '#07090d'
const LIMB_WIDTH = 0.13

function line(c: Ctx, from: Vec, to: Vec, width: number, color: string): void {
  c.strokeStyle = color
  c.lineWidth = width
  c.beginPath()
  c.moveTo(from.x, from.y)
  c.lineTo(to.x, to.y)
  c.stroke()
}

function darker(hex: string, amount: number): string {
  const value = parseInt(hex.slice(1), 16)
  const channel = (shift: number) => Math.round(((value >> shift) & 255) * (1 - amount))
  return `rgb(${channel(16)},${channel(8)},${channel(0)})`
}

/** A two-part limb with a dark rim, so it reads against any background. */
function limb(c: Ctx, part: Limb, color: string, width = LIMB_WIDTH): void {
  for (const [pad, tone] of [[0.07, OUTLINE], [0, color]] as const) {
    c.strokeStyle = tone
    c.lineWidth = width + pad
    c.beginPath()
    c.moveTo(part.root.x, part.root.y)
    c.lineTo(part.joint.x, part.joint.y)
    c.lineTo(part.end.x, part.end.y)
    c.stroke()
  }
}

/** Draws a person from a skeleton. Far-side limbs are darker, which gives the flat figure depth. */
export function drawHuman(c: Ctx, body: Skeleton, facing: 1 | -1, look: Look, held: ToolId | null): void {
  c.lineCap = 'round'
  c.lineJoin = 'round'
  limb(c, body.arms[1], darker(look.limbs, 0.3))
  limb(c, body.legs[1], darker(look.limbs, 0.3), LIMB_WIDTH + 0.02)
  boot(c, body.legs[1].end, facing, look)

  // Torso, then the vest or shirt details over it.
  line(c, body.hip, body.shoulder, 0.38, OUTLINE)
  line(c, body.hip, body.shoulder, 0.31, look.suit)
  const chest = mix(body.hip, body.shoulder, 0.62)
  if (look.kit === 'operative') {
    line(c, mix(body.hip, body.shoulder, 0.3), mix(body.hip, body.shoulder, 0.95), 0.36, look.vest)
    line(c, { x: chest.x + facing * 0.12, y: chest.y + 0.1 }, { x: chest.x + facing * 0.2, y: chest.y + 0.1 }, 0.14, darker(look.vest, 0.3))
    line(c, { x: chest.x - facing * 0.2, y: chest.y - 0.05 }, { x: chest.x - facing * 0.22, y: chest.y + 0.15 }, 0.16, darker(look.vest, 0.45))
  } else {
    line(c, { x: chest.x + facing * 0.12, y: chest.y - 0.12 }, { x: chest.x + facing * 0.12, y: chest.y + 0.12 }, 0.05, '#1c2333')
    line(c, { x: body.hip.x - 0.14, y: body.hip.y - 0.04 }, { x: body.hip.x + 0.14, y: body.hip.y - 0.04 }, 0.07, '#11151d')
  }

  head(c, body.head, facing, look)
  if (body.offHand) drawShield(c, body.offHand.at)
  limb(c, body.legs[0], look.limbs, LIMB_WIDTH + 0.02)
  boot(c, body.legs[0].end, facing, look)

  if (held && body.armed) drawGun(c, body.grip, body.gunAngle, facing, held)
  limb(c, body.arms[0], look.kit === 'operative' ? look.suit : look.suit)
  c.fillStyle = look.kit === 'operative' ? '#11141a' : look.skin
  for (const part of body.arms) {
    c.beginPath()
    c.arc(part.end.x, part.end.y, 0.07, 0, Math.PI * 2)
    c.fill()
  }
}

/** A ballistic shield seen from the side, turned a little toward the viewer: a dark slab with a small window. */
function drawShield(c: Ctx, at: Vec): void {
  c.fillStyle = OUTLINE
  c.fillRect(at.x - 0.17, at.y - 0.53, 0.34, 1.06)
  c.fillStyle = '#23272c'
  c.fillRect(at.x - 0.14, at.y - 0.5, 0.28, 1)
  c.fillStyle = '#7fa8c0'
  c.fillRect(at.x - 0.09, at.y - 0.36, 0.18, 0.1)
  c.fillStyle = '#d8d8d0'
  c.fillRect(at.x - 0.14, at.y - 0.02, 0.28, 0.06)
}

/** Draws a limp body straight from its joints. */
export function drawRagdoll(c: Ctx, ragdoll: Ragdoll, look: Look): void {
  c.lineCap = 'round'
  c.lineJoin = 'round'
  const at = (joint: number) => ragdoll.points[joint]
  const part = (root: number, joint: number, end: number): Limb => ({ root: at(root), joint: at(joint), end: at(end) })
  limb(c, part(JOINT.neck, JOINT.elbowB, JOINT.handB), darker(look.suit, 0.3))
  limb(c, part(JOINT.hip, JOINT.kneeB, JOINT.footB), darker(look.limbs, 0.3), LIMB_WIDTH + 0.02)
  line(c, at(JOINT.hip), at(JOINT.neck), 0.38, OUTLINE)
  line(c, at(JOINT.hip), at(JOINT.neck), 0.31, look.suit)
  c.fillStyle = OUTLINE
  c.beginPath()
  c.arc(at(JOINT.head).x, at(JOINT.head).y, 0.19, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = look.skin
  c.beginPath()
  c.arc(at(JOINT.head).x, at(JOINT.head).y, 0.155, 0, Math.PI * 2)
  c.fill()
  limb(c, part(JOINT.hip, JOINT.kneeA, JOINT.footA), look.limbs, LIMB_WIDTH + 0.02)
  limb(c, part(JOINT.neck, JOINT.elbowA, JOINT.handA), look.suit)
}

function mix(from: Vec, to: Vec, amount: number): Vec {
  return { x: from.x + (to.x - from.x) * amount, y: from.y + (to.y - from.y) * amount }
}

function boot(c: Ctx, foot: Vec, facing: number, look: Look): void {
  line(c, foot, { x: foot.x + facing * 0.13, y: foot.y }, 0.13, look.boots)
}

function head(c: Ctx, at: Vec, facing: number, look: Look): void {
  const radius = 0.155
  c.fillStyle = OUTLINE
  c.beginPath()
  c.arc(at.x, at.y, radius + 0.035, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = look.skin
  c.beginPath()
  c.arc(at.x, at.y, radius, 0, Math.PI * 2)
  c.fill()

  if (look.kit === 'operative') {
    // High-cut helmet, ear cup and a night-vision pod over the eyes.
    c.fillStyle = '#3a4046'
    c.beginPath()
    c.arc(at.x, at.y - 0.02, radius + 0.03, Math.PI * 1.02, Math.PI * 1.98)
    c.fill()
    c.fillStyle = '#15181d'
    c.fillRect(at.x - facing * 0.11 - 0.05, at.y - 0.03, 0.1, 0.13)
    c.fillRect(at.x + facing * 0.08 - (facing < 0 ? 0.14 : 0), at.y - 0.06, 0.14, 0.1)
    return
  }
  c.fillStyle = '#1e2740'
  c.beginPath()
  c.arc(at.x, at.y - 0.04, radius + 0.02, Math.PI * 1.05, Math.PI * 1.95)
  c.fill()
  c.fillRect(at.x + (facing > 0 ? 0 : -0.26), at.y - 0.09, 0.26, 0.05)
}

/** Where an operative's goggle lights sit, for the glow pass. */
export function goggleLights(body: Skeleton, facing: number): Vec[] {
  return [0.12, 0.17, 0.22].map((reach, index) => ({ x: body.head.x + facing * reach, y: body.head.y - 0.035 + (index === 1 ? -0.03 : 0.02) }))
}

/** Where the muzzle of the held weapon is, so flashes and tracers can start at the barrel. */
export function muzzleOf(body: Skeleton, held: ToolId): Vec {
  const length = GUN_LENGTH[held]
  return { x: body.grip.x + Math.cos(body.gunAngle) * length, y: body.grip.y + Math.sin(body.gunAngle) * length }
}

const GUN_LENGTH: Record<ToolId, number> = {
  pistol: 0.6, rifle: 0.95, shotgun: 0.9, sniper: 1.3, rocket: 0.85, c4: 0.2, drill: 0.6, drone: 0.2, smoke: 0.2, flash: 0.2, frag: 0.2, rope: 0.2, grapple: 0.65,
}

function drawGun(c: Ctx, grip: Vec, angle: number, facing: number, held: ToolId): void {
  c.save()
  c.translate(grip.x, grip.y)
  c.rotate(angle)
  if (facing < 0) c.scale(1, -1)
  const metal = '#0d0f13'
  const part = (x: number, y: number, w: number, h: number, color = metal) => {
    c.fillStyle = color
    c.fillRect(x, y, w, h)
  }
  switch (held) {
    case 'pistol':
      part(-0.02, -0.06, 0.3, 0.11)
      part(0.28, -0.045, 0.32, 0.08, '#1d2026')
      part(0, 0.02, 0.09, 0.17)
      break
    case 'rifle':
      part(-0.32, -0.05, 0.34, 0.11)
      part(0, -0.08, 0.5, 0.15)
      part(0.5, -0.045, 0.28, 0.07)
      part(0.76, -0.06, 0.2, 0.1, '#1d2026')
      part(0.2, 0.05, 0.1, 0.22)
      part(0.12, -0.14, 0.2, 0.06, '#232830')
      break
    case 'shotgun':
      part(-0.34, -0.03, 0.36, 0.13, '#4a3320')
      part(0, -0.08, 0.9, 0.1)
      part(0.3, 0.02, 0.32, 0.08, '#4a3320')
      break
    case 'sniper':
      part(-0.36, -0.04, 0.38, 0.12)
      part(0, -0.07, 0.6, 0.13)
      part(0.6, -0.035, 0.7, 0.06)
      part(0.1, -0.17, 0.4, 0.08, '#232830')
      part(0.22, 0.05, 0.09, 0.16)
      break
    case 'rocket':
      part(-0.5, -0.11, 1.3, 0.2, '#48553f')
      part(-0.56, -0.14, 0.12, 0.26, '#2f3829')
      part(0.76, -0.13, 0.1, 0.24, '#2f3829')
      part(0.1, 0.08, 0.09, 0.16)
      break
    case 'drill':
      part(-0.1, -0.1, 0.4, 0.2, '#c8862a')
      part(0.3, -0.035, 0.34, 0.07, '#aab3be')
      part(0, 0.08, 0.1, 0.17)
      break
    case 'c4':
      part(0, -0.08, 0.26, 0.18, '#b9b08c')
      part(0.08, -0.03, 0.1, 0.07, '#c4352b')
      break
    case 'smoke':
    case 'flash':
      part(0, -0.08, 0.14, 0.2, '#48553f')
      break
    case 'frag':
      part(-0.02, -0.08, 0.18, 0.16, '#3c4430')
      part(0.14, -0.04, 0.05, 0.08)
      break
    case 'rope':
      c.strokeStyle = '#b59a62'
      c.lineWidth = 0.06
      c.beginPath()
      c.arc(0.14, 0, 0.13, 0, Math.PI * 2)
      c.stroke()
      break
    case 'grapple':
      part(-0.02, -0.07, 0.3, 0.13, '#2f3438')
      part(0.28, -0.08, 0.2, 0.15, '#1d2026')
      part(0.48, -0.1, 0.12, 0.04, '#aab3be')
      part(0.48, 0.05, 0.12, 0.04, '#aab3be')
      part(0, 0.04, 0.09, 0.16)
      break
    case 'drone':
      part(-0.02, -0.07, 0.26, 0.15, '#252a33')
      part(0.2, -0.2, 0.03, 0.14, '#8a93a0')
      break
  }
  c.restore()
}
