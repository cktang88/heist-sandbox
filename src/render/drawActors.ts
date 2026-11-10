import { guardMood, type Guard } from '../game/guards'
import { TOOLS } from '../game/toolDefs'
import { handOf } from '../game/tools'
import { centerOf, type Vec } from '../game/types'
import type { World } from '../game/world'
import { tracePolygon, visionCone } from './cone'
import { drawHuman, drawRagdoll, goggleLights, GUARD, OPERATIVE, RESPONDER, type Look } from './human/draw'
import { poseHuman, type Motion, type Skeleton } from './human/pose'
import { lampIsLit } from './lighting'
import { paintTile } from './tileArt'

const CONE_COLORS = { calm: 'rgba(255,255,255,0.05)', suspicious: 'rgba(255,210,63,0.12)', alert: 'rgba(255,45,61,0.14)' } as const
const HIT_LOOK: Look = { ...GUARD, suit: '#ffffff', limbs: '#ffffff', vest: '#ffffff', skin: '#ffffff' }
const DEAD_LOOK: Look = { ...GUARD, suit: '#5d7391', skin: '#b89a80' }

export function drawGuard(context: CanvasRenderingContext2D, world: World, guard: Guard): void {
  const feet = { x: guard.x + guard.w / 2, y: guard.y + guard.h }
  const mood = guardMood(guard)
  if (mood === 'dead') {
    if (guard.ragdoll) drawRagdoll(context, guard.ragdoll, guard.armored ? RESPONDER : DEAD_LOOK)
    return
  }

  tracePolygon(context, visionCone(world, guard))
  context.fillStyle = CONE_COLORS[mood]
  context.fill()

  // A fighting guard aims where he believes the player is, not where the player really is.
  const relaxed = guard.facing > 0 ? 0.35 : Math.PI - 0.35
  const aim = mood === 'alert' && guard.target ? Math.atan2(guard.target.y - (guard.y + 0.5), guard.target.x - feet.x) : relaxed
  const motion: Motion = { x: feet.x, feetY: feet.y, facing: guard.facing, vx: guard.vx, vy: guard.vy, onGround: guard.onGround, mode: guard.climbing ? 'ladder' : guard.crouching ? 'crouch' : 'normal', aim, kick: guard.kick }
  drawHuman(context, poseHuman(motion), guard.facing, guard.hitFlash > 0 ? HIT_LOOK : guard.armored ? RESPONDER : GUARD, guard.armored ? 'rifle' : 'pistol')

  if (guard.awareness > 0.05 && mood !== 'alert') {
    context.fillStyle = 'rgba(0,0,0,0.6)'
    context.fillRect(feet.x - 0.5, guard.y - 0.55, 1, 0.14)
    context.fillStyle = '#ffd23f'
    context.fillRect(feet.x - 0.5, guard.y - 0.55, guard.awareness, 0.14)
  }
}

/** Alert marks float above the dark, so the player can always read a guard's mood. */
export function drawGuardMarks(context: CanvasRenderingContext2D, world: World): void {
  for (const guard of world.guards) {
    const mood = guardMood(guard)
    if (mood === 'alert') label(context, '!', guard.x + guard.w / 2, guard.y - 0.3, '#ff2d3d')
    else if (mood === 'suspicious') label(context, '?', guard.x + guard.w / 2, guard.y - 0.7, '#ffd23f')
  }
}

let playerBody: Skeleton | null = null

export function drawPlayer(context: CanvasRenderingContext2D, world: World, aim: Vec): void {
  const player = world.player
  const feet = { x: player.x + player.w / 2, y: player.y + player.h }
  const hand = handOf(world)
  const motion: Motion = {
    x: feet.x, feetY: feet.y, facing: player.facing, vx: player.vx, vy: player.vy, onGround: player.onGround,
    mode: player.chute ? 'chute' : player.onLadder ? 'ladder' : 'normal',
    aim: Math.atan2(aim.y - hand.y, aim.x - hand.x), kick: player.kick,
  }
  const body = poseHuman(motion)
  playerBody = body

  if (player.chute) drawParachute(context, body)
  if (player.hasLoot) {
    context.fillStyle = '#ffd23f'
    context.fillRect(body.shoulder.x - player.facing * 0.42 - 0.15, body.shoulder.y + 0.05, 0.3, 0.45)
  }
  drawHuman(context, body, player.facing, OPERATIVE, world.drone ? 'drone' : TOOLS[player.tool].id)

  if (player.pick > 0) {
    context.fillStyle = 'rgba(0,0,0,0.6)'
    context.fillRect(feet.x - 0.75, player.y - 0.5, 1.5, 0.18)
    context.fillStyle = '#39ff6a'
    context.fillRect(feet.x - 0.75, player.y - 0.5, 1.5 * player.pick, 0.18)
  }
}

