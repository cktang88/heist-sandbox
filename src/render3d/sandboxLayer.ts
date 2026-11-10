import { Group, Mesh } from 'three'
import { inView, type LayerFactory } from './layer'
import { BALL, CYLINDER, glow, matte } from './props/kit'

const MAX_FRAGS = 8
const MAX_ROPES = 6
/** Frags on a staircase sit in its lane at the back of the lobby, like the people on it. */
const STAIR_LANE = -1.5
const ROPE_Z = 0.25
const ROPE_RADIUS = 0.035
const FRAG_BODY = matte(0x3b4128, 0.6, 0.15)
const FRAG_SPOON = matte(0x8d8a7e, 0.4, 0.9)
const FUSE_ON = glow(0xff3a1a, 6)
const ROPE = matte(0xb59a62, 0.9)

/** A frag: an olive egg with a steel spoon along one side and a fuse spark that blinks faster as it runs down. */
function fragModel(): { root: Group; spark: Mesh } {
  const root = new Group()
  const body = new Mesh(BALL, FRAG_BODY)
  body.scale.set(0.12, 0.15, 0.12)
  body.castShadow = true
  const spoon = new Mesh(CYLINDER, FRAG_SPOON)
  spoon.scale.set(0.02, 0.22, 0.02)
  spoon.position.set(0.1, 0.04, 0)
  const spark = new Mesh(BALL, FUSE_ON)
  spark.scale.setScalar(0.03)
  spark.position.y = 0.17
  root.add(body, spoon, spark)
  root.visible = false
  return { root, spark }
}

function ropeModel(): { root: Group; line: Mesh; knot: Mesh } {
  const root = new Group()
  const line = new Mesh(CYLINDER, ROPE)
  const knot = new Mesh(BALL, ROPE)
  knot.scale.setScalar(0.09)
  root.add(line, knot)
  root.visible = false
  return { root, line, knot }
}

/**
 * The sandbox toys the tile and prop layers do not draw: frag grenades in flight or rattling down stairs, and the
 * climbing ropes hung down the outside of the building (their ladder tiles carry the climbing, this draws the rope).
 * Everything is pooled up front; nothing is created per frame.
 */
export const createSandboxLayer: LayerFactory = () => {
  const group = new Group()
  const frags = Array.from({ length: MAX_FRAGS }, fragModel)
  const ropes = Array.from({ length: MAX_ROPES }, ropeModel)
  for (const frag of frags) group.add(frag.root)
  for (const rope of ropes) group.add(rope.root)

  return {
    group,
    update(now, frame) {
      frags.forEach((slot, index) => {
        const frag = now.frags[index]
        slot.root.visible = !!frag && inView(frame, frag.x, frag.y, 2)
        if (!frag || !slot.root.visible) return
        slot.root.position.set(frag.x + frag.w / 2, -(frag.y + frag.h / 2), frag.stairs ? STAIR_LANE : 0.1)
        slot.root.rotation.z = -frag.x * 2
        slot.spark.visible = Math.sin(now.clock * (8 + 30 / Math.max(0.3, frag.fuse))) > 0
      })
      ropes.forEach(({ root, line, knot }, index) => {
        const rope = now.ropes[index]
        root.visible = !!rope && inView(frame, rope.x, (rope.top + rope.bottom) / 2, (rope.bottom - rope.top) / 2 + 2)
        if (!rope || !root.visible) return
        const length = rope.bottom + 1 - rope.top
        root.position.set(rope.x + 0.5, -rope.top, ROPE_Z)
        line.scale.set(ROPE_RADIUS, length, ROPE_RADIUS)
        line.position.y = -length / 2
        // The knot sits on the edge it is tied to, one row below the top of the rope.
        knot.position.set(rope.anchor.x - rope.x, -1, 0)
      })
    },
  }
}
