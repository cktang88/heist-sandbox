import type { Guard } from '../game/guards'
import { handOf } from '../game/tools'
import { centerOf, type Vec } from '../game/types'
import { normalize } from '../game/vision'
import { tracePolygon, visionCone } from './cone'
import { lampIsLit } from './lighting'
import type { World } from '../game/world'

const GUARD_COLORS = { patrol: '#5b7aa6', suspicious: '#d9b23c', alert: '#d94a3c', dead: '#4a4f58' } as const
const CONE_COLORS = { patrol: 'rgba(255,255,255,0.10)', suspicious: 'rgba(240,200,60,0.16)', alert: 'rgba(230,70,60,0.18)' } as const

export function drawGuard(context: CanvasRenderingContext2D, world: World, guard: Guard): void {
  if (guard.state === 'dead') {
    context.fillStyle = GUARD_COLORS.dead
    context.fillRect(guard.x - 0.45, guard.y + guard.h - 0.45, 1.6, 0.45)
    return
  }
  drawVisionCone(context, world, guard)
  context.fillStyle = GUARD_COLORS[guard.state]
  context.fillRect(guard.x, guard.y + 0.4, guard.w, guard.h - 0.4)
  context.fillStyle = '#e6c8a8'
  context.fillRect(guard.x + 0.1, guard.y, guard.w - 0.2, 0.45)
  context.fillStyle = '#20242c'
  context.fillRect(guard.x + (guard.facing === 1 ? 0.5 : -0.4), guard.y + 0.7, 0.6, 0.14)

  if (guard.awareness > 0.05 && guard.state !== 'alert') {
    context.fillStyle = 'rgba(0,0,0,0.6)'
    context.fillRect(guard.x - 0.15, guard.y - 0.45, 1, 0.16)
    context.fillStyle = '#f0c83c'
    context.fillRect(guard.x - 0.15, guard.y - 0.45, guard.awareness, 0.16)
  }
  if (guard.state === 'alert') label(context, '!', guard.x + guard.w / 2, guard.y - 0.25, '#ff5a4a')
  else if (guard.state === 'suspicious') label(context, '?', guard.x + guard.w / 2, guard.y - 0.6, '#f0c83c')
}

