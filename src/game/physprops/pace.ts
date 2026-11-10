import { boxHitsSolid } from '../physics'
import type { World } from '../world'

/** A jump in position bigger than this (stairs, an elevator, a reset) is not walking and is left alone. */
const TELEPORT = 2

/**
 * Holds the player to a walking pace while his hands are full (dragging furniture, holding a man as a shield).
 * The player code does not know about either, so this trims the step he just took, back along the path he
 * walked, which is known to be clear.
 */
export function capPlayerSpeed(world: World, maxSpeed: number, dt: number): void {
  const last = world.physProps.last
  const player = world.player
  if (!last) return
  const dx = player.x - last.x
  const limit = maxSpeed * dt
  if (Math.abs(dx) <= limit || Math.abs(dx) > TELEPORT) return
  const x = last.x + Math.sign(dx) * limit
  if (boxHitsSolid(world.grid, { ...player, x })) return
  player.x = x
  player.vx = Math.sign(dx) * Math.min(Math.abs(player.vx), maxSpeed)
}

/** Remembers where the player ended the frame, for pacing and for landing on furniture next frame. */
export function rememberPlayer(world: World): void {
  const player = world.player
  world.physProps.last = { x: player.x, y: player.y, feet: player.y + player.h }
}
