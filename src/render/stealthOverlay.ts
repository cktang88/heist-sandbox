import type { Guard } from '../game/guards'
import type { Vec } from '../game/types'
import type { World } from '../game/world'
import { worldToScreen, type Camera } from './camera'
import { caption } from './drawHud'

/**
 * The stealth toolkit's markers over the scene: blood on the floor, the choke's progress, the shrinking ring over a
 * startled guard (the window to act in), and the eye that shows where the player is hiding.
 */

/** Drawn in world units, under the other world-space markers. */
export function drawStealthWorld(context: CanvasRenderingContext2D, world: World, camera: Camera): void {
  drawBlood(context, world, camera)
  drawChoke(context, world)
}

/** Drawn in screen pixels, over everything. */
export function drawStealthScreen(context: CanvasRenderingContext2D, world: World, camera: Camera, unit: number): void {
  for (const guard of world.guards) if (guard.startle) drawStartle(context, camera, guard, unit, world.clock)
  if (world.player.hidden) drawEye(context, world, camera, unit)
}

function near(camera: Camera, at: Vec, margin: number): boolean {
  return Math.abs(at.x - camera.x) < camera.width / camera.scale / 2 + margin && Math.abs(at.y - camera.y) < camera.height / camera.scale / 2 + margin
}

function drawBlood(context: CanvasRenderingContext2D, world: World, camera: Camera): void {
  context.fillStyle = 'rgba(110,8,14,0.85)'
  for (const drop of world.stealth.blood) {
    if (!near(camera, drop, 2)) continue
    // Pools (where a man died) are wide; drops along a carried body's way are small.
    const wide = 0.25 + ((drop.x * 7.31) % 1) * 0.35
    context.beginPath()
    context.ellipse(drop.x, drop.y - 0.03, wide, 0.06, 0, 0, Math.PI * 2)
    context.fill()
  }
}

function drawChoke(context: CanvasRenderingContext2D, world: World): void {
  const choke = world.stealth.choke
  if (!choke) return
  const player = world.player
  const x = player.x + player.w / 2
  context.fillStyle = 'rgba(0,0,0,0.6)'
  context.fillRect(x - 0.75, player.y - 0.5, 1.5, 0.18)
  context.fillStyle = choke.struggle ? '#ff9a3a' : '#7ee08a'
  context.fillRect(x - 0.75, player.y - 0.5, 1.5 * Math.min(1, choke.t / choke.need), 0.18)
}

/** A ring over the startled guard that shrinks as his beat runs out, with the "!" filling in as it does. */
function drawStartle(context: CanvasRenderingContext2D, camera: Camera, guard: Guard, unit: number, clock: number): void {
  const startle = guard.startle!
  const left = Math.max(0, startle.seconds / startle.total)
  const head = worldToScreen(camera, { x: guard.x + guard.w / 2, y: guard.y })
  const centre = { x: head.x, y: head.y - unit * 2.2 }
  const radius = unit * (0.9 + 0.9 * left)
  context.lineWidth = Math.max(2, unit * 0.18)
  context.strokeStyle = `rgba(255,${Math.round(90 + 140 * left)},60,0.9)`
  context.beginPath()
  context.arc(centre.x, centre.y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left)
  context.stroke()
  const pulse = 0.75 + 0.25 * Math.sin(clock * 18)
  context.globalAlpha = (1 - left) * pulse + 0.25
  caption(context, '!', centre.x, centre.y + unit * 0.5, '#ff4a3a', unit * 1.5, 'center')
  context.globalAlpha = 1
}

/** An eye over the hiding place: the player is in there, watching through the slats. */
function drawEye(context: CanvasRenderingContext2D, world: World, camera: Camera, unit: number): void {
  const player = world.player
  const at = worldToScreen(camera, { x: player.x + player.w / 2, y: player.y - 0.2 })
  const w = unit * 0.9
  const h = unit * 0.45
  context.fillStyle = 'rgba(6,8,12,0.7)'
  context.beginPath()
  context.ellipse(at.x, at.y, w * 1.25, h * 1.6, 0, 0, Math.PI * 2)
  context.fill()
  context.strokeStyle = '#7ee08a'
  context.lineWidth = Math.max(1.5, unit * 0.12)
  context.beginPath()
  context.moveTo(at.x - w, at.y)
  context.quadraticCurveTo(at.x, at.y - h * 1.6, at.x + w, at.y)
  context.quadraticCurveTo(at.x, at.y + h * 1.6, at.x - w, at.y)
  context.stroke()
  context.fillStyle = '#7ee08a'
  context.beginPath()
  context.arc(at.x, at.y, h * 0.55, 0, Math.PI * 2)
  context.fill()
}
