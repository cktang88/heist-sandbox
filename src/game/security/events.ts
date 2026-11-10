import type { Vec } from '../types'

/**
 * Site alert level, held by the control room:
 * 0 normal, 1 unease, 2 intruder suspected, 3 intruder confirmed, 4 lockdown.
 */
export type AlertLevel = 0 | 1 | 2 | 3 | 4

/** What reaches the control room. Guard numbers are indices into `world.guards`. */
export type SecurityEvent =
  | { kind: 'sighting'; at: Vec; by: number }
  | { kind: 'noise'; at: Vec; loud: boolean }
  | { kind: 'body'; at: Vec; by: number }
  | { kind: 'missedCheckIn'; guard: number }
  | { kind: 'camera'; at: Vec; device: number }
  | { kind: 'alarmButton'; at: Vec }
  | { kind: 'commsDown'; at: Vec }
  | { kind: 'fault'; at: Vec; what: 'lights' }
  /** A fire seen by a guard (`alarm` false) or the fire alarm rung by a sprinkler opening (`alarm` true). */
  | { kind: 'fire'; at: Vec; alarm: boolean }

/** A line a guard says out loud, shown above them for a moment. Barks explain what the guards are about to do. */
export type Bark = Vec & { text: string; life: number }

/** A missed check-in the control room is waiting on. */
export type Poll = { guard: number; at: number }

export type CameraWatch = { seen: number; cooldown: number }

export type SecurityState = {
  level: AlertLevel
  /** The control room's last known position of the intruder (body centre), from reports only. */
  lastKnown: Vec | null
  /** Clock time of the last report that confirmed the intruder's position. */
  lastContactAt: number
  /** Clock time the level last rose or was refreshed; it decays from here. */
  levelSince: number
  /** Highest level reached. The level never decays below what this has taught the guards. */
  peak: AlertLevel
  /** Recent radio traffic in plain English, oldest first. */
  log: string[]
  barks: Bark[]
  polls: Poll[]
  /** Rooms claimed by searchers, and when, so the next searchers prefer others. */
  searched: Map<number, number>
  cameras: Map<number, CameraWatch>
  /** Per building: since when every radio relay has been down, and whether that has been noticed. */
  commsDownSince: Map<string, number>
  commsReported: Set<string>
  /** Dead lighting circuits the guards have already reacted to. */
  circuitsNoticed: Set<number>
  /** Bodies (guard indices) already reported. */
  reportedBodies: Set<number>
  /** Guard indices allowed to fire aimed shots this frame. */
  shooters: number[]
  /** How long the player has stayed in one spot during a fight, for the flashbang. */
  campSpot: Vec | null
  campSeconds: number
  /** Clock time the level first reached 3 in the current alert, for the step up to lockdown. */
  confirmedAt: number
  /** Where the latest trouble was reported, which posts and stations are arranged around. */
  focus: Vec | null
  /** Clock time a guard was last hurt: a recent casualty makes the direct approach a killing zone. */
  lastCasualtyAt: number
  /** Clock time stations were last handed out. */
  stationsAt: number
  /** Response teams sent so far, and whether one has been sent for the current alert. */
  responders: number
  responseSent: boolean
}

export function createSecurity(): SecurityState {
  return {
    level: 0, lastKnown: null, lastContactAt: -Infinity, levelSince: 0, peak: 0, log: [], barks: [], polls: [],
    searched: new Map(), cameras: new Map(), commsDownSince: new Map(), commsReported: new Set(), circuitsNoticed: new Set(),
    reportedBodies: new Set(), shooters: [], campSpot: null, campSeconds: 0,
    confirmedAt: -Infinity, focus: null, lastCasualtyAt: -Infinity, stationsAt: -Infinity, responders: 0, responseSent: false,
  }
}
