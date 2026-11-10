import type { Guard } from '../guards'

/**
 * Intel: the player starts without knowing where the gold case is. It sits in one of a few plausible
 * places, and what people say, papers and computers narrow the search, mostly correctly.
 */

/** The kinds of place the case can be kept in. */
export type PlaceKind = 'vault' | 'safe' | 'lab' | 'storage' | 'armory'
export type Side = 'west' | 'east'

/** One room the case could be in. `x`, `w` and `floorY` are its room's open span and floor row. */
export type Place = {
  id: number
  kind: PlaceKind
  roomId: number | null
  building: string
  storey: number
  side: Side
  x: number
  w: number
  floorY: number
}

/** How much a clue says: just the building, a band of storeys, the side, the kind of room, or the room itself. */
export type Detail = 'building' | 'band' | 'side' | 'kind' | 'room'

/** What a clue claims, in human terms. Each field present narrows the search; `place` names the room itself. */
export type ClueFilter = {
  building: string
  storeys?: { min: number; max: number }
  side?: Side
  kind?: PlaceKind
  place?: number
}

export type ClueSource = 'interrogation' | 'chatter' | 'document' | 'terminal'

export type Clue = {
  id: number
  source: ClueSource
  /** Who or what it came from, as the log names it ("Reyes", "notice board"). */
  origin: string
  /** Unique per person or object, so two clues only confirm each other when they come from different sources. */
  sourceKey: string
  filter: ClueFilter
  /** The place the source had in mind. Hidden from the player: it is the real place about 70% of the time. */
  about: number
  /** A second, independent source said the same. */
  confirmed: boolean
  /** The case has moved since, so this no longer describes where it is. */
  stale: boolean
}

export type IntelState = {
  places: Place[]
  /** Index in `places` of where the case really is (until it is taken). */
  real: number
  clues: Clue[]
  /** People who have already talked. */
  questioned: Set<Guard>
  /** Objects and overheard conversations already used, by key ('prop:12', 'device:3', 'chatter:4-9'). */
  used: Set<string>
  /** Ids of the papers (props) that hold something useful; the rest are rotas and memos. */
  documents: Set<number>
  /** The pair of guards being overheard, and for how long. */
  chatter: { pair: string; seconds: number } | null
  chatterTick: number
  /**
   * The guards' plan to move the case once the site is on alert: seconds of alarm so far, whether the move
   * has been called out, the place it is going to, how many times it has moved, and when it last did.
   */
  move: { alertSeconds: number; ordered: boolean; to: number | null; moves: number; movedAt: number }
  /** Bumped whenever the clues change, so the search area is only worked out again then. */
  version: number
}

export function createIntel(): IntelState {
  return {
    places: [], real: 0, clues: [], questioned: new Set(), used: new Set(), documents: new Set(),
    chatter: null, chatterTick: 0, move: { alertSeconds: 0, ordered: false, to: null, moves: 0, movedAt: -Infinity }, version: 0,
  }
}
