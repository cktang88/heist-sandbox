import type { Vec } from '../types'

/**
 * The chronicle: the notable moments of a heist, written down as they happen, with time and place, so that at the
 * end they can be told as a story. It only watches public state; it never changes the game.
 */

export type BeatKind =
  | 'tonight' // a condition in play (detail: its id)
  | 'landed' // the parachute came down (place)
  | 'entered' // first time inside a building (detail: how)
  | 'down' // a guard taken out (who; detail: how; n: 1 for the first)
  | 'spotted' // seen by a guard (who; n: how many times so far)
  | 'firstShot' // detail: the weapon
  | 'explosion' // n: how many so far
  | 'alert' // the site alert level rose (n: the level, detail: the cause)
  | 'bodyFound' // who: the dead man
  | 'clue' // detail: what it said; who: where it came from; truth: whether it pointed at the right place
  | 'caseMoved' // the guards moved the case (place: where to)
  | 'caseFound' // the player picked it up (place; detail: what the clues said, if anything)
  | 'hidden' // stayed hidden near searching guards (n: seconds, detail: how many searched, how hidden)
  | 'lowHealth'
  | 'nearMiss'
  | 'collapse' // a storey or more came down (n: tiles)
  | 'vehicle' // a vehicle burned or blew up (detail: what)
  | 'fire' // a fire took hold (n: largest number of tiles burning at once)
  | 'surrender' // who
  | 'fled' // who
  | 'tied' // who: tied up and left alive
  | 'event' // a director event or condition moment (detail: its id; outcome: how it went)
  | 'escaped'
  | 'died'

export type Beat = {
  kind: BeatKind
  /** Seconds of game time since the drop. */
  t: number
  /** Where, in words: "the 6th-floor office of the tower". Empty when it does not matter. */
  place: string
  /** Who, by name when the guard has one. */
  who?: string
  detail?: string
  n?: number
  /** For clues: whether the source had the right place in mind when it spoke. */
  truth?: boolean
  /** How a director event turned out, filled in when it ends. */
  outcome?: string
}

/** The running numbers shown at the end, besides what `World.stats` holds. */
export type Tally = {
  knockedOut: number
  tiedUp: number
  /** Times the site reached alert level 3 or more. */
  alarms: number
  peakLevel: number
  seenBy: Set<number>
  shots: number
  explosions: number
  maxFire: number
  collapses: number
  vehiclesLost: number
  closeCalls: number
  surrendered: number
}

/** A run of time spent hiding while guards searched close by. */
export type HideStreak = { since: number; searchers: Set<number>; place: string; how: string }

/** A tile that changed near the player before he first got inside: what it was and what it became. */
export type Opening = Vec & { t: number; from: number; to: number }

export type ChronicleState = {
  beats: Beat[]
  tally: Tally
  player: { landed: boolean; inside: boolean; rounds: number; lowHealth: boolean; hasLoot: boolean; status: string; lastShotAt: number; lastShotTool: string; nearby: Set<object> }
  security: { level: number; spotted: number; bodies: number; clues: number; moves: number; lastSpottedBeat: number }
  /** Per guard index: mode at the last look, and whether he was out cold or tied up. */
  guards: { modes: string[]; out: boolean[]; tied: boolean[] }
  /** Before the player is first inside: a copy of the tile kinds and the recent changes near him, to tell how he got in. */
  entry: { kinds: Uint8Array | null; mark: number; openings: Opening[] }
  destruction: { blasts: WeakSet<object>; lastBlast: (Vec & { t: number }) | null; lastBlastBeat: number; falling: boolean; lastFireAt: number; blaze: boolean; vehicles: number[] | null; wrecked: Set<number> }
  hide: HideStreak | null
  /** Seconds until the next slow look (guards, fires, hiding). */
  slowTimer: number
}

export function createChronicle(): ChronicleState {
  return {
    beats: [],
    tally: { knockedOut: 0, tiedUp: 0, alarms: 0, peakLevel: 0, seenBy: new Set(), shots: 0, explosions: 0, maxFire: 0, collapses: 0, vehiclesLost: 0, closeCalls: 0, surrendered: 0 },
    player: { landed: false, inside: false, rounds: -1, lowHealth: false, hasLoot: false, status: 'playing', lastShotAt: -Infinity, lastShotTool: '', nearby: new Set() },
    security: { level: 0, spotted: 0, bodies: 0, clues: 0, moves: 0, lastSpottedBeat: -Infinity },
    guards: { modes: [], out: [], tied: [] },
    entry: { kinds: null, mark: 0, openings: [] },
    destruction: { blasts: new WeakSet(), lastBlast: null, lastBlastBeat: -Infinity, falling: false, lastFireAt: -Infinity, blaze: false, vehicles: null, wrecked: new Set() },
    hide: null,
    slowTimer: 0,
  }
}
