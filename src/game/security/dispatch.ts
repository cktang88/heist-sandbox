import type { Vec } from '../types'
import type { World } from '../world'

/**
 * The security force as an organisation: the site alert level and what the control room knows.
 * (Placeholder: only tracks the level.)
 */
export type AlertLevel = 0 | 1 | 2 | 3 | 4
export type SecurityEvent =
  | { kind: 'sighting'; at: Vec; by: number }
  | { kind: 'noise'; at: Vec; loud: boolean }
  | { kind: 'body'; at: Vec; by: number }
  | { kind: 'missedCheckIn'; guard: number }
  | { kind: 'camera'; at: Vec; device: number }
  | { kind: 'alarmButton'; at: Vec }
  | { kind: 'commsDown'; at: Vec }

export type SecurityState = { level: AlertLevel; lastKnown: Vec | null; log: string[] }

export function createSecurity(): SecurityState {
  return { level: 0, lastKnown: null, log: [] }
}

export function stepSecurity(world: World, _dt: number): void {
  if (world.alarm && world.security.level < 3) world.security.level = 3
}

/** Tells the control room something happened. Guards, cameras and alarm buttons all report through this. */
export function reportEvent(_world: World, _event: SecurityEvent): void {}
