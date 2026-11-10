import { Group, Mesh } from 'three'
import { gripOf } from '../game/grapple/line'
import { isSolidAt, type Grid } from '../game/tiles'
import type { Vec } from '../game/types'
import { inView, type LayerFactory } from './layer'
import { BOX, CYLINDER, matte } from './props/kit'

const LINE_Z = 0.15
const LINE_RADIUS = 0.022
const LINE = matte(0x1d2024, 0.65)
const STEEL = matte(0x7a8088, 0.35, 0.9)
/** A parked line hangs straight down from the hook until it meets something or runs out. */
const MAX_HANG = 40

function segmentMesh(): Mesh {
  const mesh = new Mesh(CYLINDER, LINE)
  mesh.visible = false
  return mesh
}

/** The hook: a short shank with two claws, built once. */
function hookModel(): Group {
  const root = new Group()
  const shank = new Mesh(BOX, STEEL)
  shank.scale.set(0.26, 0.06, 0.06)
  const upper = new Mesh(BOX, STEEL)
  upper.scale.set(0.05, 0.16, 0.05)
  upper.position.set(0.12, 0.06, 0)
  upper.rotation.z = -0.5
  const lower = upper.clone()
  lower.position.y = -0.06
  lower.rotation.z = 0.5
  for (const part of [shank, upper, lower]) part.castShadow = true
  root.add(shank, upper, lower)
  root.visible = false
  return root
}

/** Stretches a unit cylinder between two game-space points. */
function stretch(mesh: Mesh, a: Vec, b: Vec): void {
  const dx = b.x - a.x
  const dy = -(b.y - a.y)
  const length = Math.hypot(dx, dy)
  mesh.visible = length > 0.01
  if (!mesh.visible) return
  mesh.position.set((a.x + b.x) / 2, -(a.y + b.y) / 2, LINE_Z)
  mesh.scale.set(LINE_RADIUS, length, LINE_RADIUS)
  mesh.rotation.z = Math.atan2(dy, dx) - Math.PI / 2
}

/**
 * The grappling hook: the hook in flight, on its way back and bitten into a wall, and its line, taut to the player's
 * hands (bent round a corner when it is wrapped on one) or hanging slack from a parked hook. Two pooled line segments
 * and one hook model, all sharing two materials; nothing is created per frame.
 */
export const createGrappleLayer: LayerFactory = () => {
  const group = new Group()
  const near = segmentMesh()
  const far = segmentMesh()
  const hook = hookModel()
  group.add(near, far, hook)

  return {
    group,
    update(world, frame) {
      const grapple = world.grapple
      const shown = grapple.phase !== 'stowed' && inView(frame, grapple.hook.x, grapple.hook.y, 4)
      hook.visible = shown
      near.visible = false
      far.visible = false
      if (!shown) return
      const hand = gripOf(world.player)
      hook.position.set(grapple.hook.x, -grapple.hook.y, LINE_Z)
      // The claws point the way it flew, which is also into the face it bit.
      hook.rotation.z = Math.atan2(-grapple.heading.y, grapple.heading.x)
      if (grapple.phase === 'parked') {
        stretch(near, grapple.hook, { x: grapple.hook.x, y: hangEnd(world.grid, grapple.hook, grapple.length) })
        return
      }
      if (grapple.bend) {
        stretch(far, grapple.hook, grapple.bend)
        stretch(near, grapple.bend, hand)
      } else stretch(near, grapple.hook, hand)
    },
  }
}

function hangEnd(grid: Grid, from: Vec, length: number): number {
  const end = from.y + Math.min(length, MAX_HANG)
  for (let row = Math.floor(from.y) + 1; row < end; row += 1) if (isSolidAt(grid, from.x, row)) return row
  return end
}
