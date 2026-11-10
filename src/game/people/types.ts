import type { Guard, InterestKind } from '../security/model'
import type { Rng } from '../rng'

/**
 * People: who the guards are. Every guard on the site's own roster gets a name, a rank, an age, years on the job,
 * a couple of traits that change how he behaves, a line of life, colleagues he likes or hates, and a memory of
 * what happened to him tonight. Guards brought in later (the response team) only get a name and a rank.
 */

export type TraitId =
  | 'jumpy' | 'lazy' | 'byTheBook' | 'brave' | 'coward' | 'sharpEyed' | 'halfDeaf' | 'nightBlind' | 'smoker'
  | 'chatty' | 'greedy' | 'loyal' | 'triggerHappy' | 'careful' | 'clumsy' | 'green' | 'hungover'

export type AgeBand = '20s' | '30s' | '40s' | '50s'

/**
 * `friends`, `rivals`, `partners` (walk the same beat), `mentor` (the first person is the mentor of the second),
 * `brothers`, `couple`, `debt` (the first owes the second money).
 */
export type BondKind = 'friends' | 'rivals' | 'partners' | 'mentor' | 'brothers' | 'couple' | 'debt'

/** A relationship between two people (ids in `PeopleState.persons`). Order matters only for `mentor` and `debt`. */
export type Bond = { kind: BondKind; a: number; b: number }

/** What happened to a person tonight, in the order it happened. `about` is another person's id. */
export type MemoryKind =
  | 'knockedOut' | 'woke' | 'surrendered' | 'spared' | 'restrained' | 'hostage' | 'wounded' | 'sawPlayer'
  | 'shotAt' | 'falseAlarm' | 'friendDied' | 'foundBody' | 'berserk' | 'brokeDown' | 'killed'
export type Memory = { kind: MemoryKind; clock: number; about?: number }

/** What a returning guard has become since the heist he met the player on. */
export type Grudge = 'vengeful' | 'terrified' | 'grateful' | 'wary'

/** A guard from an earlier heist, on this site tonight. `greeted` once he has told the player so. */
export type Returning = { remembered: Remembered; grudge: Grudge; greeted: boolean; lookedAway: boolean }

/** A small act a calm guard does while pausing. The renderer may show it as a pose. */
export type ActName = 'yawn' | 'stretch' | 'phone' | 'hum' | 'smoke' | 'coffee' | 'chat' | 'scold' | 'speech' | 'noticeboard' | 'lean' | 'trip'
export type Act = { name: ActName; until: number; with: number | null }

/** What the player has learned about a person, for the dossier. */
export type Knowledge = {
  seen: boolean
  /** Heard his name, questioned him or took his papers. */
  named: boolean
  questioned: boolean
  papers: boolean
  traits: TraitId[]
  bonds: number[]
}

export type Person = {
  id: number
  guard: Guard
  first: string
  last: string
  rank: string
  age: AgeBand
  years: number
  traits: TraitId[]
  life: string
  /** On the site's own roster: traits, bonds, memory and talk apply. Late arrivals only have a name. */
  roster: boolean
  memories: Memory[]
  /** Memories he has already talked about, so each story is told once. */
  told: MemoryKind[]
  act: Act | null
  /** Where his feet last were and since when they have not moved (for a detour he cannot finish). */
  still: { x: number; y: number; since: number }
  /** A knocked-out partner he is standing over (person id). */
  guarding: number | null
  /** Clock time he may next do something idle, and next say something of his own. */
  nextActAt: number
  nextTalkAt: number
  /** Clock time he may next wander over to a friend for a chat. */
  nextChatAt: number
  /** What his guard looked like at his last tick, to see what changed. */
  seen: Snapshot
  /** Clock until which grief has made him fearless. */
  berserkUntil: number
  returning: Returning | null
  knowledge: Knowledge
}

export type Snapshot = {
  mode: Guard['mode']
  awareness: number
  shock: number
  hp: number
  stunned: boolean
  bodies: number
  restrained: boolean
  wait: number
  interest: InterestKind | null
}

/** The record a guard leaves for later heists. Plain data so it can be stored as JSON. */
export type Remembered = {
  first: string
  last: string
  rank: string
  traits: TraitId[]
  /** The site and heist count where he met the player. */
  site: string
  heist: number
  what: 'spared' | 'humiliated' | 'wounded' | 'saw'
}

export type PeopleState = {
  persons: Person[]
  byGuard: Map<Guard, Person>
  bonds: Bond[]
  rng: Rng
  /** Lines said lately, so nobody repeats one. */
  recent: string[]
  /** Round-robin position and leftover time of the staggered tick. */
  cursor: number
  budget: number
  /** Persons who died tonight, by id, so each death is mourned once. */
  mourned: Set<number>
  /** Polls the control room is making that a friend has already covered. */
  covered: Set<number>
  /** What the guards have seen the intruder do (rope, wall, dark...), for describing him. */
  deeds: Set<Deed>
  /** Heist number, counted across heists by the nemesis store; 0 when unknown. */
  heist: number
  /** The guard list last seen, so persons whose guard has left the game are passed over. */
  active: Set<Guard>
  activeFrom: Guard[] | null
  activeCount: number
  /** The human shield last seen, and guards who held fire for a friend and will hesitate once he is let go. */
  shieldWas: Guard | null
  hesitant: Set<Guard>
  /** Missing guards whose friends have already said something about it (person ids). */
  lamented: Set<number>
  /** Clock time of the last slow (four times a second) pass. */
  slowAt: number
  /** For the chronicle and other systems: what colleagues call this guard. */
  nameOf: (guard: Guard) => string
  personOf: (guard: Guard) => Person | undefined
}

export type Deed = 'rope' | 'line' | 'window' | 'wall' | 'explosives' | 'chute' | 'dark' | 'shield' | 'choke' | 'tied'
