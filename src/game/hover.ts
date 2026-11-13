import type { PropState } from './cover'
import { deviceState } from './devices/state'
import { openedDoors } from './doors/doors'
import { windowAt } from './grapple/windows'
import type { Guard } from './guards'
import { propBox, propById, propsAt } from './hazards/props'
import { isReadable } from './intel/sources'
import { propSpec } from './propCatalog'
import { isBody } from './stealth/bodies'
import { isNoisemaker } from './stealth/noisemakers'
import { spotKind } from './stealth/spots'
import { NOISEMAKER } from './stealth/tuning'
import { tileAt } from './tiles'
import type { Rect, Vec } from './types'
import type { Device, Pickup, World } from './world'

/**
 * Which interactive thing the mouse is over, or what E would act on, so the renderers can outline it. Everything here
 * only reads the world. `box` is the thing's bounds in tile units (y down), for the flat view and for things drawn as
 * tiles (doors, windows); the 3D view outlines the model itself where it has one. `key` names the thing, so a
 * renderer can tell when the target changed.
 */
export type OutlineTarget = (
  | { kind: 'device'; device: Device }
  | { kind: 'prop'; prop: PropState }
  | { kind: 'person'; guard: Guard }
  | { kind: 'loot' }
  | { kind: 'pickup'; pickup: Pickup }
  | { kind: 'door' }
  | { kind: 'window' }
) & { key: string; box: Rect }

/** A cursor this close outside a small thing still counts as over it. */
const HOVER_SLACK = 0.12
/** The tallest a door or window opening runs, in tiles. */
const MAX_OPENING = 8
/** Wall devices are drawn about this big around the middle of their tile (cameras stick further out). */
const WALL_DEVICE_HALF = 0.4
const CAMERA_HALF_WIDTH = 0.75
/** A standing device (a workstation) rises this far above the row it stands on. */
const STANDING_DEVICE_HEIGHT = 1.35

/**
 * The interactive thing under the cursor, or null. `aim` is the cursor on the walking lane; `wallAim` is the same
 * cursor carried back onto the back wall (the 3D view draws the back wall smaller under perspective), used for what
 * is mounted there. Players, people, loot and pickups win over devices, devices over furniture, and furniture over
 * doors and windows.
 */
export function hoveredTarget(world: World, aim: Vec, wallAim: Vec = aim): OutlineTarget | null {
  return personAt(world, aim) ?? itemAt(world, aim) ?? deviceAt(world, wallAim) ?? propAt(world, aim, wallAim) ?? doorAt(world, aim) ?? windowUnder(world, aim)
}

/** What to outline this frame, and whether it is under the cursor (else it is what E acts on). */
export type OutlineChoice = { target: OutlineTarget; hovered: boolean }

/** What to outline this frame: what the cursor is over, else what E would act on now. */
export function outlineTarget(world: World, aim: Vec, wallAim: Vec = aim): OutlineChoice | null {
  if (world.status !== 'playing') return null
  const hovered = hoveredTarget(world, aim, wallAim)
  if (hovered) return { target: hovered, hovered: true }
  const acted = actionTarget(world)
  return acted && { target: acted, hovered: false }
}

// --- What E would act on ---

type Noted = { key: string; at?: Vec }
const noted = new WeakMap<World, Noted | null>()

/** Called by `interact.ts` each step with the action E would do next (null when there is none). */
export function noteAction(world: World, action: Noted | null): void {
  noted.set(world, action && { key: action.key, at: action.at })
}

/** The thing the current E action works on, when it is one that can be outlined. */
export function actionTarget(world: World): OutlineTarget | null {
  const action = noted.get(world)
  if (!action || world.prompt === null) return null
  return targetOfAction(world, action.key, action.at)
}

