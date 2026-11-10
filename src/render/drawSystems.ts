import { propSpec } from '../game/propCatalog'
import type { DeviceKind } from '../game/site'
import { spotKind } from '../game/stealth/spots'
import type { Vec } from '../game/types'
import type { World } from '../game/world'
import type { Camera } from './camera'

/**
 * The flat view's picture of the systems the 3D layers draw: devices and their state, fire, water, smoke and gas,
 * sprays, ropes and the grapple line, elevator cabs and live grenades. Plain shapes, enough to play and test by.
 * Only what is in view is drawn. Everything is in tile units (the caller has set the world transform).
 */

type View = { left: number; right: number; top: number; bottom: number }

function viewOf(camera: Camera): View {
  const halfWide = camera.width / camera.scale / 2 + 1
  const halfTall = camera.height / camera.scale / 2 + 1
  return { left: camera.x - halfWide, right: camera.x + halfWide, top: camera.y - halfTall, bottom: camera.y + halfTall }
}

const seen = (view: View, at: Vec) => at.x > view.left && at.x < view.right && at.y > view.top && at.y < view.bottom

/** Under people: what lies on and in the rooms. */
export function drawSystemsBehind(context: CanvasRenderingContext2D, world: World, camera: Camera): void {
  const view = viewOf(camera)
  drawHidingSpots(context, world, view)
  drawDevices(context, world, view)
  drawCabs(context, world, view)
  drawWet(context, world, view)
}

/** Over people: what hangs in the air or is thrown through it. */
export function drawSystemsFront(context: CanvasRenderingContext2D, world: World, camera: Camera): void {
  const view = viewOf(camera)
  drawFire(context, world, view)
  drawSmoke(context, world, view)
  drawSprays(context, world, view)
  drawLines(context, world)
  drawGrenades(context, world, view)
}

const DEVICE_COLOURS: Record<DeviceKind, string> = {
  camera: '#d8dde6', computer: '#5fb3d6', fusebox: '#e0b95a', alarmButton: '#ff3d3d', keypad: '#9fd8ff',
  elevatorPanel: '#c0c6d0', radioRelay: '#b48cff', lightSwitch: '#f2f2ea',
}

/** A small box per device in its colour, grey and crossed out when cut or off, with a green corner once hacked. */
function drawDevices(context: CanvasRenderingContext2D, world: World, view: View): void {
  for (const device of world.devices) {
    if (!seen(view, device)) continue
    const size = device.kind === 'camera' || device.kind === 'lightSwitch' ? 0.3 : 0.45
    context.fillStyle = '#14171d'
    context.fillRect(device.x - size / 2 - 0.04, device.y - size / 2 - 0.04, size + 0.08, size + 0.08)
    context.fillStyle = device.disabled ? '#59606b' : DEVICE_COLOURS[device.kind]
    context.fillRect(device.x - size / 2, device.y - size / 2, size, size)
    if (device.disabled) {
      context.strokeStyle = '#ff5a4a'
      context.lineWidth = 0.05
      context.beginPath()
      context.moveTo(device.x - size / 2, device.y - size / 2)
      context.lineTo(device.x + size / 2, device.y + size / 2)
      context.stroke()
    }
    if (device.hacked) {
      context.fillStyle = '#39ff6a'
      context.fillRect(device.x + size / 2 - 0.12, device.y - size / 2, 0.12, 0.12)
    }
  }
}

/** Lockers, wardrobes, stalls and the furniture you can crawl under get a pale outline, so places to hide stand out. */
function drawHidingSpots(context: CanvasRenderingContext2D, world: World, view: View): void {
  context.strokeStyle = 'rgba(126,224,138,0.5)'
  context.lineWidth = 0.05
  for (const prop of world.props) {
    if (prop.broken || !seen(view, prop) || !spotKind(prop.kind)) continue
    const { w, h } = propSpec(prop.kind)
    context.strokeRect(prop.x + 0.5 - w / 2, prop.y - h, w, h)
  }
}

/** An elevator cab: its outline over the shaft, from the car floor up. */
function drawCabs(context: CanvasRenderingContext2D, world: World, view: View): void {
  context.strokeStyle = '#8a93a3'
  context.lineWidth = 0.08
  for (const car of world.elevatorCars) {
    const shaft = world.elevators[car.shaft]
    if (!shaft || !seen(view, { x: shaft.x + shaft.w / 2, y: car.y - 2 })) continue
    context.strokeRect(shaft.x + 0.05, car.y - 5, shaft.w - 0.1, 5)
  }
}

function tileOf(world: World, key: number): Vec {
  return { x: key % world.grid.width, y: Math.floor(key / world.grid.width) }
}

