import type { Guard } from '../game/guards'
import { centerOf, type Vec } from '../game/types'
import type { World } from '../game/world'
import { worldToScreen, type Camera } from './camera'
import { drawSignals } from './drawActors'
import { caption, hudUnit, measure } from './drawHud'
import { drawSearchArea } from './intelHud'
import { drawStealthScreen, drawStealthWorld } from './stealthOverlay'

/** Bark speech labels fade out over their last stretch of life. */
const BARK_FADE_SECONDS = 0.5
const TILE_METRES = 1.1

/**
 * Markers drawn over the 3D scene: guards' state icons and awareness meters, their spoken barks,
 * sound ripples, lockpick progress, the last place security saw the player, the search area the intel
 * points to (the case itself is never marked: the player has to find it), and the way to the van.
 */
export function drawOverlay(context: CanvasRenderingContext2D, world: World, camera: Camera): void {
  context.setTransform(camera.scale, 0, 0, camera.scale, camera.width / 2 - camera.x * camera.scale, camera.height / 2 - camera.y * camera.scale)
  const area = drawSearchArea(context, world)
  drawRipples(context, world)
  drawStealthWorld(context, world, camera)
  const player = world.player
  if (player.pick > 0) {
    const x = player.x + player.w / 2
    context.fillStyle = 'rgba(0,0,0,0.6)'
    context.fillRect(x - 0.75, player.y - 0.5, 1.5, 0.18)
    context.fillStyle = '#39ff6a'
    context.fillRect(x - 0.75, player.y - 0.5, 1.5 * player.pick, 0.18)
  }
  drawSignals(context, world)
  context.setTransform(1, 0, 0, 1, 0, 0)

  // Everything below is drawn in screen pixels, so text stays crisp and readable at any zoom.
  const unit = hudUnit(camera.height, camera.width)
  if (world.security.lastKnown) drawLastKnown(context, world, camera, world.security.lastKnown, unit)
  for (const guard of world.guards) {
    if (guard.state === 'dead' || guard.hiddenIn !== null || guard.startle || !onScreen(camera, guard, 2)) continue
    drawGuardStatus(context, world, camera, guard, unit)
    drawGuardName(context, world, camera, guard, unit)
  }
  drawBarks(context, world, camera, unit)
  drawStealthScreen(context, world, camera, unit)
  if (world.status !== 'playing') return
  const roof = dropTarget(world)
  if (roof) drawEdgeArrow(context, world, camera, unit, roof, 'TARGET', '#6fd0ff')
  if (world.player.hasLoot) drawEdgeArrow(context, world, camera, unit, centerOf(world.extraction), 'VAN', '#39ff6a')
  else if (area?.region) drawEdgeArrow(context, world, camera, unit, centerOf(area.region), 'INTEL', '#f0c060')
}

function drawRipples(context: CanvasRenderingContext2D, world: World): void {
  context.strokeStyle = '#dfe6f2'
  context.lineWidth = 0.05
  for (const flash of world.effects.flashes) {
    if (flash.kind !== 'noise') continue
    const age = 1 - flash.life / flash.duration
    context.globalAlpha = (1 - age) * 0.22
    context.beginPath()
    context.arc(flash.x, flash.y, flash.radius * age, 0, Math.PI * 2)
    context.stroke()
  }
  context.globalAlpha = 1
}

function onScreen(camera: Camera, at: Vec, margin: number): boolean {
  const halfWide = camera.width / camera.scale / 2 + margin
  const halfTall = camera.height / camera.scale / 2 + margin
  return Math.abs(at.x - camera.x) < halfWide && Math.abs(at.y - camera.y) < halfTall
}

/**
 * The icon over a guard's head says what he is doing, read from his detailed `mode` (the coarse `state` lumps
 * searching, panic and surrender together). A guard talking into his radio shows the handset whatever his mode:
 * stopping him now contains the alert. States with no glyph are spelled out in a small tag.
 */
