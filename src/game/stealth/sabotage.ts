import { flipPower } from '../devices/power'
import type { Device, World } from '../world'
import { SABOTAGE } from './tuning'

/**
 * A breaker rigged to trip later: the lights go out on a timer while the player is somewhere else, and the guard sent
 * to the fuse box finds nobody there. Rigging is quiet; the trip clunks like any thrown breaker.
 */

export function isRigged(world: World, device: Device): boolean {
  return world.stealth.rigged.some((rig) => rig.device === device.id)
}

export function rigBreaker(world: World, device: Device): void {
  if (isRigged(world, device)) return
  world.stealth.rigged.push({ device: device.id, at: world.clock + SABOTAGE.delay })
}

/** Seconds until a rigged breaker trips, or null. */
export function rigSecondsLeft(world: World, device: Device): number | null {
  const rig = world.stealth.rigged.find((candidate) => candidate.device === device.id)
  return rig ? Math.max(0, rig.at - world.clock) : null
}

export function stepRigged(world: World): void {
  const due = world.stealth.rigged.filter((rig) => world.clock >= rig.at)
  if (due.length === 0) return
  world.stealth.rigged = world.stealth.rigged.filter((rig) => world.clock < rig.at)
  for (const rig of due) {
    const device = world.devices.find((candidate) => candidate.id === rig.device)
    if (device && device.circuit !== undefined && !world.deadCircuits.has(device.circuit)) flipPower(world, device)
  }
}
