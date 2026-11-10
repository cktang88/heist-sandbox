import { isLampShot } from './ballistics/lampState'
import { lampPowered } from './devices/devices'
import { fireHeatAt, nearestFire } from './hazards/fire'
import { isSolidAt } from './tiles'
import type { Vec } from './types'
import { hasLineOfSight } from './vision'
import type { World } from './world'

const DAYLIGHT = 0.85
const MOONLIGHT = 0.12

/** How far above itself a hanging lamp looks for the ceiling it hangs from. Pendants and chandeliers hang low. */
const HANG_REACH = 6

/** Is this lamp giving light right now? It needs power, and a hung fitting needs the ceiling it hangs from. */
export function lampIsLit(world: World, lamp: World['lamps'][number]): boolean {
  if (!lampPowered(world, lamp) || isLampShot(world, lamp)) return false
  if (!lamp.hung) return true
  for (let rise = 0.7; rise <= HANG_REACH; rise += 1) if (isSolidAt(world.grid, lamp.x, lamp.y - rise)) return true
  return false
}

/**
 * How brightly lit a spot is, from 0 (pitch dark) to 1 (fully lit).
 * Guards spot people faster in the light, so cutting the power or shooting out lamps helps the player hide.
 */
export function lightLevelAt(world: World, at: Vec): number {
  const underground = at.y > world.groundY
  let level = underground || isIndoors(world, at) ? 0.03 : world.timeOfDay === 'day' ? DAYLIGHT : MOONLIGHT
  level += fireLight(world, at)
  if (level >= 1) return 1
  // Only lamps whose reach covers this spot's cell, in the same order as `world.lamps`, so the sum is unchanged.
  for (const lamp of lampsAround(world.lamps, at)) {
    const gap = Math.hypot(lamp.x - at.x, lamp.y - at.y)
    if (gap > lamp.radius || !lampIsLit(world, lamp) || !hasLineOfSight(world.grid, lamp, at)) continue
    level += lamp.strength * (1 - gap / lamp.radius)
    if (level >= 1) return 1
  }
  return Math.min(1, level)
}

/** A fire at full heat lights the room around it this far, as brightly as a strong lamp up close. */
const FIRE_LIGHT_RADIUS = 7
const FIRE_LIGHT_STRENGTH = 1.5
const FACE = 0.6

/** Light from the nearest fire in sight: flames are drawn as light, so they must light people for the guards too. */
function fireLight(world: World, at: Vec): number {
  const fire = nearestFire(world, at, FIRE_LIGHT_RADIUS)
  if (!fire) return 0
  const gap = Math.hypot(fire.x - at.x, fire.y - at.y)
  const heat = fireHeatAt(world, Math.floor(fire.x), Math.floor(fire.y))
  // A burning wall or floor is itself opaque: the light leaves from its face, not its middle.
  const face = gap > FACE ? { x: fire.x + ((at.x - fire.x) / gap) * FACE, y: fire.y + ((at.y - fire.y) / gap) * FACE } : at
  if (!hasLineOfSight(world.grid, face, at)) return 0
  return FIRE_LIGHT_STRENGTH * heat * (1 - gap / FIRE_LIGHT_RADIUS)
}

function isIndoors(world: World, at: Vec): boolean {
  for (const area of world.interiors) {
    if (area.kind === 'room' && at.x >= area.x && at.x < area.x + area.w && at.y >= area.y && at.y < area.y + area.h) return true
  }
  return false
}

type Lamp = World['lamps'][number]

/** Lamps are filed by the square cells of this many tiles their circle of light touches. */
const CELL = 8
const NO_LAMPS: readonly Lamp[] = []
const lampCells = new WeakMap<readonly Lamp[], { count: number; cells: Map<number, Lamp[]> }>()

/** Files the lamps by the cells they light now, during loading, rather than on the first look. */
export function indexLampLight(world: World): void {
  lampsAround(world.lamps, { x: 0, y: 0 })
}

/** Lamps that may light a spot: those whose circle touches its cell. Built once per lamp list. */
function lampsAround(lamps: readonly Lamp[], at: Vec): readonly Lamp[] {
  let index = lampCells.get(lamps)
  if (!index || index.count !== lamps.length) {
    const cells = new Map<number, Lamp[]>()
    for (const lamp of lamps) {
      for (let y = cellOf(lamp.y - lamp.radius); y <= cellOf(lamp.y + lamp.radius); y += 1) {
        for (let x = cellOf(lamp.x - lamp.radius); x <= cellOf(lamp.x + lamp.radius); x += 1) {
          const list = cells.get(cellKey(x, y))
          if (list) list.push(lamp)
          else cells.set(cellKey(x, y), [lamp])
        }
      }
    }
    index = { count: lamps.length, cells }
    lampCells.set(lamps, index)
  }
  return index.cells.get(cellKey(cellOf(at.x), cellOf(at.y))) ?? NO_LAMPS
}

function cellOf(value: number): number {
  return Math.floor(value / CELL)
}

/** Cell coordinates packed into one number; wide enough for any site, negative cells included. */
function cellKey(x: number, y: number): number {
  return (y + 1024) * 2048 + (x + 1024)
}