export type Icon = 'alert' | 'suspicious' | 'searching' | 'radio' | 'blind' | 'tied' | 'surrendered' | 'panic' | 'out'
export function iconFor(guard: Guard): Icon | null {
  if (guard.state === 'dead' || guard.hiddenIn !== null) return null
  if (guard.out) return 'out'
  if (guard.restrained) return 'tied'
  if (guard.blindSeconds > 0) return 'blind'
  if (guard.radio || guard.mode === 'toAlarm') return 'radio'
  switch (guard.mode) {
    case 'combat': return 'alert'
    case 'searching': return 'searching'
    case 'noticed':
    case 'investigating': return 'suspicious'
    case 'panic': return 'panic'
    case 'surrendered': return 'surrendered'
    default: return null
  }
}

const TAGS: Partial<Record<Icon, string>> = { tied: 'TIED', surrendered: 'HANDS UP', panic: 'PANIC', out: 'OUT COLD' }

const ICON_COLOURS: Record<Icon, string> = {
  alert: '#ff2d3d', suspicious: '#ffd23f', searching: '#ff9a3a', radio: '#ff5a4a', blind: '#ffffff',
  tied: '#9fd8ff', surrendered: '#f2f2ea', panic: '#d9a0ff', out: '#9aa4b4',
}

function drawGuardStatus(context: CanvasRenderingContext2D, world: World, camera: Camera, guard: Guard, unit: number): void {
  const head = worldToScreen(camera, { x: guard.x + guard.w / 2, y: guard.y })
  const icon = iconFor(guard)
  const meterY = head.y - unit * 0.9
  const tag = icon ? TAGS[icon] : undefined
  if (tag) {
    // Down, tied or giving up: a word says it better than a glyph, and his awareness no longer matters.
    const at = guard.out ? worldToScreen(camera, { x: guard.x + guard.w / 2, y: guard.y + guard.h - 0.6 }) : head
    const size = unit * 0.62
    const w = measure(context, tag, size) + unit * 0.6
    context.fillStyle = 'rgba(6,8,12,0.7)'
    context.fillRect(at.x - w / 2, at.y - unit * 1.75, w, size * 1.5)
    caption(context, tag, at.x, at.y - unit * 1.75 + size * 1.1, ICON_COLOURS[icon!], size, 'center')
    return
  }
  if (guard.awareness > 0.05 && icon !== 'alert') {
    const w = unit * 2.6
    context.fillStyle = 'rgba(0,0,0,0.6)'
    context.fillRect(head.x - w / 2 - 1, meterY - 1, w + 2, unit * 0.3 + 2)
    context.fillStyle = guard.awareness > 0.75 ? '#ff8a3a' : '#ffd23f'
    context.fillRect(head.x - w / 2, meterY, w * Math.min(1, guard.awareness), unit * 0.3)
  }
  if (!icon) return
  const centre = { x: head.x, y: head.y - unit * 2 }
  const radius = unit * 0.75
  context.fillStyle = 'rgba(6,8,12,0.7)'
  context.beginPath()
  context.arc(centre.x, centre.y, radius, 0, Math.PI * 2)
  context.fill()
  const colour = ICON_COLOURS[icon]
  context.strokeStyle = colour
  context.fillStyle = colour
  context.lineWidth = Math.max(1.5, unit * 0.14)
  if (icon === 'alert') caption(context, '!', centre.x, centre.y + radius * 0.5, colour, radius * 1.5, 'center')
  else if (icon === 'suspicious') caption(context, '?', centre.x, centre.y + radius * 0.5, colour, radius * 1.4, 'center')
  else if (icon === 'searching') magnifier(context, centre, radius)
  else if (icon === 'radio') radio(context, centre, radius, world.clock)
  else burst(context, centre, radius)
}

/** Close to the player, or saying something, a guard's name shows small and dim under his feet. */
const NAME_REACH = 8

function drawGuardName(context: CanvasRenderingContext2D, world: World, camera: Camera, guard: Guard, unit: number): void {
  const name = world.people?.nameOf(guard)
  if (!name) return
  const head = { x: guard.x + guard.w / 2, y: guard.y }
  const close = Math.abs(head.x - centerOf(world.player).x) < NAME_REACH && Math.abs(guard.y - world.player.y) < 3
  const speaking = world.security.barks.some((bark) => Math.abs(bark.x - head.x) < 1 && Math.abs(bark.y - head.y) < 2.5)
  if (!close && !speaking) return
  const feet = worldToScreen(camera, { x: head.x, y: guard.y + guard.h })
  caption(context, name, feet.x, feet.y + unit * 0.9, 'rgba(220,228,240,0.55)', unit * 0.75, 'center')
}

