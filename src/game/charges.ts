import { C4_BLAST, explode } from './explosions'
import { boxHitsSolid, GRAVITY, moveBody } from './physics'
import { isSolidAt, TILE_DEFS, type Grid } from './tiles'
import { centerOf, distance, type Body, type Vec } from './types'
import { castRay, normalize } from './vision'
import type { World } from './world'

/**
 * A C4 block. It sticks to the first solid thing it touches (wall, door, ceiling, floor, window) and stays there until
 * that tile is destroyed or opened, when it comes loose, falls, and sticks to whatever it meets next.
 * `stuck` is the tile it holds on to, `'backWall'` when it was pressed onto the back wall of a room, or null in flight.
 * `face` points away from the surface it is stuck to, for drawing; it is zero on the back wall (facing the camera).
 */
export type Charge = Body & { fuse: number | null; stuck: Vec | 'backWall' | null; face?: Vec }

const THROW_SPEED = 13
const STAGGER_SECONDS = 0.12
const SIZE = 0.4
/** Aimed this close, the charge is put where the cursor is instead of thrown. */
const PLACE_REACH = 2
/** An aim point this close in front of a surface counts as on it. */
const NEXT_TO = 0.6
const TOUCH = 0.05
const CLEARANCE = 0.001

const isSolid = (kind: keyof typeof TILE_DEFS) => TILE_DEFS[kind].solid

/** Places the charge when the aim point is within arm's reach on or beside a surface, else throws it. */
export function throwCharge(world: World, from: Vec, direction: Vec, target?: Vec): void {
  const placed = target && distance(from, target) <= PLACE_REACH ? placeCharge(world, from, target) : null
  if (placed) {
    world.charges.push(placed)
    return
  }
  world.charges.push({
    x: from.x - SIZE / 2, y: from.y - SIZE / 2, w: SIZE, h: SIZE, vx: direction.x * THROW_SPEED, vy: direction.y * THROW_SPEED - 2,
    onGround: false, fuse: null, stuck: null,
  })
}

function charge(center: Vec, stuck: Charge['stuck'], face: Vec): Charge {
  return { x: center.x - SIZE / 2, y: center.y - SIZE / 2, w: SIZE, h: SIZE, vx: 0, vy: 0, onGround: false, fuse: null, stuck, face }
}

/** A surface on the line to the aim point, or the back wall of the room the aim point is in; null if neither. */
function placeCharge(world: World, from: Vec, target: Vec): Charge | null {
  const length = distance(from, target)
  const direction = normalize(target.x - from.x, target.y - from.y)
  const hit = castRay(world.grid, from, direction, length + NEXT_TO, isSolid)
  if (hit) {
    // Back up to the last open point on the ray to learn which face of the tile it entered.
    const before = { x: from.x + direction.x * (hit.distance - 0.1), y: from.y + direction.y * (hit.distance - 0.1) }
    const side = Math.floor(before.x) !== hit.tileX
    const face = side ? { x: direction.x > 0 ? -1 : 1, y: 0 } : { x: 0, y: direction.y > 0 ? -1 : 1 }
    const center = side
      ? { x: face.x < 0 ? hit.tileX - SIZE / 2 - CLEARANCE : hit.tileX + 1 + SIZE / 2 + CLEARANCE, y: before.y }
      : { x: before.x, y: face.y < 0 ? hit.tileY - SIZE / 2 - CLEARANCE : hit.tileY + 1 + SIZE / 2 + CLEARANCE }
    const placed = charge(center, { x: hit.tileX, y: hit.tileY }, face)
    return boxHitsSolid(world.grid, placed) ? null : placed
  }
  const indoors = world.interiors.some((room) => room.kind === 'room' && target.x >= room.x && target.x < room.x + room.w && target.y >= room.y && target.y < room.y + room.h)
  if (!indoors) return null
  const placed = charge(target, 'backWall', { x: 0, y: 0 })
  return boxHitsSolid(world.grid, placed) ? null : placed
}

export function stepCharges(world: World, detonate: boolean, dt: number): void {
  if (detonate) {
    let order = 0
    for (const charge of world.charges) if (charge.fuse === null) charge.fuse = 0.05 + STAGGER_SECONDS * order++
  }

  const exploding: Charge[] = []
  for (const charge of world.charges) {
    // The tile it held on to was blown away or swung open.
    if (charge.stuck && charge.stuck !== 'backWall' && !isSolidAt(world.grid, charge.stuck.x, charge.stuck.y)) charge.stuck = null
    if (!charge.stuck) fly(world.grid, charge, dt)
    if (charge.fuse === null) continue
    charge.fuse -= dt
    if (charge.fuse <= 0) exploding.push(charge)
  }

  if (exploding.length === 0) return
  world.charges = world.charges.filter((charge) => !exploding.includes(charge))
  for (const charge of exploding) explode(world, centerOf(charge), C4_BLAST)
}

/** Flies under gravity and sticks dead to the first solid tile it touches. */
function fly(grid: Grid, charge: Charge, dt: number): void {
  charge.vy += GRAVITY * dt
  const heading = { x: charge.vx, y: charge.vy }
  moveBody(grid, charge, dt, 0)
  const touched = touching(grid, charge, heading)
  if (!touched) return
  charge.stuck = touched.tile
  charge.face = touched.face
  charge.vx = 0
  charge.vy = 0
}

/** A solid tile against the body's edges, checking the edges it was moving toward first. */
function touching(grid: Grid, body: Body, heading: Vec): { tile: Vec; face: Vec } | null {
  const ahead = { x: heading.x >= 0 ? 1 : -1, y: heading.y >= 0 ? 1 : -1 }
  for (const normal of [{ x: 0, y: ahead.y }, { x: ahead.x, y: 0 }, { x: -ahead.x, y: 0 }, { x: 0, y: -ahead.y }]) {
    for (const along of [0.5, 0.1, 0.9]) {
      const point = normal.x !== 0
        ? { x: normal.x > 0 ? body.x + body.w + TOUCH : body.x - TOUCH, y: body.y + body.h * along }
        : { x: body.x + body.w * along, y: normal.y > 0 ? body.y + body.h + TOUCH : body.y - TOUCH }
      if (isSolidAt(grid, point.x, point.y)) return { tile: { x: Math.floor(point.x), y: Math.floor(point.y) }, face: { x: -normal.x, y: -normal.y } }
    }
  }
  return null
}
