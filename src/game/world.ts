import type { Charge } from './charges'
import type { FallingTile } from './collapse'
import type { Drone } from './drone'
import type { Effects } from './effects'
import type { Guard } from './guards'
import { createLevel, type Interior, type Lamp, type Prop } from './level'
import { mirrorLevel } from './mirror'
import { createPlayer, type Player } from './player'
import type { Projectile } from './projectiles'
import { createRng, type Rng } from './rng'
import type { Grid } from './tiles'
import type { SoundEvent } from './sounds'
import { createTime, type TimeState } from './time'
import type { Body, Rect } from './types'
import { createGuard } from './guards'

export type Loot = Body & { taken: boolean }
export type Pickup = Body & { kind: 'medkit' | 'ammo'; taken: boolean }
export type RunStats = { kills: number; tilesDestroyed: number; timesSpotted: number }

/** Everything about one heist in progress. Systems read and change this; rendering only reads it. */
export type World = {
  grid: Grid
  player: Player
  guards: Guard[]
  projectiles: Projectile[]
  charges: Charge[]
  falling: FallingTile[]
  /** Set when a tile is removed, so the next step checks whether anything lost its support. */
  structureChanged: boolean
  drone: Drone | null
  effects: Effects
  /** Sounds waiting to be played. Whoever plays them empties the list. */
  sounds: SoundEvent[]
  loot: Loot
  pickups: Pickup[]
  extraction: Rect
  interiors: Interior[]
  lamps: Lamp[]
  props: Prop[]
  time: TimeState
  alarm: boolean
  shake: number
  clock: number
  stats: RunStats
  status: 'playing' | 'won' | 'dead'
  rng: Rng
}

export function createWorld(seed: number): World {
  // Even seeds are flipped, so the van and the building swap sides.
  const level = seed % 2 === 0 ? mirrorLevel(createLevel(seed)) : createLevel(seed)
  return {
    grid: level.grid,
    player: createPlayer(level.playerStart),
    guards: level.guards.map((spawn) => createGuard(spawn)),
    projectiles: [],
    charges: [],
    falling: [],
    structureChanged: false,
    drone: null,
    effects: { particles: [], flashes: [] },
    sounds: [],
    loot: { x: level.loot.x, y: level.loot.y - 0.8, w: 0.8, h: 0.8, vx: 0, vy: 0, onGround: false, taken: false },
    pickups: level.pickups.map((spawn) => ({ x: spawn.x + 0.15, y: spawn.y - 0.6, w: 0.7, h: 0.6, vx: 0, vy: 0, onGround: false, kind: spawn.kind, taken: false })),
    extraction: level.extraction,
    interiors: level.interiors,
    lamps: level.lamps,
    props: level.props,
    time: createTime(),
    alarm: false,
    shake: 0,
    clock: 0,
    stats: { kills: 0, tilesDestroyed: 0, timesSpotted: 0 },
    status: 'playing',
    rng: createRng(seed ^ 0x9e3779b9),
  }
}
