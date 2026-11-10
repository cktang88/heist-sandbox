import { damageProp } from '../cover'
import { hurtTile } from '../destruction'
import { burst } from '../effects'
import { hurtGuard, stunGuard } from '../guards'
import { propBox, propById, propCenter, propsNear } from '../hazards/props'
import { emitNoise } from '../noise'
import { propSpec } from '../propCatalog'
import { playSound } from '../sounds'
import { isSolidAt } from '../tiles'
import { centerOf, overlaps } from '../types'
import { isVehicle } from '../vehicles/vehicles'
import type { World } from '../world'
import type { RollingVehicle, SystemAction } from './state'

/**
 * Vehicles with the handbrake off. A shove sets one rolling; it slows on the flat, runs down whoever is in its way,
 * goes over the edge of a floor that has been blown away (the falling-prop code takes it from there), and stoves in
 * whatever it hits, wrecking itself if it hits hard enough, which can set off its tank.
 */
const REACH = 2.5
const SHOVE_SPEED = 4
const FRICTION = 0.5
const STOPPED = 0.3
const CRASH_DAMAGE_PER_SPEED = 40
const WALL_DAMAGE_PER_SPEED = 25
const RUN_DOWN_PER_SPEED = 12
const RUN_DOWN_STUN = 2
const HANDBRAKE_SECONDS = 1

/** "Hold E: release handbrake" beside a parked vehicle, in the shape the interact code uses. */
export function handbrakeAction(world: World): SystemAction | null {
  const hand = centerOf(world.player)
  const vehicle = propsNear(world, hand, REACH + 2).find((prop) => !prop.broken && isVehicle(prop) && !isRolling(world, prop.id)
    && Math.abs(propCenter(prop).x - hand.x) < propSpec(prop.kind).w / 2 + REACH && !world.physProps.loose.has(prop.id))
  if (!vehicle) return null
  const direction = propCenter(vehicle).x >= hand.x ? 1 : -1
  return { prompt: 'Hold E: release handbrake', key: `handbrake:${vehicle.id}`, hold: HANDBRAKE_SECONDS, run: () => releaseHandbrake(world, vehicle.id, direction) }
}

export function isRolling(world: World, id: number): boolean {
  return world.systems.rolling.some((item) => item.prop === id)
}

/** Sets a vehicle rolling one way. */
export function releaseHandbrake(world: World, id: number, direction: 1 | -1): void {
  const prop = propById(world, id)
  if (!prop || prop.broken || isRolling(world, id)) return
  world.systems.rolling.push({ prop: id, vx: direction * SHOVE_SPEED, keyedX: prop.x })
  playSound(world, 'switch', propCenter(prop))
}

export function stepRolling(world: World, dt: number): void {
  if (world.systems.rolling.length === 0) return
  world.systems.rolling = world.systems.rolling.filter((item) => roll(world, item, dt))
}

/** One frame of rolling. False once it has stopped, crashed or gone over an edge. */
function roll(world: World, item: RollingVehicle, dt: number): boolean {
  const prop = propById(world, item.prop)
  if (!prop || prop.broken) return false
  const speed = Math.abs(item.vx)
  const direction = Math.sign(item.vx)
  const box = propBox(prop)
  const front = direction > 0 ? box.x + box.w + item.vx * dt : box.x + item.vx * dt
  for (let y = box.y + 0.3; y < box.y + box.h; y += 0.6) {
    if (isSolidAt(world.grid, front, y)) {
      crash(world, item, front, y, speed)
      return false
    }
  }
  prop.x += item.vx * dt
  runDown(world, item, speed)
  item.vx -= direction * Math.min(speed, FRICTION * dt)
  if (!isSolidAt(world.grid, propCenter(prop).x, prop.y + 0.5)) {
    world.fallingProps.falling.push({ id: prop.id, vy: 0 })
    rekey(world, item, true)
    return false
  }
  const stopped = Math.abs(item.vx) < STOPPED
  rekey(world, item, stopped)
  return !stopped
}

/**
 * Cover and the fire code file props by position. Handing them a fresh prop list makes them file again; done each
 * tile moved and when it stops (the same way dragged furniture does it).
 */
function rekey(world: World, item: RollingVehicle, settled: boolean): void {
  const prop = propById(world, item.prop)
  if (!prop || (!settled && Math.abs(prop.x - item.keyedX) < 1)) return
  item.keyedX = prop.x
  world.props = world.props.slice()
}

function runDown(world: World, item: RollingVehicle, speed: number): void {
  const prop = propById(world, item.prop)!
  const box = propBox(prop)
  for (const guard of world.guards) {
    if (guard.mode === 'dead' || guard.stunSeconds > 0 || !overlaps(box, guard)) continue
    guard.vx = item.vx * 1.5
    guard.vy = -4
    stunGuard(guard, RUN_DOWN_STUN)
    hurtGuard(world, guard, speed * RUN_DOWN_PER_SPEED, propCenter(prop), 'hazard')
    playSound(world, 'impact', propCenter(prop))
  }
}

function crash(world: World, item: RollingVehicle, x: number, y: number, speed: number): void {
  const prop = propById(world, item.prop)!
  const at = { x, y }
  hurtTile(world, Math.floor(x), Math.floor(y), speed * WALL_DAMAGE_PER_SPEED)
  burst(world.effects, world.systems.rng, at, 10, '#9a948a', 6)
  playSound(world, speed > 2 ? 'collapse' : 'impact', at)
  emitNoise(world, at, 6 + speed * 3)
  rekey(world, item, true)
  damageProp(world, prop, speed * CRASH_DAMAGE_PER_SPEED)
}