function drawParachute(context: CanvasRenderingContext2D, body: Skeleton): void {
  const top = body.shoulder.y - 3
  const centre = body.shoulder.x
  context.strokeStyle = 'rgba(220,225,235,0.55)'
  context.lineWidth = 0.03
  for (const offset of [-1.9, -1, 0, 1, 1.9]) {
    context.beginPath()
    context.moveTo(centre + offset, top + 1.1)
    context.lineTo(body.arms[offset < 0 ? 1 : 0].end.x, body.arms[0].end.y)
    context.stroke()
  }
  const canopy = context.createLinearGradient(0, top, 0, top + 1.2)
  canopy.addColorStop(0, '#5c6b54')
  canopy.addColorStop(1, '#2f3a2c')
  context.fillStyle = canopy
  context.beginPath()
  context.moveTo(centre - 2, top + 1.15)
  context.bezierCurveTo(centre - 1.9, top - 0.3, centre + 1.9, top - 0.3, centre + 2, top + 1.15)
  for (let scallop = 3; scallop >= 0; scallop -= 1) {
    context.quadraticCurveTo(centre - 1.5 + scallop, top + 0.85, centre - 2 + scallop, top + 1.15)
  }
  context.fill()
}

/** The operative's three green goggle lights, visible even in pitch dark. */
export function drawGoggles(context: CanvasRenderingContext2D, world: World): void {
  if (!playerBody) return
  context.fillStyle = '#39ff6a'
  for (const light of goggleLights(playerBody, world.player.facing)) {
    context.globalAlpha = 0.35
    context.beginPath()
    context.arc(light.x, light.y, 0.09, 0, Math.PI * 2)
    context.fill()
    context.globalAlpha = 1
    context.beginPath()
    context.arc(light.x, light.y, 0.032, 0, Math.PI * 2)
    context.fill()
  }
}

/** Ceiling fittings and street-light poles. The glow itself is added by the lighting pass. */
export function drawLamps(context: CanvasRenderingContext2D, world: World): void {
  for (const lamp of world.lamps) {
    context.fillStyle = '#2a2f3a'
    if (lamp.hung) context.fillRect(lamp.x - 0.05, lamp.y - 0.25, 0.1, 0.25)
    else context.fillRect(lamp.x - 0.09, lamp.y, 0.18, 5.5)
    context.fillRect(lamp.x - 0.4, lamp.y - 0.08, 0.8, 0.16)
    context.fillStyle = lampIsLit(world, lamp) ? '#fff2cf' : '#3a3f4a'
    context.fillRect(lamp.x - 0.3, lamp.y + 0.06, 0.6, 0.1)
  }
}

export function drawThings(context: CanvasRenderingContext2D, world: World): void {
  const { extraction, loot } = world
  const van = { x: extraction.x + 0.8, y: extraction.y + 1.5 }
  context.fillStyle = '#2b3340'
  context.beginPath()
  context.roundRect(van.x, van.y, 6, 2, 0.25)
  context.fill()
  context.fillStyle = '#394557'
  context.beginPath()
  context.roundRect(van.x + 4.2, van.y + 0.25, 1.6, 0.8, 0.12)
  context.fill()
  context.fillStyle = '#0c0e12'
  for (const wheel of [1.2, 4.8]) {
    context.beginPath()
    context.arc(van.x + wheel, van.y + 2.05, 0.45, 0, Math.PI * 2)
    context.fill()
  }

  if (!loot.taken) {
    context.fillStyle = '#b8901f'
    context.beginPath()
    context.roundRect(loot.x, loot.y + 0.15, loot.w, loot.h - 0.15, 0.08)
    context.fill()
    context.fillStyle = '#ffd23f'
    context.fillRect(loot.x + 0.05, loot.y + 0.25, loot.w - 0.1, 0.12)
    context.strokeStyle = '#6b5210'
    context.lineWidth = 0.06
    context.strokeRect(loot.x + 0.28, loot.y + 0.02, 0.24, 0.14)
  }

  for (const charge of world.charges) {
    context.fillStyle = '#b9b08c'
    context.fillRect(charge.x, charge.y, charge.w, charge.h)
  }

  if (world.drone) {
    const center = centerOf(world.drone)
    context.fillStyle = '#2a3038'
    context.beginPath()
    context.roundRect(world.drone.x, world.drone.y + 0.12, world.drone.w, 0.2, 0.06)
    context.fill()
    context.fillStyle = 'rgba(200,210,225,0.6)'
    const blur = 0.3 + 0.15 * Math.sin(world.clock * 60)
    context.fillRect(center.x - 0.3 - blur / 2, world.drone.y + 0.04, blur, 0.04)
    context.fillRect(center.x + 0.3 - blur / 2, world.drone.y + 0.04, blur, 0.04)
  }
}

/** Tiles in mid-fall, drawn with the same art as when they were part of a wall. */
export function drawFalling(context: CanvasRenderingContext2D, world: World): void {
  for (const tile of world.falling) paintTile(context, tile.kind, tile.x, tile.y, 1, tile.x, Math.floor(tile.y))
}