function magnifier(context: CanvasRenderingContext2D, at: Vec, radius: number): void {
  context.beginPath()
  context.arc(at.x - radius * 0.15, at.y - radius * 0.15, radius * 0.38, 0, Math.PI * 2)
  context.moveTo(at.x + radius * 0.12, at.y + radius * 0.12)
  context.lineTo(at.x + radius * 0.5, at.y + radius * 0.5)
  context.stroke()
}

/** A handset with pulsing waves: this guard is calling it in, and stopping them now contains the alert. */
function radio(context: CanvasRenderingContext2D, at: Vec, radius: number, clock: number): void {
  context.fillRect(at.x - radius * 0.38, at.y - radius * 0.2, radius * 0.4, radius * 0.7)
  context.fillRect(at.x - radius * 0.3, at.y - radius * 0.55, radius * 0.08, radius * 0.4)
  const pulse = (clock * 2) % 1
  for (const ring of [0.35, 0.6]) {
    context.globalAlpha = 1 - ((pulse + ring) % 1) * 0.7
    context.beginPath()
    context.arc(at.x + radius * 0.02, at.y + radius * 0.1, radius * ring, -0.8, 0.8)
    context.stroke()
  }
  context.globalAlpha = 1
}

/** Flash-blinded: a white star. */
function burst(context: CanvasRenderingContext2D, at: Vec, radius: number): void {
  context.beginPath()
  for (let ray = 0; ray < 8; ray += 1) {
    const angle = (ray * Math.PI) / 4
    const reach = ray % 2 === 0 ? 0.6 : 0.35
    context.moveTo(at.x, at.y)
    context.lineTo(at.x + Math.cos(angle) * radius * reach, at.y + Math.sin(angle) * radius * reach)
  }
  context.stroke()
}

/** Speech labels above the guards who said them. Overlapping labels are nudged upward so all stay readable. */
function drawBarks(context: CanvasRenderingContext2D, world: World, camera: Camera, unit: number): void {
  const size = unit * 0.8
  const placed: { x: number; y: number; w: number }[] = []
  for (const bark of world.security.barks) {
    if (bark.life <= 0 || !onScreen(camera, bark, 4)) continue
    const at = worldToScreen(camera, bark)
    const w = measure(context, bark.text, size) + unit
    const h = size * 1.6
    // Keep the label on screen; its tail still points at the speaker.
    const x = Math.max(w / 2 + 4, Math.min(camera.width - w / 2 - 4, at.x))
    const y = placeLabel(placed, x, w, h, at.y - unit * 3.4, h / 2 + 4)
    placed.push({ x, y, w })
    context.globalAlpha = Math.min(1, bark.life / BARK_FADE_SECONDS)
    context.fillStyle = 'rgba(12,14,18,0.82)'
    context.fillRect(x - w / 2, y - h / 2, w, h)
    context.beginPath()
    context.moveTo(at.x - unit * 0.35, y + h / 2)
    context.lineTo(at.x, y + h / 2 + unit * 0.45)
    context.lineTo(at.x + unit * 0.35, y + h / 2)
    context.fill()
    context.fillStyle = 'rgba(255,255,255,0.18)'
    context.fillRect(x - w / 2, y - h / 2, w, 1)
    caption(context, bark.text, x, y + size * 0.36, '#f2f2ea', size, 'center')
  }
  context.globalAlpha = 1
}

type Placed = { x: number; y: number; w: number }

/**
 * Where a speech label of size `w` x `h` centred on `x` goes: at `wanted` if free, else stacked just above the labels it
 * would cover, and if that runs off the top of the screen (above `top`), stacked below them instead.
 */
export function placeLabel(placed: readonly Placed[], x: number, w: number, h: number, wanted: number, top: number): number {
  const hits = (y: number) => placed.find((other) => Math.abs(other.x - x) < (other.w + w) / 2 && Math.abs(other.y - y) < h)
  let y = Math.max(top, wanted)
  for (let other = hits(y); other; other = hits(y)) {
    y = other.y - h - 2
    if (y < top) break
  }
  if (y >= top && !hits(y)) return y
  y = Math.max(top, wanted)
  for (let other = hits(y); other; other = hits(y)) y = other.y + h + 2
  return y
}

