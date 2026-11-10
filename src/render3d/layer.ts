import type { Group } from 'three'
import type { Vec } from '../game/types'
import type { World } from '../game/world'
import type { SurfaceMaterials } from './levelMesh'

/** What every layer is told each frame. `dt` is game time (it shrinks in slow motion). */
export type Frame = { dt: number; view: Vec; aim: Vec }

/** One slice of the 3D scene: it owns a group of objects and keeps them in step with the game. */
export type Layer = { group: Group; update(world: World, frame: Frame): void }

export type LayerFactory = (world: World, materials: SurfaceMaterials) => Layer

/** How far from the centre of the view things are still worth drawing, in tiles. */
export const DRAW_DISTANCE = 46

export function inView(frame: Frame, x: number, y: number, margin = 0): boolean {
  return Math.abs(x - frame.view.x) < DRAW_DISTANCE + margin && Math.abs(y - frame.view.y) < DRAW_DISTANCE * 0.62 + margin
}
