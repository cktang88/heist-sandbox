import type { Blast } from '../explosions'
import type { NoiseSource } from '../security/hearing'
import type { Body, Vec } from '../types'
import type { World } from '../world'
import type { PropBuckets } from './buckets'

export type GrenadeKind = 'smoke' | 'flash'

/** One burning tile. `fuelled` says what feeds it; an unfed fire only flares for `flare` seconds. */
export type Fire = {
  x: number
  y: number
  /** 0..1. Grows while fed, fades while starved. Drives spread, light and damage. */
  heat: number
  flare: number
  /** The room the tile is in, or -1. Found once when the fire starts, since looking it up is not free. */
  room: number
}

/**
 * A thrown grenade. A flashbang is gone once it pops; a smoke grenade lies there pouring smoke for `smokeLeft`
 * seconds into `cloud`, the tiles around it it fills. `thrower` says whose it is: guards hear their own side's bang
 * differently, and a guard who heard "Flash out!" looks away.
 */
export type Grenade = Body & { kind: GrenadeKind; fuse: number; popped: boolean; smokeLeft: number; cloud: number[]; thrower: NoiseSource }

export type SprayKind = 'water' | 'foam' | 'steam' | 'gas'
/** A jet or shower from a burst prop. `spread` is the half-angle of its cone in radians. */
export type Spray = Vec & { angle: number; spread: number; reach: number; kind: SprayKind; life: number }

/** A broken gas line or stove leaking flammable gas. */
export type GasLeak = Vec & { life: number }

/** A reactive prop that has been set off and goes bang after a very short fuse, so chains ripple. */
export type PendingBlast = Vec & { fuse: number; blast: Blast; prop: number }

export type FlashState = Vec & { life: number }

/** The smoke and gas field: one value per tile in typed arrays, made on first use; only `active` cells are stepped. */
export type SmokeField = {
  /** Screening smoke, toxic fire smoke, short-lived foam, and flammable gas. Smoke values above 1 mean pressure. */
  screen: Float32Array
  toxic: Float32Array
  foam: Float32Array
  gas: Float32Array
  /** Scratch space for one step's flows, kept to avoid allocating every tick. */
  flow: Float32Array[]
  /** Tiles holding anything, `live` marking the same tiles; `seen` stamps the tiles visited in one tick. */
  active: number[]
  live: Uint8Array
  seen: Int32Array
  stamp: number
  gasCells: number
}

/** Which props cover which tiles, built on first use so the fire can find furniture without scanning every prop. */
export type PropIndex = { byTile: PropBuckets; sprinklersByRoom: Map<number, number[]> }

export type HazardState = {
  fires: Map<number, Fire>
  /** Prop id to seconds of burning left. */
  burningProps: Map<number, number>
  /** Props that have burnt out but cannot be destroyed (rugs, blinds), so they do not catch again. */
  burntProps: Set<number>
  /** Prop id to seconds spent sitting in fire, for things that cook off rather than burn. */
  cooking: Map<number, number>
  /** Props whose break reaction has already happened, so a prop never reacts twice. */
  reacted: Set<number>
  /** Tile key to seconds it stays wet. Wet tiles neither burn nor catch. */
  wet: Map<number, number>
  /** Room id to seconds it has been on fire, and rooms whose sprinklers are running. */
  roomFire: Map<number, number>
  sprinkling: Map<number, number>
  smoke: SmokeField | null
  grenades: Grenade[]
  sprays: Spray[]
  leaks: GasLeak[]
  blasts: PendingBlast[]
  flashes: FlashState[]
  fireClock: number
  smokeClock: number
  harmClock: number
  soundClock: number
  /** Gunshot and spark sounds already checked against gas. */
  heardShots: WeakSet<object>
  propIndex: PropIndex | null
}

export function createHazards(): HazardState {
  return {
    fires: new Map(), burningProps: new Map(), burntProps: new Set(), cooking: new Map(), reacted: new Set(), wet: new Map(),
    roomFire: new Map(), sprinkling: new Map(), smoke: null, grenades: [], sprays: [], leaks: [], blasts: [], flashes: [],
    fireClock: 0, smokeClock: 0, harmClock: 0, soundClock: 2, heardShots: new WeakSet(), propIndex: null,
  }
}

export function tileKey(world: World, x: number, y: number): number {
  return y * world.grid.width + x
}