/** A ghost marker where security last saw the player: guards will search from here. */
function drawLastKnown(context: CanvasRenderingContext2D, world: World, camera: Camera, at: Vec, unit: number): void {
  if (!onScreen(camera, at, 1)) return
  const point = worldToScreen(camera, at)
  const radius = unit * (1.1 + 0.15 * Math.sin(world.clock * 4))
  context.strokeStyle = 'rgba(255,120,60,0.85)'
  context.lineWidth = Math.max(1.5, unit * 0.12)
  context.setLineDash([unit * 0.4, unit * 0.3])
  context.beginPath()
  context.arc(point.x, point.y, radius, 0, Math.PI * 2)
  context.stroke()
  context.setLineDash([])
  context.beginPath()
  context.moveTo(point.x - unit * 0.3, point.y)
  context.lineTo(point.x + unit * 0.3, point.y)
  context.moveTo(point.x, point.y - unit * 0.3)
  context.lineTo(point.x, point.y + unit * 0.3)
  context.stroke()
  caption(context, 'LAST SEEN', point.x, point.y - radius - unit * 0.4, 'rgba(255,150,90,0.95)', unit * 0.7, 'center')
}

/** Heists whose player has touched down: the drop-in arrow is only for the first fall from the plane. */
const landed = new WeakSet<World>()

/** While dropping in, where to steer: the roof of the biggest building, or its near wall once below the roofline. */
function dropTarget(world: World): Vec | null {
  const player = world.player
  if (player.onGround) landed.add(world)
  if (landed.has(world)) return null
  if (world.dropPoint) return world.dropPoint
  let main: World['interiors'][number] | null = null
  for (const interior of world.interiors) if (interior.kind === 'room' && (!main || interior.w * interior.h > main.w * main.h)) main = interior
  if (!main) return null
  const feet = player.y + player.h
  if (feet <= main.y) return { x: main.x + main.w / 2, y: main.y }
  return { x: player.x < main.x ? main.x : main.x + main.w, y: feet }
}

/**
 * An arrow at the screen edge toward something off screen, with its distance: the van once the case is in hand,
 * otherwise the middle of the search area the intel points to.
 */
function drawEdgeArrow(context: CanvasRenderingContext2D, world: World, camera: Camera, unit: number, goal: Vec, name: string, colour: string): void {
  if (onScreen(camera, goal, -1)) return
  const target = worldToScreen(camera, goal)
  const centre = { x: camera.width / 2, y: camera.height / 2 }
  const angle = Math.atan2(target.y - centre.y, target.x - centre.x)
  const marginX = camera.width / 2 - unit * 3
  const marginY = camera.height / 2 - unit * 5
  const reach = Math.min(marginX / Math.abs(Math.cos(angle) || 1e-6), marginY / Math.abs(Math.sin(angle) || 1e-6))
  const tip = { x: centre.x + Math.cos(angle) * reach, y: centre.y + Math.sin(angle) * reach }
  context.save()
  context.translate(tip.x, tip.y)
  context.rotate(angle)
  context.fillStyle = colour
  context.beginPath()
  context.moveTo(unit * 0.9, 0)
  context.lineTo(-unit * 0.6, -unit * 0.65)
  context.lineTo(-unit * 0.3, 0)
  context.lineTo(-unit * 0.6, unit * 0.65)
  context.closePath()
  context.fill()
  context.restore()
  const metres = Math.round(Math.hypot(goal.x - world.player.x, goal.y - world.player.y) * TILE_METRES)
  const label = `${name} ${metres}m`
  const back = { x: tip.x - Math.cos(angle) * unit * 2.2, y: tip.y - Math.sin(angle) * unit * 1.6 }
  context.fillStyle = 'rgba(6,8,12,0.6)'
  const w = measure(context, label, unit * 0.75) + unit * 0.6
  context.fillRect(back.x - w / 2, back.y - unit * 0.65, w, unit * 1.05)
  caption(context, label, back.x, back.y + unit * 0.2, colour, unit * 0.75, 'center')
}
