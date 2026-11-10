import { GRAVITY } from './physics'
import type { Rng } from './rng'
import { isSolidAt, type Grid } from './tiles'
import type { Vec } from './types'

/** A limp body made of joints held together by fixed-length bones. */
export type RagdollPoint = Vec & { vx: number; vy: number }
/**
 * `still` counts seconds the body has lain motionless; once it has been still long enough it sleeps (`sleep` is
 * set) and costs almost nothing until something disturbs it.
 */
export type Ragdoll = { points: RagdollPoint[]; still?: number; sleep?: Sleep | null }

/** What a sleeping body remembers, to notice when it must wake: where its joints were and the tiles around them. */
type Sleep = { at: Float64Array; support: number; version: number }

/** Joint order. Rendering and bones refer to joints by these positions. */
export const JOINT = { head: 0, neck: 1, hip: 2, elbowA: 3, handA: 4, elbowB: 5, handB: 6, kneeA: 7, footA: 8, kneeB: 9, footB: 10 } as const

/** Standing pose, as offsets from the feet (x across, y up is negative). */
const REST: Vec[] = [
  { x: 0, y: -1.5 }, { x: 0, y: -1.26 }, { x: 0, y: -0.78 },
  { x: 0.1, y: -1.0 }, { x: 0.16, y: -0.75 }, { x: -0.1, y: -1.0 }, { x: -0.16, y: -0.75 },
  { x: 0.06, y: -0.4 }, { x: 0.08, y: 0 }, { x: -0.06, y: -0.4 }, { x: -0.08, y: 0 },
]

export const BONES: ReadonlyArray<readonly [number, number]> = [
  [JOINT.head, JOINT.neck], [JOINT.neck, JOINT.hip],
  [JOINT.neck, JOINT.elbowA], [JOINT.elbowA, JOINT.handA], [JOINT.neck, JOINT.elbowB], [JOINT.elbowB, JOINT.handB],
  [JOINT.hip, JOINT.kneeA], [JOINT.kneeA, JOINT.footA], [JOINT.hip, JOINT.kneeB], [JOINT.kneeB, JOINT.footB],
]
const JOINT_COUNT = REST.length
const BONE_LENGTHS = BONES.map(([a, b]) => Math.hypot(REST[a].x - REST[b].x, REST[a].y - REST[b].y))

const SOLVER_PASSES = 4
const AIR_DRAG = 0.995
const GROUND_GRIP = 0.6
const MAX_SPEED = 40

/** Starts a ragdoll standing at the feet position, already moving with the body's speed plus a little tumble. */
export function createRagdoll(feet: Vec, velocity: Vec, rng: Rng): Ragdoll {
  return {
    points: REST.map((offset) => ({
      x: feet.x + offset.x, y: feet.y + offset.y - 0.05,
      vx: velocity.x + (rng() - 0.5) * 4 - offset.y * velocity.x * 0.25,
      vy: velocity.y + (rng() - 0.5) * 3,
    })),
  }
}

export function pushRagdoll(ragdoll: Ragdoll, from: Vec, radius: number, speed: number): void {
  for (const point of ragdoll.points) {
    const dx = point.x - from.x
    const dy = point.y - from.y
    // Most bodies are far from any one blast: rule them out before the square root.
    if (dx * dx + dy * dy > radius * radius) continue
    const gap = Math.hypot(dx, dy)
    if (gap > radius) continue
    wake(ragdoll)
    const force = speed * (1 - gap / radius)
    point.vx += ((point.x - from.x) / Math.max(0.2, gap)) * force
    point.vy += ((point.y - from.y) / Math.max(0.2, gap)) * force - force * 0.3
  }
}

/** A joint moves at most this far per sub-step, so a fast body cannot jump clean over a one-tile wall or slab. */
const MAX_MOVE = 0.4
const POP_GAP = 0.01

/** A body whose every joint moves slower than this (tiles per second) for `SLEEP_AFTER` seconds goes to sleep. */
const SLEEP_SPEED = 0.002
const SLEEP_AFTER = 0.5

/**
 * Moves the joints, then pulls the bones back to length and keeps joints out of walls. A body at rest sleeps
 * until a push, a move from outside, or a change to the tiles it lies in or on wakes it.
 */
export function stepRagdoll(grid: Grid, ragdoll: Ragdoll, dt: number): void {
  if (dt <= 0) return
  if (ragdoll.sleep && !mustWake(grid, ragdoll, ragdoll.sleep)) return
  ragdoll.sleep = null
  let fastest = 0
  for (const point of ragdoll.points) fastest = Math.max(fastest, speedOf(point))
  const steps = Math.max(1, Math.ceil((Math.min(fastest, MAX_SPEED) * dt) / MAX_MOVE))
  for (let step = 0; step < steps; step += 1) subStep(grid, ragdoll, dt / steps)
  restIfStill(grid, ragdoll, dt)
}

/** Wakes a sleeping body so it moves again on its next step. */
export function wake(ragdoll: Ragdoll): void {
  ragdoll.sleep = null
  ragdoll.still = 0
}

