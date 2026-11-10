import type { Rng } from '../rng'
import type { Guard } from '../security/model'
import type { SiteKind, World } from '../world'

/**
 * The heist director: tonight's conditions, chosen from the seed before the drop, and the events it springs during
 * the heist. Everything it does goes through ordinary game state (guards' stations, circuits, radio lines, barks),
 * so the guards and the player meet it the same way they meet anything else.
 */

export type ConditionId =
  | 'rain' | 'storm' | 'backupPower' | 'skeletonCrew' | 'vipVisit' | 'shiftChange' | 'delivery'
  | 'scaffolding' | 'fireDrill' | 'party' | 'inspection' | 'rivalCrew'

/** A condition in play tonight. `line` is the one-line briefing; `step` runs every frame if present. */
export type ActiveCondition = {
  id: ConditionId
  line: string
  step?(world: World, dt: number): void
}

/** How a condition is chosen and started. `fits` rules it out for sites that lack what it needs. */
export type ConditionDef = {
  id: ConditionId
  fits(site: SiteKind): boolean
  /** Conditions that cannot share a night with this one. */
  excludes: readonly ConditionId[]
  start(world: World, rng: Rng): ActiveCondition
}

export type EventId =
  | 'smokeBreak' | 'blackout' | 'phoneCall' | 'patrolSwap' | 'wanderer' | 'chatter'
  | 'sweep' | 'courier' | 'evacuation' | 'engineer' | 'crawler' | 'deal'

/**
 * `raise` events add pressure (more eyes, a search, a fixed fuse); `release` events open a window (a post left empty,
 * the monitors unwatched, a dark building). The pacing rule picks by mood.
 */
export type Mood = 'raise' | 'release'

/** An event under way. `step` returns true when it is over; `outcome` says how it turned out, for the chronicle. */
export type RunningEvent = {
  id: EventId
  step(world: World, dt: number): boolean
  outcome(): string
}

/**
 * `timed` events are the director's own choice, made by the pacing rule. `reactive` ones answer something the player
 * did (`ready` says the trigger has happened) and fire with `chance` each time it is checked, at most `repeats` times.
 * `start` returns null when the world offers no one to do it right now.
 */
export type EventDef = {
  id: EventId
  kind: 'timed' | 'reactive'
  mood: Mood
  /** Seconds after it ends before it may happen again (reactive events only repeat). */
  cooldown: number
  repeats: number
  chance: number
  ready(world: World): boolean
  start(world: World, rng: Rng): RunningEvent | null
}

export type EventRecord = { id: EventId; at: number; mood: Mood }

export type DirectorState = {
  /** Off until the game turns it on, so tests of other systems see an untouched site. */
  enabled: boolean
  site: SiteKind
  /** The director's own random stream, from the seed: it never shifts the dice other systems roll. */
  rng: Rng
  /** Tonight's conditions, picked when the world is made so the briefing can show them before the drop. */
  picks: ConditionId[]
  conditions: ActiveCondition[]
  started: boolean
  running: RunningEvent[]
  history: EventRecord[]
  /** Clock time each event may next start. */
  cooldowns: Map<EventId, number>
  /** Clock time of the next pacing decision. */
  nextLook: number
  /** Clock time the last event started, for spacing. */
  lastEventAt: number
  /** 0 (dead calm) to 1 (all hell), worked out at each pacing decision. Kept for tests and the debug view. */
  tension: number
  /** What the pacing rule last wanted, and why, in a few words. */
  lastDecision: string
  /** Sound covering the player's own: rain outdoors (0..1 of a footstep drowned), and rooms loud with a party. */
  masking: { outdoors: number; rooms: Set<number> }
  /** Clock time of the last lightning flash, for the view. */
  lightningAt: number
  /** What the reactive events watch for, updated at each pacing look (see `watch.ts`). */
  signals: Signals
}

export type Signals = {
  /** Clock time a guard last had eyes on the player. */
  lastSeenAt: number
  /** Times the player has killed a lighting circuit (cut, shot or switched off a fuse box). */
  powerCuts: number
  /** Dead circuits as of the last look, and those the director killed itself (which are not the player's doing). */
  knownDead: Set<number>
  ownDead: Set<number>
  /** Guards out cold right now, and those who were out cold and have come round since the last look. */
  out: Set<Guard>
  woke: Guard[]
  /** Surrendered guards who have already offered a deal. */
  dealt: Set<Guard>
}
