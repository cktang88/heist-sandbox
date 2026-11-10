import type { Flash } from '../effects'
import { createRng, type Rng } from '../rng'
import type { Lamp } from '../site'
import type { Body, Vec } from '../types'

/**
 * State of the couplings between the world's systems: water and fuel lying on floors, live wires, energised
 * puddles, falling fittings, rolling vehicles, the player's rigged traps and the faults the site started with.
 * Everything here is sparse and empty on a quiet site, so stepping it costs next to nothing until something happens.
 */
export type LiquidKind = 'water' | 'fuel'

/** Water or fuel lying on floors: depth in tiles per open tile that has a floor under it. Made on first use. */
export type LiquidField = {
  kind: LiquidKind
  /** The grid size it was made for; a world given a new grid (tests) gets a new field. */
  size: number
  depth: Float32Array
  /** Scratch space for one tick's flows. */
  flow: Float32Array
  live: Uint8Array
  active: number[]
  /** Streams pouring off an edge, out of a pipe or down a stairwell during the last tick, for drawing and sound. */
  falls: Fall[]
}

export type Fall = { x: number; top: number; bottom: number; amount: number; kind: LiquidKind }

/** A burst pipe, an open valve, a holed fuel tank: pours `rate` tiles of liquid a second for `life` seconds. */
export type LiquidSource = Vec & { kind: LiquidKind; rate: number; life: number; tag: string }

/** A live cable hanging to the floor: from a fitting torn out of the ceiling, or one the player pulled down. */
export type LiveWire = Vec & { circuit: number | undefined; top: number }

/** A fitting coming down: a ceiling fan, a sign, a chandelier. `prop` is -1 for a lamp. */
export type FallingFitting = Vec & { w: number; h: number; vy: number; prop: number; lamp: Lamp | null; mass: number }

/** A vehicle with its handbrake off, rolling along the floor. */
export type RollingVehicle = { prop: number; vx: number; travelled: number }

/** A loud way to know someone opened a door: a bucket or a chair wedged above it falls on whoever opens it. */
export type RiggedDoor = Vec

/** A timer the player set on a light switch: when it runs out the circuit flips, sparking every fitting on it. */
export type SwitchTimer = { circuit: number; left: number }

export type FanMode = 'off' | 'extract' | 'left' | 'right'

/** A seeded fault: a dripping pipe, a sparking lamp, a gas ring left on, a loose chandelier or fan. */
export type FaultKind = 'leak' | 'sparkingLamp' | 'gasRing' | 'looseFitting'
export type Fault = Vec & { kind: FaultKind; lamp: Lamp | null; prop: number; clock: number }

/** Something the player can do with E, in the shape the interact code uses: a single press, or a hold of `hold` seconds. */
export type SystemAction = { prompt: string; key: string; run: () => void; hold?: number }

export type ShotTrail = { shot: object; x: number; y: number; vx: number; vy: number }

export type SystemsState = {
  seed: number
  /**
   * The couplings' own random numbers, seeded from the heist seed: as deterministic as `world.rng`, but drawing
   * from it does not reshuffle every other system's rolls whenever a floor gets wet.
   */
  rng: Rng
  water: LiquidField | null
  fuel: LiquidField | null
  sources: LiquidSource[]
  /** Tile key to the circuit energising it, rebuilt every liquid tick while anything live touches water. */
  energized: Map<number, number | undefined>
  /** Circuit to seconds it has been earthed through water; it trips when this runs long enough. */
  earthing: Map<number | undefined, number>
  wires: LiveWire[]
  /** People's next allowed shock, keyed by the person, so one puddle does not hit every frame. */
  shockedUntil: WeakMap<object, number>
  slipUntil: WeakMap<object, number>
  stepClock: WeakMap<object, number>
  /** Guards standing in water deep enough to slow them, found at the people tick and dragged every frame. */
  wading: Body[]
  falling: FallingFitting[]
  rolling: RollingVehicle[]
  rigged: RiggedDoor[]
  timers: SwitchTimer[]
  fans: Map<number, FanMode>
  faults: Fault[]
  faultsSeeded: boolean
  /** Things already set off, so each reacts once: burst pipe tiles, water fixtures, holed tanks, fallen fittings. */
  burst: Set<number>
  spentProps: Set<number>
  /** Electronics that have soaked long enough to short, by prop id, and seconds soaked so far. */
  soaking: Map<number, number>
  /** Tile key to seconds of fire exposure: slabs weakening, glass cracking, doors heating. */
  heat: Map<number, number>
  /** Door tile key to seconds it stays too hot to touch. */
  hotDoors: Map<number, number>
  hissed: Set<number>
  /** Bullets seen last frame, so one that stopped this frame still had its last stretch checked. */
  trails: ShotTrail[]
  seenFlashes: WeakSet<Flash>
  /** Lighting circuits that were dead last frame, to spot a switch being thrown. */
  deadBefore: Set<number>
  /** Grid change list position (see `changeMark`) for doors opening and walls breaking. */
  changeMark: number
  changeGrid: object | null
  liquidClock: number
  heatClock: number
  scanClock: number
  fallClock: number
  peopleClock: number
}

export function createSystems(seed: number): SystemsState {
  return {
    seed, rng: createRng(seed ^ 0x5bd1e995), water: null, fuel: null, sources: [], energized: new Map(), earthing: new Map(), wires: [],
    shockedUntil: new WeakMap(), slipUntil: new WeakMap(), stepClock: new WeakMap(), wading: [], falling: [], rolling: [], rigged: [],
    timers: [], fans: new Map(), faults: [], faultsSeeded: false, burst: new Set(), spentProps: new Set(), soaking: new Map(),
    heat: new Map(), hotDoors: new Map(), hissed: new Set(), trails: [], seenFlashes: new WeakSet(), deadBefore: new Set(),
    changeMark: 0, changeGrid: null, liquidClock: 0, heatClock: 0, scanClock: 0, fallClock: 0, peopleClock: 0,
  }
}