/** Shows what a guard can see, clipped by walls, so sneaking is readable. */
function drawVisionCone(context: CanvasRenderingContext2D, world: World, guard: Guard): void {
  if (guard.state === 'dead') return
  tracePolygon(context, visionCone(world, guard))
  context.fillStyle = CONE_COLORS[guard.state]
  context.fill()
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

export function drawPlayer(context: CanvasRenderingContext2D, world: World, aim: Vec): void {
  const player = world.player
  if (player.chute) {
    const top = player.y - 2.2
    context.fillStyle = '#e8e2d0'
    context.beginPath()
    context.ellipse(player.x + player.w / 2, top + 0.8, 1.7, 0.9, 0, Math.PI, 0)
    context.fill()
    context.strokeStyle = 'rgba(232,226,208,0.7)'
    context.lineWidth = 0.04
    for (const offset of [-1.6, -0.6, 0.6, 1.6]) {
      context.beginPath()
      context.moveTo(player.x + player.w / 2 + offset, top + 0.8)
      context.lineTo(player.x + player.w / 2, player.y + 0.3)
      context.stroke()
    }
  }
  if (player.hasLoot) {
    context.fillStyle = '#f2c230'
    context.fillRect(player.x + (player.facing === 1 ? -0.3 : player.w - 0.1), player.y + 0.5, 0.4, 0.6)
  }
  context.fillStyle = '#23262e'
  context.fillRect(player.x, player.y + 0.4, player.w, player.h - 0.4)
  context.fillStyle = '#e6c8a8'
  context.fillRect(player.x + 0.1, player.y, player.w - 0.2, 0.45)
  context.fillStyle = '#d93a3a'
  context.fillRect(player.x + 0.05, player.y + 0.08, player.w - 0.1, 0.12)

  if (world.drone) return
  const hand = handOf(world)
  const direction = normalize(aim.x - hand.x, aim.y - hand.y)
  context.strokeStyle = '#0f1115'
  context.lineWidth = 0.16
  context.beginPath()
  context.moveTo(hand.x, hand.y)
  context.lineTo(hand.x + direction.x * 0.9, hand.y + direction.y * 0.9)
  context.stroke()

  if (player.pick > 0) {
    context.fillStyle = 'rgba(0,0,0,0.6)'
    context.fillRect(player.x - 0.4, player.y - 0.5, 1.5, 0.18)
    context.fillStyle = '#7ee08a'
    context.fillRect(player.x - 0.4, player.y - 0.5, 1.5 * player.pick, 0.18)
  }
}

export function drawThings(context: CanvasRenderingContext2D, world: World): void {
  const { extraction, loot } = world
  context.fillStyle = 'rgba(110,220,130,0.14)'
  context.fillRect(extraction.x, extraction.y, extraction.w, extraction.h)
  context.fillStyle = '#39424f'
  context.fillRect(extraction.x + 1, extraction.y + 1.6, 5.5, 1.9)
  context.fillStyle = '#12151a'
  context.fillRect(extraction.x + 1.6, extraction.y + 3.2, 1, 0.8)
  context.fillRect(extraction.x + 4.8, extraction.y + 3.2, 1, 0.8)
  label(context, 'EXTRACT', extraction.x + extraction.w / 2, extraction.y + 0.8, '#7ee08a', 0.7)

  if (!loot.taken) {
    const glow = 0.3 + 0.2 * Math.sin(world.clock * 5)
    context.fillStyle = `rgba(242,194,48,${glow})`
    context.fillRect(loot.x - 0.3, loot.y - 0.3, loot.w + 0.6, loot.h + 0.6)
    context.fillStyle = '#f2c230'
    context.fillRect(loot.x, loot.y, loot.w, loot.h)
  }

  for (const charge of world.charges) {
    context.fillStyle = Math.floor(world.clock * 6) % 2 === 0 ? '#ff4a3a' : '#7a1f18'
    context.fillRect(charge.x, charge.y, charge.w, charge.h)
  }

  if (world.drone) {
    const center = centerOf(world.drone)
    context.fillStyle = '#c8ccd4'
    context.fillRect(world.drone.x, world.drone.y + 0.12, world.drone.w, 0.2)
    context.fillStyle = '#6fd0ff'
    context.fillRect(center.x - 0.5, world.drone.y, 0.35, 0.07)
    context.fillRect(center.x + 0.15, world.drone.y, 0.35, 0.07)
  }

}

export function drawProjectiles(context: CanvasRenderingContext2D, world: World): void {
  for (const projectile of world.projectiles) {
    const direction = normalize(projectile.vx, projectile.vy)
    const length = projectile.kind === 'rocket' ? 0.7 : 0.9
    context.strokeStyle = projectile.kind === 'rocket' ? '#ffb347' : projectile.fromPlayer ? '#fff3b0' : '#ff7a6a'
    context.lineWidth = projectile.kind === 'rocket' ? 0.22 : 0.09
    context.beginPath()
    context.moveTo(projectile.x, projectile.y)
    context.lineTo(projectile.x - direction.x * length, projectile.y - direction.y * length)
    context.stroke()
  }
}

export function drawEffects(context: CanvasRenderingContext2D, world: World): void {
  for (const particle of world.effects.particles) {
    context.globalAlpha = Math.min(1, particle.life * 2)
    context.fillStyle = particle.color
    context.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size)
  }
  for (const item of world.effects.flashes) {
    const age = 1 - item.life / item.duration
    context.globalAlpha = 1 - age
    context.beginPath()
    if (item.kind === 'noise') {
      context.strokeStyle = 'rgba(255,255,255,0.35)'
      context.lineWidth = 0.06
      context.arc(item.x, item.y, item.radius * age, 0, Math.PI * 2)
      context.stroke()
    } else {
      context.fillStyle = item.kind === 'explosion' ? (age < 0.3 ? '#fff6d8' : '#ff8a2a') : '#fff3b0'
      context.arc(item.x, item.y, item.radius * (0.5 + age * 0.5), 0, Math.PI * 2)
      context.fill()
    }
  }
  context.globalAlpha = 1
}

function label(context: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, size = 0.9): void {
  context.font = `bold ${size}px monospace`
  context.textAlign = 'center'
  context.fillStyle = color
  context.fillText(text, x, y)
}
