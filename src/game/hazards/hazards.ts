import { TILE_DEFS, tileAt } from '../tiles'
import type { Vec } from '../types'
import type { World } from '../world'
import { igniteProp, stepBurningProps } from './burning'
import { FLARE_SECONDS, startFire, stepFires, tileBurns } from './fire'
import { igniteGasNear, listenForShots, stepLeaks } from './gas'
import { stepFlashes, stepGrenades } from './grenades'
import { harmPeople } from './harm'
import { propsAt, propsNear } from './props'
import { blastReachesProps, stepBlasts } from './reactions'
import { stepSmoke } from './smoke'
import { runSprinklers, soak, stepSprays } from './sprays'
import type { HazardState } from './state'

/**
 * Fire, smoke, gas, water and thrown grenades. Fire and smoke live on sparse per-tile maps, so a quiet site
 * costs nothing to step; fire ticks ten times a second and smoke twenty, whatever the frame rate.
 */
export { createHazards, type GrenadeKind, type HazardState } from './state'
export { throwGrenade } from './grenades'
export { propBroke } from './reactions'
export { smokeBetween, smokeDensityAt, toxicAt, MAX_SMOKE_CELLS } from './smoke'
export { isBurningAt, nearestFire, MAX_FIRES } from './fire'
export { isWetAt } from './sprays'
export { fireCells, smokeCells, grenadeViews, sprayViews, flashViews } from './views'
export type { FireCell, SmokeCell, GrenadeView, SprayView, FlashView } from './views'

const FIRE_TICK = 0.1
const SMOKE_TICK = 0.05
const HARM_TICK = 0.5
/** After a long hitch, skip ahead rather than run many catch-up ticks in one frame. */
const MAX_TICKS_PER_FRAME = 3
const BLAST_FLARE_RADIUS = 1.5
const BLAST_CATCH_RADIUS = 2.5
const BLAST_GAS_RADIUS = 3

function isQuiet(hazards: HazardState): boolean {
  return hazards.fires.size === 0 && hazards.burningProps.size === 0 && !hazards.smoke?.active.size && hazards.grenades.length === 0
    && hazards.sprays.length === 0 && hazards.flashes.length === 0 && hazards.blasts.length === 0 && hazards.leaks.length === 0
    && hazards.wet.size === 0 && hazards.roomFire.size === 0 && hazards.sprinkling.size === 0
}

export function stepHazards(world: World, dt: number): void {
  const hazards = world.hazards
  if (isQuiet(hazards)) {
    hazards.fireClock = 0
    hazards.smokeClock = 0
    return
  }
  stepGrenades(world, dt)
  stepLeaks(world, dt)
  stepBlasts(world, dt)
  stepSprays(world, dt)
  stepFlashes(world, dt)
  listenForShots(world)
  hazards.fireClock = runTicks(hazards.fireClock + dt, FIRE_TICK, () => fireTick(world))
  hazards.smokeClock = runTicks(hazards.smokeClock + dt, SMOKE_TICK, () => stepSmoke(world, SMOKE_TICK))
  hazards.harmClock = runTicks(hazards.harmClock + dt, HARM_TICK, () => harmPeople(world, HARM_TICK))
}

function runTicks(clock: number, tick: number, run: () => void): number {
  let left = clock
  for (let count = 0; left >= tick; count += 1) {
    if (count >= MAX_TICKS_PER_FRAME) return 0
    run()
    left -= tick
  }
  return left
}

function fireTick(world: World): void {
  stepBurningProps(world, FIRE_TICK)
  const burningRooms = stepFires(world, FIRE_TICK)
  soak(world, FIRE_TICK)
  runSprinklers(world, burningRooms, FIRE_TICK)
}

/** Starts or feeds a fire at a spot. `heat` is 0..1; 1 means an explosion, which also lights gas and breaks props nearby. */
export function igniteAt(world: World, at: Vec, heat: number): void {
  if (heat >= 1) {
    explosionFire(world, at)
    return
  }
  const x = Math.floor(at.x)
  const y = Math.floor(at.y)
  igniteGasNear(world, at, 1)
  const flare = FLARE_SECONDS * (0.5 + heat)
  if (!startFire(world, x, y, heat, flare)) startFire(world, x, y - 1, heat, flare)
  for (const id of propsAt(world, x, y)) if (world.rng() < heat * 2) igniteProp(world, id)
}

/** An explosion leaves a burst of flame, lights gas and catches burnable things close by. */
function explosionFire(world: World, at: Vec): void {
  igniteGasNear(world, at, BLAST_GAS_RADIUS)
  blastReachesProps(world, at)
  const reach = Math.ceil(BLAST_CATCH_RADIUS)
  for (let y = Math.floor(at.y) - reach; y <= Math.floor(at.y) + reach; y += 1) {
    for (let x = Math.floor(at.x) - reach; x <= Math.floor(at.x) + reach; x += 1) {
      const gap = Math.hypot(x + 0.5 - at.x, y + 0.5 - at.y)
      if (gap > BLAST_CATCH_RADIUS) continue
      const kind = tileAt(world.grid, x, y)
      if (tileBurns(kind) && world.rng() < 0.6) startFire(world, x, y, 0.6)
      else if (!TILE_DEFS[kind].solid && gap <= BLAST_FLARE_RADIUS) startFire(world, x, y, 0.8, 0.3 + world.rng() * 0.6)
    }
  }
  for (const prop of propsNear(world, at, BLAST_CATCH_RADIUS)) igniteProp(world, prop.id)
}
