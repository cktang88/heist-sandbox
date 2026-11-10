import { propCenter, propsNear } from '../hazards/props'
import { pushAir } from '../hazards/smoke'
import type { PropKind } from '../propCatalog'
import { playSound } from '../sounds'
import { centerOf } from '../types'
import type { World } from '../world'
import type { FanMode, SystemAction } from './state'

/**
 * Ventilation. Each room with a fan unit can have it switched: extracting (smoke and gas drawn out of the room), or
 * blowing toward one side (pushing a cloud through a doorway into the next room). A terminal or the player's own
 * hands set it; it runs in the air tick.
 */
export const FAN_UNITS: ReadonlySet<PropKind> = new Set(['hvacUnit', 'wallAc', 'ceilingFan', 'roofVent', 'roofAcUnit', 'coolingUnit'])
/** Wall and ceiling units are reached by stretching up. */
const REACH = 3
const EXTRACT_SHARE = 0.25
const BLOW_SHARE = 0.5
const NEXT: Record<FanMode, FanMode> = { off: 'extract', extract: 'left', left: 'right', right: 'off' }
const PROMPTS: Record<FanMode, string> = { off: 'E: fan on (extract)', extract: 'E: fan to blow left', left: 'E: fan to blow right', right: 'E: fan off' }

/** For a terminal or the player: sets a room's ventilation. */
export function setFan(world: World, roomId: number, mode: FanMode): void {
  if (mode === 'off') world.systems.fans.delete(roomId)
  else world.systems.fans.set(roomId, mode)
}

export function fanMode(world: World, roomId: number): FanMode {
  return world.systems.fans.get(roomId) ?? 'off'
}

/** "E: switch fan" at a fan unit, in the `{ prompt, key, run }` shape the interact code uses. */
export function fanAction(world: World): SystemAction | null {
  const hand = centerOf(world.player)
  const unit = propsNear(world, hand, REACH).find((prop) => !prop.broken && FAN_UNITS.has(prop.kind) && prop.roomId !== undefined)
  if (!unit || unit.roomId === undefined) return null
  const room = unit.roomId
  const mode = fanMode(world, room)
  return {
    prompt: PROMPTS[mode], key: `fan:${unit.id}`,
    run: () => {
      setFan(world, room, NEXT[mode])
      playSound(world, 'switch', propCenter(unit))
    },
  }
}

/** One air tick: each running fan moves its room's air. */
export function stepFans(world: World, tick: number): void {
  const fans = world.systems.fans
  if (fans.size === 0 || !world.hazards.smoke?.active.length) return
  const width = world.grid.width
  for (const [id, mode] of fans) {
    const room = world.rooms.find((candidate) => candidate.id === id)
    if (!room) continue
    const share = (mode === 'extract' ? EXTRACT_SHARE : BLOW_SHARE) * tick * 4
    const step = mode === 'left' ? -1 : 1
    // Downstream first, so a tile's push is not carried on again in the same tick.
    for (let column = 0; column < room.w; column += 1) {
      const x = mode === 'left' ? room.x + column : room.x + room.w - 1 - column
      for (let y = room.y; y < room.y + room.h; y += 1) {
        const key = y * width + x
        pushAir(world, key, mode === 'extract' ? -1 : key + step, share)
      }
    }
  }
}