/** Reads the target back out of an action's key (see the `key`s made in `interact.ts` and the stealth actions). */
export function targetOfAction(world: World, key: string, at?: Vec): OutlineTarget | null {
  const [head, first, second] = key.split(':')
  const number = Number(first)
  switch (head) {
    case 'device': {
      const device = world.devices.find((candidate) => candidate.id === number)
      return device ? deviceTarget(device) : null
    }
    case 'door':
      return at ? doorTarget(world, number, Math.floor(at.y)) : null
    case 'close': {
      const door = openedDoors(world).get(key.slice('close:'.length))
      return door ? { kind: 'door', key: `door:${door.tiles[0].x},${door.tiles[0].y}`, box: boundsOf(door.tiles) } : null
    }
    case 'call':
      return at ? doorTarget(world, Math.floor(at.x), Math.floor(at.y)) ?? { kind: 'door', key: `door:${Math.floor(at.x)},${Math.floor(at.y)}`, box: { x: Math.floor(at.x), y: at.y - 1.5, w: 1, h: 3 } } : null
    case 'window':
      return windowTarget(world, number, Number(second))
    case 'takedown':
    case 'body':
      return personTarget(world, world.guards[number])
    case 'tieUp': {
      // The surrendered man nearest the player, as `tieUpAction` picks him.
      const centre = { x: world.player.x + world.player.w / 2, y: world.player.y + world.player.h / 2 }
      const gap = (guard: Guard) => Math.hypot(guard.x + guard.w / 2 - centre.x, guard.y + guard.h / 2 - centre.y)
      const near = world.guards.filter((other) => other.mode === 'surrendered' && !other.restrained).sort((a, b) => gap(a) - gap(b))
      return personTarget(world, near[0])
    }
    case 'intel':
      if (first === 'read') return propTarget(propById(world, Number(second)))
      if (first === 'ask' || first === 'again') return personTarget(world, world.guards[Number(second)])
      return null
    case 'stash':
    case 'hide':
    case 'noise':
      return propTarget(propById(world, number))
    default:
      return null
  }
}

// --- People and things lying about ---

/** Someone the player can do something to: a man with his hands up, tied up, or a body lying in the open. */
function interactablePerson(world: World, guard: Guard): boolean {
  if (guard.hiddenIn !== null || world.guards[world.stealth.carried ?? -1] === guard) return false
  return guard.mode === 'surrendered' || guard.restrained || isBody(guard)
}

function personTarget(world: World, guard: Guard | undefined): OutlineTarget | null {
  if (!guard) return null
  return { kind: 'person', guard, key: `person:${world.guards.indexOf(guard)}`, box: personBox(guard) }
}

/** A standing man's box, or the bounds of his limp body. */
export function personBox(guard: Guard): Rect {
  const points = guard.ragdoll?.points
  if (!points || points.length === 0) return { x: guard.x, y: guard.y, w: guard.w, h: guard.h }
  const pad = 0.2
  return grow(boundsOf(points.map((point) => ({ x: point.x, y: point.y })), 0), pad)
}

function personAt(world: World, aim: Vec): OutlineTarget | null {
  for (const guard of world.guards) {
    // Ruled out cheaply first: a big site has many guards and only the ones under the cursor matter.
    if (Math.abs(guard.x - aim.x) > 3 || Math.abs(guard.y - aim.y) > 3) continue
    if (!interactablePerson(world, guard)) continue
    const box = personBox(guard)
    if (inside(box, aim, HOVER_SLACK)) return personTarget(world, guard)
  }
  return null
}

function itemAt(world: World, aim: Vec): OutlineTarget | null {
  const loot = world.loot
  if (!loot.taken && inside(loot, aim, HOVER_SLACK)) return { kind: 'loot', key: 'loot', box: rectOf(loot) }
  for (const pickup of world.pickups) {
    if (!pickup.taken && inside(pickup, aim, HOVER_SLACK)) return { kind: 'pickup', pickup, key: `pickup:${world.pickups.indexOf(pickup)}`, box: rectOf(pickup) }
  }
  return null
}

// --- Devices ---

