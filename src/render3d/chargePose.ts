import type { Charge } from '../game/charges'
import { BACK } from './levelMesh'

/** Where a C4 block is drawn and its size, in 3D (y up), plus where its blinking light sits. */
export type ChargePose = { x: number; y: number; z: number; sx: number; sy: number; sz: number; light: { x: number; y: number; z: number } }

/** The block's long side, short side and thickness; it lies flat on whatever it is stuck to. */
const LONG = 0.4
const SHORT = 0.26
const THICK = 0.12
/** In flight it is drawn in the walking lane, a little in front of people. */
const LANE_Z = 0.1
/** Pressed on the back wall: just in front of the wallpaper. */
const ON_BACK_WALL = BACK + 0.02 + THICK / 2

/**
 * The game's charge is a 0.4-tile box whose `face` points away from the surface it holds (zero on the back wall). The
 * block is drawn lying flat against that surface, its light on the outer side, so a charge on a ceiling hangs from it,
 * one on a wall sits on the wall's face, and one on the back wall is on the wall behind the room, not in mid-air.
 */
export function chargePose(charge: Charge): ChargePose {
  const cx = charge.x + charge.w / 2
  const cy = charge.y + charge.h / 2
  if (charge.stuck === 'backWall') {
    return { x: cx, y: -cy, z: ON_BACK_WALL, sx: LONG, sy: SHORT, sz: THICK, light: { x: cx + LONG * 0.3, y: -cy + SHORT * 0.25, z: ON_BACK_WALL + THICK / 2 } }
  }
  const face = charge.stuck ? charge.face : undefined
  if (face && face.x !== 0) {
    // On a side wall or door: the block's back touches the wall, which is half the game box away from its centre.
    const x = cx - face.x * (charge.w / 2 - THICK / 2)
    return { x, y: -cy, z: LANE_Z, sx: THICK, sy: LONG, sz: SHORT, light: { x: x + face.x * THICK / 2, y: -cy + LONG * 0.3, z: LANE_Z } }
  }
  if (face && face.y !== 0) {
    // On a ceiling (face down) or a floor (face up).
    const y = cy - face.y * (charge.h / 2 - THICK / 2)
    return { x: cx, y: -y, z: LANE_Z, sx: LONG, sy: THICK, sz: SHORT, light: { x: cx + LONG * 0.3, y: -(y + face.y * THICK / 2), z: LANE_Z } }
  }
  return { x: cx, y: -cy, z: LANE_Z, sx: LONG, sy: SHORT, sz: SHORT, light: { x: cx, y: -cy + SHORT / 2, z: LANE_Z + 0.1 } }
}
