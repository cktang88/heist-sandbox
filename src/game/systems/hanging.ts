import { markLampShot } from '../ballistics/lampState'
import { burst } from '../effects'
import { stunGuard } from '../guards'
import { propById, propMoved } from '../hazards/props'
import { breakProp } from '../hazards/reactions'
import { emitNoise } from '../noise'
import { GRAVITY } from '../physics'
import { propSpec, type PropKind } from '../propCatalog'
import { playSound } from '../sounds'
import { isSolidAt } from '../tiles'
import { overlaps, type Rect } from '../types'
import { crush } from '../vehicles/fallingProps'
import type { World } from '../world'
import type { FallingFitting } from './state'
import { FITTINGS, targetIndex, type Target } from './targets'

/**
 * Hung fittings coming down: a ceiling fan, a sign, a wall unit or a chandelier whose mount is shot through, blasted, or
 * left hanging from a ceiling that is gone. It drops straight down (through holes too) and lands on whoever is
 * under it: hurt, and out for a moment. Guards lured under one are the point.
 */
const MASS: Partial<Record<PropKind, number>> = {
  ceilingFan: 40, projector: 20, speaker: 15, rangeHood: 50, punchingBag: 50, neonSign: 35, logoSign: 40, shelfWall: 30, wallAc: 45, billboard: 90,
}
const CHANDELIER_MASS = 80
const PENDANT_MASS = 20
const STUN_PER_MASS = 0.04
const LANDING_NOISE = 9
const DUST = '#9a948a'
const SHARDS = '#f3e6b4'
const HANG_REACH = 1.5

/** Starts a fitting falling. Each one comes down once. */
export function dropFitting(world: World, target: Target): boolean {
  const key: object | undefined = target.lamp ?? propById(world, target.prop)
  if (!key || world.systems.dropped.has(key)) return false
  world.systems.dropped.add(key)
  const prop = target.prop >= 0 ? propById(world, target.prop) : undefined
  const mass = prop ? MASS[prop.kind] ?? 30 : target.lamp?.fixture === 'chandelier' ? CHANDELIER_MASS : PENDANT_MASS
  if (target.lamp) markLampShot(world, target.lamp)
  const { box } = target
  world.systems.falling.push({ x: box.x, y: box.y, w: box.w, h: box.h, vy: 0, prop: target.prop, lamp: target.lamp, mass })
  playSound(world, 'impact', { x: box.x + box.w / 2, y: box.y })
  return true
}

/** Ceiling fittings left with nothing above them to hang from come down. */
export function loosenFittings(world: World, opened: readonly number[]): void {
  if (opened.length === 0) return
  const index = targetIndex(world)
  const width = world.grid.width
  for (const key of opened) {
    const x = key % width
    for (const target of index.byTile.get(key + width) ?? []) {
      if (hungFromCeiling(world, target) && !hangsFromSomething(world, target.box, x)) dropFitting(world, target)
    }
  }
}

function hungFromCeiling(world: World, target: Target): boolean {
  if (target.kind === 'lamp') return true
  const prop = target.kind === 'fitting' ? propById(world, target.prop) : undefined
  return !!prop && propSpec(prop.kind).mount === 'ceiling'
}

/** Fittings a blast broke (at a few ticks a second; there are only a few hundred). */
export function dropBrokenFittings(world: World): void {
  for (const target of targetIndex(world).all) {
    if (target.kind !== 'fitting') continue
    const prop = propById(world, target.prop)
    if (prop?.broken && FITTINGS.has(prop.kind) && !world.systems.dropped.has(prop)) dropFitting(world, target)
  }
}

function hangsFromSomething(world: World, box: Rect, x: number): boolean {
  for (let rise = 0.2; rise <= HANG_REACH; rise += 0.5) if (isSolidAt(world.grid, x + 0.5, box.y - rise)) return true
  return false
}

export function stepFallingFittings(world: World, dt: number): void {
  const falling = world.systems.falling
  if (falling.length === 0) return
  world.systems.falling = falling.filter((item) => !fall(world, item, dt))
}

/** Moves a fitting down one frame. True once it has landed. */
function fall(world: World, item: FallingFitting, dt: number): boolean {
  item.vy += GRAVITY * dt
  const next = item.y + item.vy * dt
  const middle = item.x + item.w / 2
  for (let row = Math.floor(item.y + item.h); row <= Math.floor(next + item.h); row += 1) {
    if (!isSolidAt(world.grid, middle, row + 0.5)) continue
    item.y = row - item.h
    land(world, item)
    return true
  }
  item.y = next
  follow(world, item)
  return item.y > world.grid.height
}

function follow(world: World, item: FallingFitting): void {
  const prop = item.prop >= 0 ? propById(world, item.prop) : undefined
  if (prop) prop.y = item.y
}

function land(world: World, item: FallingFitting): void {
  follow(world, item)
  const box: Rect = { x: item.x, y: item.y, w: item.w, h: item.h + 0.6 }
  const at = { x: item.x + item.w / 2, y: item.y + item.h }
  const damage = item.mass * Math.min(1.5, item.vy / 10)
  crush(world, box, damage)
  for (const guard of world.guards) if (guard.mode !== 'dead' && overlaps(box, guard)) stunGuard(guard, item.mass * STUN_PER_MASS)
  burst(world.effects, world.systems.rng, at, 10, item.lamp ? SHARDS : DUST, 6)
  playSound(world, item.lamp ? 'glass' : 'impact', at)
  emitNoise(world, at, LANDING_NOISE)
  const prop = item.prop >= 0 ? propById(world, item.prop) : undefined
  if (!prop) return
  propMoved(world, prop)
  breakProp(world, prop)
}
