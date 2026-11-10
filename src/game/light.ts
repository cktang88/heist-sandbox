import { isLampShot } from './ballistics/lampState'
import { lampPowered } from './devices/devices'
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
  const indoors = world.interiors.some((area) => area.kind === 'room' && at.x >= area.x && at.x < area.x + area.w && at.y >= area.y && at.y < area.y + area.h)
  const underground = at.y > world.groundY
  let level = indoors || underground ? 0.03 : world.timeOfDay === 'day' ? DAYLIGHT : MOONLIGHT
  for (const lamp of world.lamps) {
    const gap = Math.hypot(lamp.x - at.x, lamp.y - at.y)
    if (gap > lamp.radius || !lampIsLit(world, lamp) || !hasLineOfSight(world.grid, lamp, at)) continue
    level += lamp.strength * (1 - gap / lamp.radius)
    if (level >= 1) return 1
  }
  return Math.min(1, level)
}
