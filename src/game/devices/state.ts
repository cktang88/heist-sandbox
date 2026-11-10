import type { Vec } from '../types'
import type { World } from '../world'

/**
 * What the device system remembers between frames that has no field on `World` yet:
 * doors a terminal or keypad hack has unlocked, rooms the player has found on a map,
 * and how long each temporarily disabled device stays off.
 */
export type DeviceState = {
  /** Door tiles that open at a touch, keyed by `doorKey`. */
  unlockedDoors: Set<string>
  /** Room ids the player has had revealed (e.g. the vault), for the HUD map. */
  revealed: Set<number>
  /** Device id to seconds left before it switches itself back on. */
  offTimers: Map<number, number>
  /** What the player has been holding E on, so switching target restarts the progress. */
  holding: string | null
  /** Seconds until the next keyboard clatter while hacking. */
  typing: number
}

const states = new WeakMap<World, DeviceState>()

export function deviceState(world: World): DeviceState {
  let state = states.get(world)
  if (!state) {
    state = { unlockedDoors: new Set(), revealed: new Set(), offTimers: new Map(), holding: null, typing: 0 }
    states.set(world, state)
  }
  return state
}

export function doorKey(tile: Vec): string {
  return `${tile.x},${tile.y}`
}

/** Room ids revealed by a hacked terminal. The HUD can mark them on its map. */
export function revealedRooms(world: World): ReadonlySet<number> {
  return deviceState(world).revealed
}