/** Where a device is drawn: a box round the middle of its tile on the wall, or a workstation standing on its row. */
export function deviceBox(device: Device): Rect {
  if (device.kind === 'computer') return { x: device.x + 0.05, y: device.y - STANDING_DEVICE_HEIGHT, w: 0.9, h: STANDING_DEVICE_HEIGHT }
  const halfW = device.kind === 'camera' ? CAMERA_HALF_WIDTH : WALL_DEVICE_HALF
  return { x: device.x + 0.5 - halfW, y: device.y + 0.5 - WALL_DEVICE_HALF, w: halfW * 2, h: WALL_DEVICE_HALF * 2 }
}

function deviceTarget(device: Device): OutlineTarget {
  return { kind: 'device', device, key: `device:${device.id}`, box: deviceBox(device) }
}

/** A device with something left to do to it (the same rules `interact.ts` offers its actions by). */
export function deviceUsable(world: World, device: Device): boolean {
  switch (device.kind) {
    case 'keypad':
      return !device.hacked && !device.disabled
    case 'camera':
    case 'radioRelay':
      return !device.disabled || deviceState(world).offTimers.has(device.id)
    case 'computer':
    case 'elevatorPanel':
      return !device.disabled
    case 'fusebox':
    case 'lightSwitch':
      return !device.disabled && device.circuit !== undefined
    default:
      return !device.disabled
  }
}

type DeviceIndex = { devices: Device[]; count: number; width: number; byTile: Map<number, Device[]> }
const deviceIndexes = new WeakMap<World, DeviceIndex>()

/** Devices filed under every tile their box covers, rebuilt only when the device list changes (devices never move). */
function deviceIndex(world: World): DeviceIndex {
  const known = deviceIndexes.get(world)
  if (known && known.devices === world.devices && known.count === world.devices.length) return known
  const width = world.grid.width
  const byTile = new Map<number, Device[]>()
  for (const device of world.devices) {
    const box = deviceBox(device)
    for (let y = Math.floor(box.y); y < box.y + box.h; y += 1) {
      for (let x = Math.floor(box.x); x < box.x + box.w; x += 1) {
        const key = y * width + x
        const list = byTile.get(key)
        if (list) list.push(device)
        else byTile.set(key, [device])
      }
    }
  }
  const index = { devices: world.devices, count: world.devices.length, width, byTile }
  deviceIndexes.set(world, index)
  return index
}

function deviceAt(world: World, aim: Vec): OutlineTarget | null {
  const index = deviceIndex(world)
  const here = index.byTile.get(Math.floor(aim.y) * index.width + Math.floor(aim.x))
  if (!here) return null
  for (const device of here) if (inside(deviceBox(device), aim, HOVER_SLACK) && deviceUsable(world, device)) return deviceTarget(device)
  return null
}

// --- Furniture ---

/** Furniture with a use: a hiding place, a machine to switch on, a paper not yet read. */
export function propUsable(world: World, prop: PropState): boolean {
  if (prop.broken) return false
  if (spotKind(prop.kind)) return true
  if (isNoisemaker(prop.kind)) {
    return !world.stealth.noisemakers.some((on) => on.prop === prop.id) && (world.stealth.noisemakerUses.get(prop.id) ?? 0) < NOISEMAKER.maxUses
  }
  return isReadable(prop.kind) && world.intel.places.length > 0 && !world.intel.used.has(`prop:${prop.id}`)
}

function propTarget(prop: PropState | undefined): OutlineTarget | null {
  return prop ? { kind: 'prop', prop, key: `prop:${prop.id}`, box: propBox(prop) } : null
}

/**
 * The smallest usable prop under the cursor (a paper on a notice board before the desk under it). Wall props (boards,
 * papers) are hit where the cursor meets the back wall, the rest on the walking lane.
 */
