import { burst } from '../effects'
import { isBurningAt } from '../hazards/hazards'
import { emitNoise } from '../noise'
import { playSound } from '../sounds'
import { isSolidAt, setTile, tileAt } from '../tiles'
import type { Vec } from '../types'
import type { World } from '../world'

/**
 * A climbing rope tied off at an edge and hanging down the drop beside it. It is made of ladder tiles, so the player
 * climbs it, hangs at any height and shoots from it exactly as on a ladder; guards see and shoot him there because a
 * ladder hides nothing. `anchor` is the solid tile it is tied to; the rope fills rows `top..bottom` of column `x`.
 */
export type Rope = { x: number; top: number; bottom: number; anchor: Vec }

const MAX_ROWS = 48
/** A drop shorter than this needs no rope. */
const MIN_ROWS = 3
const ROPE_NOISE = 3
const FIBRE = '#b59a62'

/**
 * Ties a rope at the edge the player stands on, on the side he faces: a roof edge, a ledge, a broken window's sill or
 * the lip of a hole. Returns false, using nothing up, when there is no drop beside him to hang it in.
 */
export function anchorRope(world: World): boolean {
  const player = world.player
  if (!player.onGround || player.stairs || player.onLadder) return false
  const feetRow = Math.round(player.y + player.h)
  const column = Math.floor(player.x + player.w / 2)
  for (const reach of [1, 2]) {
    const x = column + player.facing * reach
    const anchor = { x: x - player.facing, y: feetRow }
    if (!isSolidAt(world.grid, anchor.x, anchor.y) || !opensBelow(world, x, feetRow)) continue
    const bottom = lowestOpenRow(world, x, feetRow - 1)
    if (bottom - feetRow < MIN_ROWS) return false
    for (let y = feetRow - 1; y <= bottom; y += 1) setTile(world.grid, x, y, 'ladder')
    world.ropes.push({ x, top: feetRow - 1, bottom, anchor })
    // He swings out over the edge onto the rope, ready to climb down.
    Object.assign(player, { x: x + 0.5 - player.w / 2, vx: 0, vy: 0, onLadder: true, onGround: false })
    world.structureChanged = true
    playSound(world, 'switch', { x: x + 0.5, y: feetRow - 0.5 })
    emitNoise(world, { x: x + 0.5, y: feetRow - 0.5 }, ROPE_NOISE)
    return true
  }
  return false
}

/** Room for a body beside the edge, and open air below it. */
function opensBelow(world: World, x: number, feetRow: number): boolean {
  return [-2, -1, 0, 1].every((dy) => tileAt(world.grid, x, feetRow + dy) === 'air')
}

function lowestOpenRow(world: World, x: number, top: number): number {
  let y = top
  while (y + 1 - top < MAX_ROWS && tileAt(world.grid, x, y + 1) === 'air') y += 1
  return y
}

/** Ropes burn through, come loose when their anchor is destroyed, and drop whatever hangs below a broken strand. */
export function stepRopes(world: World): void {
  if (world.ropes.length === 0) return
  for (const rope of world.ropes) {
    const knot = { x: rope.anchor.x + 0.5, y: rope.anchor.y - 0.5 }
    const loose = !isSolidAt(world.grid, rope.anchor.x, rope.anchor.y)
    if (loose || isBurningAt(world, knot) || isBurningAt(world, { x: rope.x + 0.5, y: rope.top + 0.5 })) {
      cutRope(world, rope)
      continue
    }
    const broken = firstBreak(world, rope)
    if (broken === null) continue
    if (broken === rope.top) cutRope(world, rope)
    else dropBelow(world, rope, broken)
  }
  world.ropes = world.ropes.filter((rope) => rope.bottom >= rope.top)
}

/** An explosion close to the knot cuts the rope. */
export function cutRopesNear(world: World, at: Vec, radius: number): void {
  for (const rope of world.ropes) {
    if (Math.hypot(rope.anchor.x + 0.5 - at.x, rope.anchor.y - 0.5 - at.y) <= radius) cutRope(world, rope)
  }
  world.ropes = world.ropes.filter((rope) => rope.bottom >= rope.top)
}

function firstBreak(world: World, rope: Rope): number | null {
  for (let y = rope.top; y <= rope.bottom; y += 1) if (tileAt(world.grid, rope.x, y) !== 'ladder') return y
  return null
}

/** The whole rope falls away; anyone on it falls with it. */
function cutRope(world: World, rope: Rope): void {
  dropBelow(world, rope, rope.top)
  burst(world.effects, world.rng, { x: rope.x + 0.5, y: rope.top + 0.5 }, 6, FIBRE, 4)
  playSound(world, 'impact', { x: rope.x + 0.5, y: rope.top + 0.5 })
}

/** Removes the rope from row `from` down; the rope now ends just above it. */
function dropBelow(world: World, rope: Rope, from: number): void {
  for (let y = from; y <= rope.bottom; y += 1) if (tileAt(world.grid, rope.x, y) === 'ladder') setTile(world.grid, rope.x, y, 'air')
  rope.bottom = from - 1
  world.structureChanged = true
}
