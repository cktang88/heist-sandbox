import type { Input } from '../input'
import { reportEvent } from '../security/dispatch'
import type { Lamp } from '../site'
import { playSound } from '../sounds'
import type { Device, World } from '../world'
import { deviceCenter } from './power'
import { deviceState } from './state'

export type { Terminal } from './terminal'
export { terminalConsumesInput } from './terminal'
export { restoreCircuit } from './power'
export { revealedRooms } from './state'
export { isDoorUnlocked, keypadFor } from './locks'

/**
 * Cameras, computers, fuse boxes, keypads and alarm buttons. The player works them through `interact`;
 * here they only tick: devices switched off for a while by a terminal come back on.
 */
export function stepDevices(world: World, _input: Input, dt: number): void {
  const timers = deviceState(world).offTimers
  for (const [id, seconds] of timers) {
    if (seconds > dt) {
      timers.set(id, seconds - dt)
      continue
    }
    timers.delete(id)
    const device = world.devices.find((candidate) => candidate.id === id)
    if (device) device.disabled = false
  }
}

/** Is this lighting circuit still powered? Cutting a fuse box kills its circuit. */
export function isCircuitLive(world: World, circuit: number | undefined): boolean {
  return circuit === undefined || !world.deadCircuits.has(circuit)
}

export function lampPowered(world: World, lamp: Lamp): boolean {
  return isCircuitLive(world, lamp.circuit)
}

/** For the security AI: a guard hits the panic button. A button the player has disabled does nothing. Returns whether it worked. */
export function pressAlarmButton(world: World, device: Device): boolean {
  if (device.kind !== 'alarmButton' || device.disabled) return false
  const at = deviceCenter(device)
  playSound(world, 'alarm', at)
  reportEvent(world, { kind: 'alarmButton', at })
  return true
}
