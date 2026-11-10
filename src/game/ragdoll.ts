import { GRAVITY } from './physics'
import type { Rng } from './rng'
import { isSolidAt, type Grid } from './tiles'
import type { Vec } from './types'

/** A limp body made of joints held together by fixed-length bones. */
export type RagdollPoint = Vec & { vx: number; vy: number }
export type Ragdoll = { points: RagdollPoint[] }

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
    const gap = Math.hypot(point.x - from.x, point.y - from.y)
    if (gap > radius) continue
    const force = speed * (1 - gap / radius)
    point.vx += ((point.x - from.x) / Math.max(0.2, gap)) * force
    point.vy += ((point.y - from.y) / Math.max(0.2, gap)) * force - force * 0.3
  }
}

/** Moves the joints, then pulls the bones back to length and keeps joints out of walls. */
export function stepRagdoll(grid: Grid, ragdoll: Ragdoll, dt: number): void {
  if (dt <= 0) return
  const before = ragdoll.points.map((point) => ({ x: point.x, y: point.y }))
  for (const point of ragdoll.points) {
    point.vy += GRAVITY * dt
    const speed = Math.hypot(point.vx, point.vy)
    if (speed > MAX_SPEED) {
      point.vx *= MAX_SPEED / speed
      point.vy *= MAX_SPEED / speed
    }
    point.x += point.vx * dt
    point.y += point.vy * dt
  }

  for (let pass = 0; pass < SOLVER_PASSES; pass += 1) {
    BONES.forEach(([a, b], index) => {
      const first = ragdoll.points[a]
      const second = ragdoll.points[b]
      const dx = second.x - first.x
      const dy = second.y - first.y
      const length = Math.hypot(dx, dy) || 0.0001
      const fix = ((length - BONE_LENGTHS[index]) / length) * 0.5
      first.x += dx * fix
      first.y += dy * fix
      second.x -= dx * fix
      second.y -= dy * fix
    })
    ragdoll.points.forEach((point, index) => keepOutOfWalls(grid, point, before[index]))
  }

  ragdoll.points.forEach((point, index) => {
    point.vx = ((point.x - before[index].x) / dt) * AIR_DRAG
    point.vy = ((point.y - before[index].y) / dt) * AIR_DRAG
  })
}

function keepOutOfWalls(grid: Grid, point: Vec, before: Vec): void {
  if (!isSolidAt(grid, point.x, point.y)) return
  if (!isSolidAt(grid, point.x, before.y)) {
    // Landed on a floor or hit a ceiling: stop the vertical move and scrub off sideways speed.
    point.y = before.y
    point.x = before.x + (point.x - before.x) * GROUND_GRIP
  } else if (!isSolidAt(grid, before.x, point.y)) {
    point.x = before.x
  } else {
    point.x = before.x
    point.y = before.y
  }
}
