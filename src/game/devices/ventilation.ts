import { FAN_UNITS, fanMode } from '../systems/fans'
import { setFan } from '../systems/systems'
import type { FanMode } from '../systems/state'
import type { Device, World } from '../world'

/**
 * A computer in a room with a fan unit runs its ventilation: one menu line that steps through the settings
 * (extract, push left, push right, off), so gas or smoke can be drawn out or pushed toward a door.
 */

const NEXT: Record<FanMode, FanMode> = { off: 'extract', extract: 'left', left: 'right', right: 'off' }
const NAMES: Record<FanMode, string> = { off: 'off', extract: 'extract', left: 'push left', right: 'push right' }

export function ventilationOption(world: World, device: Device): { label: string; run: () => void } | null {
  const room = device.roomId
  if (room === undefined || room === null) return null
  if (!world.props.some((prop) => prop.roomId === room && !prop.broken && FAN_UNITS.has(prop.kind))) return null
  const now = fanMode(world, room)
  const next = NEXT[now]
  return { label: `Ventilation (${NAMES[now]}): set to ${NAMES[next]}`, run: () => setFan(world, room, next) }
}
