import type { Charge } from '../charges'
import type { Frag } from '../frag/frag'
import type { Guard } from './model'
import type { Rope } from '../rope/rope'
import type { Lamp } from '../site'
import type { Vec } from '../types'

export type Tamper = 'door' | 'lock' | 'rope' | 'line' | 'window' | 'charge' | 'hostage' | 'blood' | 'radio'

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
  | { kind: 'fault'; at: Vec; what: 'lights' | 'camera' }
  /** A guard pinned down or alone under fire asking for help where he is. */
  | { kind: 'backup'; at: Vec; by: number }
  | { kind: 'explosion'; at: Vec }
  /** A door found open that should be shut, a lock found picked, or a climbing rope on the facade. */
  | { kind: 'tamper'; at: Vec; what: Tamper }
  | { kind: 'vault'; at: Vec; by: number }
  | { kind: 'parachute'; at: Vec }
  /** A fire seen by a guard (`alarm` false) or the fire alarm rung by a sprinkler opening (`alarm` true). */
  | { kind: 'fire'; at: Vec; alarm: boolean }
  /** A man found out cold (`by` the colleague who woke him), or one who came round by himself (`by` null). */
  | { kind: 'knockedOut'; at: Vec; guard: number; by: number | null }

/** A line a guard says out loud, shown above them for a moment. Barks explain what the guards are about to do. */
export type Bark = Vec & { text: string; life: number }

/** A guard who died, where and when: colleagues who know think twice before walking in there. */
export type Death = { at: Vec; room: number; clock: number; victim: number }

/**
 * A spot (feet position) where guards have been killed: a doorway, a stair head, a stretch of corridor the intruder has covered.
 * Nobody else walks into it for a while; they go round, throw something through it first (`clearedAt`), or wait.
 */
export type KillZone = { at: Vec; deaths: number; lastDeath: number; clearedAt: number }

/** Guards already answering trouble at a spot, so the next ones who hear it leave it to them. */
export type Response = { at: Vec; kind: 'noise' | 'gunfire' | 'blast'; count: number; clock: number }

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
  /** Dead lighting circuits the guards have already reacted to, and since when each dead circuit has been dead. */
  circuitsNoticed: Set<number>
  circuitsDeadSince: Map<number, number>
  /** Room id (or -1 outside rooms) to the clock time a fire there was last reported. */
  firesReported: Map<number, number>
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
  deaths: Death[]
  responses: Response[]
  /** Clock time the site locks down after a reported explosion. */
  lockdownAt: number
  /** Door keys (`x,bottomRow`) guards opened themselves, and doors already found open or picked. */
  guardDoors: Set<string>
  doorsNoticed: Set<string>
  /** Per camera device id: since when its feed has been dead, and whether that was reported. */
  camerasDeadSince: Map<number, number>
  camerasReported: Set<number>
  vaultReported: boolean
  /** Shot-out lamps and ropes a guard has already gone to look at. */
  lampsNoticed: Set<Lamp>
  ropesNoticed: Set<Rope>
  /** Clock time a parachute was last reported. */
  chuteReportedAt: number
  /** The last few lines spoken, so nobody repeats what was just said. */
  recentLines: string[]
  killZones: KillZone[]
  /** Shield teams called in so far, and when the last one was. */
  shieldTeams: number
  shieldTeamAt: number
  /** Frags guards have thrown that have not gone off yet (see guardFrags.ts). */
  guardFrags: Frag[]
  /** What has been noticed of the intruder's tricks (intrusions.ts): the grappling line, missing panes, charges, tied-up men. */
  lineNoticed: boolean
  panesNoticed: Set<string>
  chargesSeen: Set<Charge>
  tiedNoticed: Set<Guard>
  /** Clock time a freed colleague said the intruder was asking about the case. */
  caseAskedAt: number
}

export function createSecurity(): SecurityState {
  return {
    level: 0, lastKnown: null, lastContactAt: -Infinity, levelSince: 0, peak: 0, log: [], barks: [], polls: [],
    searched: new Map(), cameras: new Map(), commsDownSince: new Map(), commsReported: new Set(), circuitsNoticed: new Set(), circuitsDeadSince: new Map(), firesReported: new Map(),
    reportedBodies: new Set(), shooters: [], campSpot: null, campSeconds: 0,
    confirmedAt: -Infinity, focus: null, lastCasualtyAt: -Infinity, stationsAt: -Infinity, responders: 0, responseSent: false,
    deaths: [], responses: [], lockdownAt: Infinity, guardDoors: new Set(), doorsNoticed: new Set(), camerasDeadSince: new Map(), camerasReported: new Set(),
    vaultReported: false, lampsNoticed: new Set(), ropesNoticed: new Set(), chuteReportedAt: -Infinity, recentLines: [],
    killZones: [], shieldTeams: 0, shieldTeamAt: -Infinity, guardFrags: [],
    lineNoticed: false, panesNoticed: new Set(), chargesSeen: new Set(), tiedNoticed: new Set(), caseAskedAt: -Infinity,
  }
}