export function isAsleep(ragdoll: Ragdoll): boolean {
  return !!ragdoll.sleep
}

function speedOf(point: RagdollPoint): number {
  return Math.sqrt(point.vx * point.vx + point.vy * point.vy)
}

function restIfStill(grid: Grid, ragdoll: Ragdoll, dt: number): void {
  let fastest = 0
  for (const point of ragdoll.points) fastest = Math.max(fastest, speedOf(point))
  ragdoll.still = fastest < SLEEP_SPEED ? (ragdoll.still ?? 0) + dt : 0
  if (ragdoll.still < SLEEP_AFTER) return
  const at = new Float64Array(ragdoll.points.length * 2)
  ragdoll.points.forEach((point, index) => {
    point.vx = 0
    point.vy = 0
    at[index * 2] = point.x
    at[index * 2 + 1] = point.y
  })
  ragdoll.sleep = { at, support: supportOf(grid, ragdoll), version: grid.version }
}

/** True if something moved or pushed the body, or the tiles it lies in or on changed, since it fell asleep. */
function mustWake(grid: Grid, ragdoll: Ragdoll, sleep: Sleep): boolean {
  const points = ragdoll.points
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index]
    if (point.vx !== 0 || point.vy !== 0 || point.x !== sleep.at[index * 2] || point.y !== sleep.at[index * 2 + 1]) return true
  }
  if (grid.version === sleep.version) return false
  sleep.version = grid.version
  return supportOf(grid, ragdoll) !== sleep.support
}

/** One bit per joint for whether its own tile is solid, and one for the tile just under it: what holds it up. */
function supportOf(grid: Grid, ragdoll: Ragdoll): number {
  let bits = 0
  for (const point of ragdoll.points) {
    bits = bits * 4 + (isSolidAt(grid, point.x, point.y) ? 2 : 0) + (isSolidAt(grid, point.x, point.y + 0.5) ? 1 : 0)
  }
  return bits
}

/** Joint positions at the start of a sub-step, kept between calls so stepping a body allocates nothing. */
const beforeX = new Float64Array(JOINT_COUNT)
const beforeY = new Float64Array(JOINT_COUNT)

function subStep(grid: Grid, ragdoll: Ragdoll, dt: number): void {
  const points = ragdoll.points
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index]
    popOut(grid, point)
    beforeX[index] = point.x
    beforeY[index] = point.y
  }
  for (const point of points) {
    point.vy += GRAVITY * dt
    const speed = speedOf(point)
    if (speed > MAX_SPEED) {
      point.vx *= MAX_SPEED / speed
      point.vy *= MAX_SPEED / speed
    }
    point.x += point.vx * dt
    point.y += point.vy * dt
  }

  for (let pass = 0; pass < SOLVER_PASSES; pass += 1) {
    for (let bone = 0; bone < BONES.length; bone += 1) {
      const first = points[BONES[bone][0]]
      const second = points[BONES[bone][1]]
      const dx = second.x - first.x
      const dy = second.y - first.y
      const length = Math.sqrt(dx * dx + dy * dy) || 0.0001
      const fix = ((length - BONE_LENGTHS[bone]) / length) * 0.5
      first.x += dx * fix
      first.y += dy * fix
      second.x -= dx * fix
      second.y -= dy * fix
    }
    for (let index = 0; index < points.length; index += 1) keepOutOfWalls(grid, points[index], beforeX[index], beforeY[index])
  }

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index]
    point.vx = ((point.x - beforeX[index]) / dt) * AIR_DRAG
    point.vy = ((point.y - beforeY[index]) / dt) * AIR_DRAG
  }
}

/**
 * A joint that starts inside a solid tile (the body was killed on a stair flight that crosses a slab, or a wall
 * was rebuilt around it) would be held there for ever by the wall check. It steps out through the nearer of the
 * tile's top and bottom faces that is open.
 */
function popOut(grid: Grid, point: RagdollPoint): void {
  if (!isSolidAt(grid, point.x, point.y)) return
  const row = Math.floor(point.y)
  const upFirst = point.y - row < 0.5
  const up = !isSolidAt(grid, point.x, row - 1)
  const down = !isSolidAt(grid, point.x, row + 1)
  if (up && (upFirst || !down)) point.y = row - POP_GAP
  else if (down) point.y = row + 1 + POP_GAP
  else return
  point.vy = 0
}

function keepOutOfWalls(grid: Grid, point: Vec, beforeX: number, beforeY: number): void {
  if (!isSolidAt(grid, point.x, point.y)) return
  if (!isSolidAt(grid, point.x, beforeY)) {
    // Landed on a floor or hit a ceiling: stop the vertical move and scrub off sideways speed.
    point.y = beforeY
    point.x = beforeX + (point.x - beforeX) * GROUND_GRIP
  } else if (!isSolidAt(grid, beforeX, point.y)) {
    point.x = beforeX
  } else {
    point.x = beforeX
    point.y = beforeY
  }
}