/** Wet floor: a thin blue film on top of the tile. */
function drawWet(context: CanvasRenderingContext2D, world: World, view: View): void {
  context.fillStyle = 'rgba(90,160,255,0.55)'
  for (const key of world.hazards.wet.keys()) {
    const tile = tileOf(world, key)
    if (seen(view, tile)) context.fillRect(tile.x, tile.y - 0.08, 1, 0.12)
  }
}

function drawFire(context: CanvasRenderingContext2D, world: World, view: View): void {
  for (const fire of world.hazards.fires.values()) {
    if (!seen(view, fire)) continue
    const flicker = 0.75 + 0.25 * Math.sin(world.clock * 13 + fire.x * 3.1)
    context.fillStyle = `rgba(255,${Math.round(110 + 80 * fire.heat)},40,${(0.35 + 0.5 * fire.heat) * flicker})`
    context.fillRect(fire.x, fire.y + 1 - fire.heat * flicker, 1, fire.heat * flicker)
  }
}

/** Smoke in grey, toxic smoke darker, foam white, flammable gas a sickly green. */
function drawSmoke(context: CanvasRenderingContext2D, world: World, view: View): void {
  const field = world.hazards.smoke
  if (!field) return
  for (const key of field.active) {
    const tile = tileOf(world, key)
    if (!seen(view, tile)) continue
    const smoke = Math.min(1, field.screen[key] + field.toxic[key])
    if (smoke > 0.02) {
      context.fillStyle = field.toxic[key] > field.screen[key] ? `rgba(40,38,36,${smoke * 0.8})` : `rgba(170,175,182,${smoke * 0.8})`
      context.fillRect(tile.x, tile.y, 1, 1)
    }
    if (field.foam[key] > 0.02) {
      context.fillStyle = `rgba(240,244,248,${Math.min(1, field.foam[key]) * 0.7})`
      context.fillRect(tile.x, tile.y, 1, 1)
    }
    if (field.gas[key] > 0.02) {
      context.fillStyle = `rgba(150,210,60,${Math.min(1, field.gas[key]) * 0.35})`
      context.fillRect(tile.x, tile.y, 1, 1)
    }
  }
}

const SPRAY_COLOURS = { water: 'rgba(110,170,255,0.6)', foam: 'rgba(240,244,248,0.7)', steam: 'rgba(220,226,232,0.45)', gas: 'rgba(150,210,60,0.45)' } as const

function drawSprays(context: CanvasRenderingContext2D, world: World, view: View): void {
  for (const spray of world.hazards.sprays) {
    if (!seen(view, spray)) continue
    context.fillStyle = SPRAY_COLOURS[spray.kind]
    context.beginPath()
    context.moveTo(spray.x, spray.y)
    context.arc(spray.x, spray.y, spray.reach, spray.angle - spray.spread, spray.angle + spray.spread)
    context.closePath()
    context.fill()
  }
}

/** Ropes hanging from their knots, and the grapple line from the hands to the hook (round its bend). */
function drawLines(context: CanvasRenderingContext2D, world: World): void {
  context.lineWidth = 0.07
  context.strokeStyle = '#b59a62'
  for (const rope of world.ropes) {
    context.beginPath()
    context.moveTo(rope.anchor.x, rope.anchor.y)
    context.lineTo(rope.x, rope.top)
    context.lineTo(rope.x, rope.bottom)
    context.stroke()
  }
  const grapple = world.grapple
  if (grapple.phase === 'stowed') return
  const player = world.player
  context.strokeStyle = '#d8dde6'
  context.lineWidth = 0.05
  context.beginPath()
  context.moveTo(player.x + player.w / 2, player.y + 0.6)
  if (grapple.bend) context.lineTo(grapple.bend.x, grapple.bend.y)
  context.lineTo(grapple.hook.x, grapple.hook.y)
  context.stroke()
  context.fillStyle = '#d8dde6'
  context.fillRect(grapple.hook.x - 0.1, grapple.hook.y - 0.1, 0.2, 0.2)
}

/** Grenades in flight or on the floor: smoke grey, flash white, frags dark green, with a blinking fuse light. */
function drawGrenades(context: CanvasRenderingContext2D, world: World, view: View): void {
  const blink = Math.floor(world.clock * 6) % 2 === 0
  const ball = (x: number, y: number, colour: string) => {
    context.fillStyle = colour
    context.beginPath()
    context.arc(x, y, 0.16, 0, Math.PI * 2)
    context.fill()
    if (!blink) return
    context.fillStyle = '#ff3d3d'
    context.fillRect(x - 0.04, y - 0.2, 0.08, 0.08)
  }
  for (const grenade of world.hazards.grenades) {
    if (grenade.popped || !seen(view, grenade)) continue
    ball(grenade.x + grenade.w / 2, grenade.y + grenade.h / 2, grenade.kind === 'smoke' ? '#8a93a3' : '#f2f2ea')
  }
  for (const frag of world.frags) if (seen(view, frag)) ball(frag.x + frag.w / 2, frag.y + frag.h / 2, '#4b5a3c')
}
