import { doorwaysOf } from '../complex/access'
import { HIDING_KINDS } from '../furnish/hides'
import type { Level } from '../site'
import { tileAt } from '../tiles'

/**
 * The measurable promises a stealth player relies on, checked on a generated site without playing it:
 * every door can be worked from both sides, there are several quiet ways into the tower and at least two into every
 * room the case can be in, each storey has places to hide, and every camera has a blind spot.
 */

/** Devices that take the E key over a door when in reach (see interact.ts). Keypads are meant to: hacking one opens its door. */
const NEAR_DEVICES = new Set(['fusebox', 'computer', 'alarmButton', 'radioRelay', 'elevatorPanel'])
const DEVICE_REACH = 1.8

/** Shut doors that someone standing against them, on one side or the other, cannot open because a device wins the E key. */
export function doorsBlockedByDevices(level: Level): string[] {
  const problems: string[] = []
  const seen = new Set<string>()
  for (const room of level.rooms) {
    for (const door of doorwaysOf(level.grid, room).filter((doorway) => !doorway.open)) {
      for (const side of [-1, 1] as const) {
        const key = `${door.x},${door.floorY},${side}`
        if (seen.has(key)) continue
        seen.add(key)
        // Standing against the door, crouched or standing.
        const spots = [0.75, 1.1].flatMap((gap) => [0.5, 0.8].map((up) => ({ x: door.x + 0.5 + side * gap, y: door.floorY - up })))
        const blocked = spots.every((spot) => level.devices.some((device) => NEAR_DEVICES.has(device.kind)
          && Math.hypot(device.x + 0.5 - spot.x, device.y + 0.5 - spot.y) <= DEVICE_REACH))
        if (blocked) problems.push(`door at ${door.x},${door.floorY} cannot be opened from the ${side < 0 ? 'left' : 'right'}`)
      }
    }
  }
  return problems
}

export type Entry = 'street door' | 'roof stairs' | 'sewer hatch' | 'sky bridge' | 'window'

/** The different quiet ways into the tower this site offers. */
export function quietEntries(level: Level): Entry[] {
  const entries = new Set<Entry>()
  const tower = level.rooms.filter((room) => room.building === 'tower')
  const x0 = Math.min(...tower.map((room) => room.x)) - 1
  const x1 = Math.max(...tower.map((room) => room.x + room.w))
  const street = level.groundY
  if ([x0, x1].some((x) => tileAt(level.grid, x, street - 1) === 'door')) entries.add('street door')
  const roof = tower.find((room) => room.kind === 'rooftop')
  if (roof && level.stairwells.some((well) => well.building === 'tower' && well.stops.includes(roof.floorY))) entries.add('roof stairs')
  const lowest = Math.max(...tower.map((room) => room.floorY))
  for (let x = x0; x <= x1; x += 1) if (tileAt(level.grid, x, lowest) === 'door' && tileAt(level.grid, x, lowest + 1) === 'ladder') entries.add('sewer hatch')
  // The sky bridge joins the tower's outer wall through a door well above the street.
  for (const x of [x0, x1]) {
    for (let y = street - 7; y > street - 60; y -= 1) if (tileAt(level.grid, x, y) === 'door' && tileAt(level.grid, x, y + 1) !== 'door' && isBridgeDeck(level, x, y + 1)) entries.add('sky bridge')
  }
  for (const x of [x0, x1]) {
    for (let y = 0; y < street; y += 1) if (tileAt(level.grid, x, y) === 'glass') entries.add('window')
  }
  return [...entries]
}

/** A deck runs out from the wall at this row (the bridge's floor). */
function isBridgeDeck(level: Level, wall: number, row: number): boolean {
  const outside = [wall - 2, wall + 2].filter((x) => !level.rooms.some((room) => room.building === 'tower' && x >= room.x && x < room.x + room.w))
  return outside.some((x) => tileAt(level.grid, x, row) === 'concrete')
}

/** Hiding places (lockers, closets, stalls, cabinets, dumpsters) on each storey of a building. */
export function hidesPerStorey(level: Level, building: string): Map<number, number> {
  const counts = new Map<number, number>()
  const rooms = new Map(level.rooms.map((room) => [room.id, room]))
  for (const room of level.rooms) if (room.building === building && room.kind !== 'rooftop') counts.set(room.storey, counts.get(room.storey) ?? 0)
  for (const prop of level.props) {
    const room = prop.roomId === undefined ? undefined : rooms.get(prop.roomId)
    if (!room || room.building !== building || !HIDING_KINDS.has(prop.kind)) continue
    counts.set(room.storey, (counts.get(room.storey) ?? 0) + 1)
  }
  return counts
}

/** How close the player must be to a camera to cut its cable (interact.ts). */
const CAMERA_REACH = 3.8

/**
 * Floor spots under a camera, in reach of its cable, that its sweeping cone never covers: where a player stands to cut it
 * unseen. Sampled over a whole sweep. Empty means the camera cannot be approached without being on its feed.
 */
export function cameraBlindSpots(level: Level, camera: Level['devices'][number], sweep: { halfAngle: number; sweep: number; tilt: number; range: number }): number[] {
  const room = level.rooms.find((candidate) => candidate.id === camera.roomId)
  if (!room) return []
  const origin = { x: camera.x + 0.5, y: camera.y + 0.5 }
  const facing = camera.facing ?? 1
  const blind: number[] = []
  for (let x = room.x + 0.5; x < room.x + room.w; x += 0.5) {
    const body = { x, y: room.floorY - 0.8 }
    if (Math.hypot(body.x - origin.x, body.y - origin.y) > CAMERA_REACH) continue
    const angle = Math.atan2(body.y - origin.y, body.x - origin.x)
    let seen = false
    for (let step = 0; step <= 40 && !seen; step += 1) {
      const swing = Math.sin((step / 40) * Math.PI * 2) * sweep.sweep
      const centre = (facing > 0 ? sweep.tilt : Math.PI - sweep.tilt) + swing * facing
      const off = Math.abs(Math.atan2(Math.sin(angle - centre), Math.cos(angle - centre)))
      seen = off <= sweep.halfAngle
    }
    if (!seen) blind.push(x)
  }
  return blind
}