function propAt(world: World, aim: Vec, wallAim: Vec): OutlineTarget | null {
  let best: PropState | null = null
  let bestArea = Number.POSITIVE_INFINITY
  const ids = new Set([...propsAt(world, Math.floor(aim.x), Math.floor(aim.y)), ...propsAt(world, Math.floor(wallAim.x), Math.floor(wallAim.y))])
  for (const id of ids) {
    const prop = propById(world, id)
    if (!prop) continue
    const box = propBox(prop)
    const at = propSpec(prop.kind).mount === 'wall' ? wallAim : aim
    if (!inside(box, at, 0) || box.w * box.h >= bestArea || !propUsable(world, prop)) continue
    best = prop
    bestArea = box.w * box.h
  }
  return propTarget(best ?? undefined)
}

// --- Doors and windows ---

/** The whole door (its column of door tiles) with a tile at this spot. */
function doorTarget(world: World, x: number, y: number): OutlineTarget | null {
  if (tileAt(world.grid, x, y) !== 'door') return null
  let top = y
  let bottom = y
  while (y - top < MAX_OPENING && tileAt(world.grid, x, top - 1) === 'door') top -= 1
  while (bottom - y < MAX_OPENING && tileAt(world.grid, x, bottom + 1) === 'door') bottom += 1
  return { kind: 'door', key: `door:${x},${bottom}`, box: { x, y: top, w: 1, h: bottom - top + 1 } }
}

function doorAt(world: World, aim: Vec): OutlineTarget | null {
  const x = Math.floor(aim.x)
  const y = Math.floor(aim.y)
  const shut = doorTarget(world, x, y)
  if (shut) return shut
  // A doorway the player opened by hand can be shut again.
  if (tileAt(world.grid, x, y) !== 'air') return null
  for (const [key, door] of openedDoors(world)) {
    if (door.by !== 'player' || door.how === 'forced' || !door.tiles.some((tile) => tile.x === x && tile.y === y)) continue
    return { kind: 'door', key: `door:${key}`, box: boundsOf(door.tiles) }
  }
  return null
}

/** A window (glass, or an opening with wall above and a sill below) the player could go through from his side. */
function windowTarget(world: World, x: number, row: number): OutlineTarget | null {
  if (!Number.isFinite(x) || !Number.isFinite(row)) return null
  const player = world.player
  const side: 1 | -1 = player.x + player.w / 2 < x + 0.5 ? 1 : -1
  const spot = windowAt(world, x, row, side)
  if (!spot) return null
  return { kind: 'window', key: spot.key, box: { x: spot.x, y: spot.top, w: 1, h: spot.bottom - spot.top + 1 } }
}

function windowUnder(world: World, aim: Vec): OutlineTarget | null {
  const x = Math.floor(aim.x)
  const y = Math.floor(aim.y)
  const kind = tileAt(world.grid, x, y)
  // Open air is everywhere; only an opening with wall right above or below it within a few rows can be a window.
  if (kind !== 'glass' && kind !== 'air') return null
  return windowTarget(world, x, y)
}

// --- Boxes ---

function inside(box: Rect, at: Vec, slack: number): boolean {
  return at.x >= box.x - slack && at.x <= box.x + box.w + slack && at.y >= box.y - slack && at.y <= box.y + box.h + slack
}

function rectOf(box: Rect): Rect {
  return { x: box.x, y: box.y, w: box.w, h: box.h }
}

function grow(box: Rect, pad: number): Rect {
  return { x: box.x - pad, y: box.y - pad, w: box.w + pad * 2, h: box.h + pad * 2 }
}

/** Bounds of a set of tiles (each a whole tile) or, with `size` 0, of a set of points. */
function boundsOf(points: Vec[], size = 1): Rect {
  let [left, top, right, bottom] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const point of points) {
    left = Math.min(left, point.x)
    top = Math.min(top, point.y)
    right = Math.max(right, point.x + size)
    bottom = Math.max(bottom, point.y + size)
  }
  return { x: left, y: top, w: right - left, h: bottom - top }
}
