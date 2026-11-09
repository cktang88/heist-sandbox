import type { Charge } from './charges'
import type { Drone } from './drone'
import type { Effects } from './effects'
import type { Guard } from './guards'
import { createLevel } from './level'
import { createPlayer, type Player } from './player'
import type { Projectile } from './projectiles'
import { createRng, type Rng } from './rng'
import type { Grid } from './tiles'
import { createTime, type TimeState } from './time'
import type { Body, Rect } from './types'
import { createGuard } from './guards'

export type Loot = Body & { taken: boolean }
export type RunStats = { kills: number; tilesDestroyed: number; timesSpotted: number }

/** Everything about one heist in progress. Systems read and change this; rendering only reads it. */
export type World = {
  grid: Grid
  player: Player
  guards: Guard[]
  projectiles: Projectile[]
  charges: Charge[]
  drone: Drone | null
  effects: Effects
  loot: Loot
  extraction: Rect
  time: TimeState
  alarm: boolean
  shake: number
  clock: number
  stats: RunStats
  status: 'playing' | 'won' | 'dead'
  rng: Rng
}

export function createWorld(seed: number): World {
  const level = createLevel(seed)
  return {
    grid: level.grid,
    player: createPlayer(level.playerStart),
    guards: level.guards.map(createGuard),
    projectiles: [],
    charges: [],
    drone: null,
    effects: { particles: [], flashes: [] },
    loot: { x: level.loot.x, y: level.loot.y - 0.8, w: 0.8, h: 0.8, vx: 0, vy: 0, onGround: false, taken: false },
    extraction: level.extraction,
    time: createTime(),
    alarm: false,
    shake: 0,
    clock: 0,
    stats: { kills: 0, tilesDestroyed: 0, timesSpotted: 0 },
    status: 'playing',
    rng: createRng(seed ^ 0x9e3779b9),
  }
}
