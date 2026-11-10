import { burst } from './effects'
import { DRONE_BLAST, explode } from './explosions'
import type { Input } from './input'
import { boxHitsSolid, moveBody } from './physics'
import { toolIndex } from './toolDefs'
import { centerOf, type Body } from './types'
import type { World } from './world'

/** A small remote flyer. While it is out, the player's controls steer it instead. */
export type Drone = Body & { battery: number }

const FLY_SPEED = 9
const BATTERY_SECONDS = 18
export const DRONE_PROMPT = 'Click: detonate drone, E: bring it back'

const SIZE = { w: 0.6, h: 0.4 }
/** It lifts off from above the head, or lower down beside the body where a low ceiling leaves no room up there. */
const LIFT_OFF = 0.6
const LIFT_OFF_STEP = 0.1

export function launchDrone(world: World): void {
  const player = world.player
  const lowest = player.y + player.h - SIZE.h
  let y = player.y - LIFT_OFF
  while (y < lowest && boxHitsSolid(world.grid, { x: player.x, y, ...SIZE })) y += LIFT_OFF_STEP
  world.drone = { x: player.x, y: Math.min(y, lowest), ...SIZE, vx: 0, vy: 0, onGround: false, battery: BATTERY_SECONDS }
}

export function stepDrone(world: World, input: Input, dt: number): void {
  const drone = world.drone
  if (!drone) return
  const moveX = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  const moveY = (input.down ? 1 : 0) - (input.up ? 1 : 0)
  drone.vx += (moveX * FLY_SPEED - drone.vx) * Math.min(1, dt * 8)
  drone.vy += (moveY * FLY_SPEED - drone.vy) * Math.min(1, dt * 8)
  moveBody(world.grid, drone, dt)
  drone.battery -= dt
  // The hands are on the remote: nothing else is in reach, and E and the trigger work the drone.
  world.player.pick = 0
  world.prompt = DRONE_PROMPT
  world.stealth.hint = null

  if (input.firePressed) {
    world.drone = null
    explode(world, centerOf(drone), DRONE_BLAST)
  } else if (input.interactPressed) {
    world.drone = null
    world.player.ammo[toolIndex('drone')] += 1
  } else if (drone.battery <= 0) {
    world.drone = null
    burst(world.effects, world.rng, centerOf(drone), 8, '#8a8f98', 4)
  }
  if (!world.drone) world.prompt = null
}