/** Markers that must stay readable in the dark: extraction label, C4 and drone status lights. */
export function drawSignals(context: CanvasRenderingContext2D, world: World): void {
  const { extraction } = world
  label(context, 'EXTRACT', extraction.x + extraction.w / 2, extraction.y + 0.9, '#39ff6a', 0.6)
  if (Math.floor(world.clock * 5) % 2 === 0) {
    context.fillStyle = '#ff2d3d'
    for (const charge of world.charges) dot(context, charge.x + charge.w / 2, charge.y + 0.08, 0.09)
    if (world.drone) dot(context, world.drone.x + world.drone.w / 2, world.drone.y + 0.3, 0.07)
  }
}

/** Tracers: a wide soft streak with a hot white core, so shots read as light. */
export function drawProjectiles(context: CanvasRenderingContext2D, world: World): void {
  context.lineCap = 'round'
  context.globalCompositeOperation = 'lighter'
  for (const shot of world.projectiles) {
    const speed = Math.hypot(shot.vx, shot.vy)
    const rocket = shot.kind === 'rocket'
    const length = rocket ? 1.1 : Math.min(2.2, speed * 0.026)
    const tail = { x: shot.x - (shot.vx / speed) * length, y: shot.y - (shot.vy / speed) * length }
    const color = rocket ? 'rgba(255,138,31,0.8)' : shot.fromPlayer ? 'rgba(255,214,120,0.55)' : 'rgba(255,70,60,0.7)'
    streak(context, shot, tail, rocket ? 0.42 : 0.2, color)
    streak(context, shot, rocket ? tail : { x: (shot.x + tail.x) / 2, y: (shot.y + tail.y) / 2 }, rocket ? 0.16 : 0.07, '#ffffff')
  }
  context.globalCompositeOperation = 'source-over'
}

function streak(context: CanvasRenderingContext2D, from: Vec, to: Vec, width: number, color: string): void {
  context.strokeStyle = color
  context.lineWidth = width
  context.beginPath()
  context.moveTo(from.x, from.y)
  context.lineTo(to.x, to.y)
  context.stroke()
}

export function drawEffects(context: CanvasRenderingContext2D, world: World): void {
  for (const particle of world.effects.particles) {
    context.globalAlpha = Math.min(1, particle.life * 2)
    context.fillStyle = particle.color
    context.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size)
  }
  context.globalAlpha = 1

  for (const item of world.effects.flashes) {
    const age = 1 - item.life / item.duration
    if (item.kind === 'noise') {
      context.globalAlpha = (1 - age) * 0.28
      context.strokeStyle = '#dfe6f2'
      context.lineWidth = 0.05
      context.beginPath()
      context.arc(item.x, item.y, item.radius * age, 0, Math.PI * 2)
      context.stroke()
    } else if (item.kind === 'muzzle') {
      drawMuzzleFlash(context, item, age)
    } else {
      context.globalCompositeOperation = 'lighter'
      context.globalAlpha = 1 - age
      // A white-hot core that shrinks while the soft fireball (drawn by the lighting pass) spreads.
      context.fillStyle = '#fff6d8'
      context.beginPath()
      context.arc(item.x, item.y, item.radius * 0.6 * (1 - age), 0, Math.PI * 2)
      context.fill()
      context.strokeStyle = 'rgba(255,200,140,0.7)'
      context.lineWidth = 0.12 * (1 - age)
      context.beginPath()
      context.arc(item.x, item.y, item.radius * (0.4 + age * 0.9), 0, Math.PI * 2)
      context.stroke()
      context.globalCompositeOperation = 'source-over'
    }
  }
  context.globalAlpha = 1
}

/** A forward spike of flame with two side jets, shown for a few hundredths of a second. */
function drawMuzzleFlash(context: CanvasRenderingContext2D, at: Vec & { angle: number }, age: number): void {
  context.save()
  context.translate(at.x, at.y)
  context.rotate(at.angle)
  context.globalCompositeOperation = 'lighter'
  context.globalAlpha = 1 - age * 0.7
  const size = 0.7 + age * 0.5
  context.fillStyle = '#ffb454'
  context.beginPath()
  context.moveTo(0, -0.12 * size)
  context.lineTo(1.3 * size, 0)
  context.lineTo(0, 0.12 * size)
  context.lineTo(0.35 * size, 0.5 * size)
  context.lineTo(0.15 * size, 0)
  context.lineTo(0.35 * size, -0.5 * size)
  context.closePath()
  context.fill()
  context.fillStyle = '#ffffff'
  context.beginPath()
  context.ellipse(0.3 * size, 0, 0.4 * size, 0.09 * size, 0, 0, Math.PI * 2)
  context.fill()
  context.restore()
}

function dot(context: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  context.beginPath()
  context.arc(x, y, radius, 0, Math.PI * 2)
  context.fill()
}

function label(context: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, size = 0.9): void {
  context.font = `bold ${size}px ui-monospace, monospace`
  context.textAlign = 'center'
  context.fillStyle = color
  context.fillText(text, x, y)
}
