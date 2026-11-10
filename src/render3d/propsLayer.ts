import { Group, Matrix4, Vector3 } from 'three'
import { propSpec, type PropSpec } from '../game/propCatalog'
import type { Prop } from '../game/site'
import { isSolidAt } from '../game/tiles'
import type { World } from '../game/world'
import { BACK } from './levelMesh'
import { DRAW_DISTANCE, type Frame, type LayerFactory } from './layer'
import { recipeOf } from './propbatch/recipe'
import { Region, type PlacedProp } from './propbatch/region'
import { buildProp } from './props'

/**
 * Furniture and clutter, about three thousand props on the big site. Each prop is still built as an ordinary model,
 * but drawn baked together with its neighbours (see `propbatch/region.ts`), so a view costs a few dozen draws rather
 * than thousands. Floor props vanish once the floor under them is gone; broken props are hidden.
 */

/** Size of a baking region in tiles: two storeys tall, and about half a screen wide. */
const REGION_W = 24
const REGION_H = 12
/** Regions this many tiles past the drawing distance are baked ahead of time, a few per frame. */
const BAKE_AHEAD = 8
const BAKES_PER_FRAME = 2
/** Half the size of the screen in tiles: regions overlapping it are baked at once, so nothing pops in on screen. */
const SCREEN_HALF_W = 23
const SCREEN_HALF_H = 13

/**
 * Only furniture at least a tile tall throws a shadow worth its cost; wall decor, ceiling fittings and small
 * clutter stay out of the shadow passes.
 */
function throwsShadow(spec: PropSpec): boolean {
  return spec.mount === 'floor' && spec.h >= 1
}

const MIRROR = new Vector3(-1, 1, 1)

function placement(prop: Prop, spec: PropSpec): Matrix4 {
  const z = spec.mount === 'floor' ? 0 : spec.mount === 'wall' ? BACK + 0.02 : -0.9
  const matrix = new Matrix4().makeTranslation(prop.x + 0.5, -prop.y, z)
  // Wall items carry lettering (posters, signs, screens), which must not be mirrored.
  if (prop.flip && spec.mount !== 'wall') matrix.scale(MIRROR)
  return matrix
}

type Area = { region: Region; x: number; y: number }

function overlaps(area: Area, frame: Frame, halfW: number, halfH: number): boolean {
  return Math.abs(area.x + REGION_W / 2 - frame.view.x) < halfW + REGION_W / 2 && Math.abs(area.y + REGION_H / 2 - frame.view.y) < halfH + REGION_H / 2
}

export const createPropsLayer: LayerFactory = (world, materials) => {
  const group = new Group()
  // Built in site order, so each kind's variants come out the same as always.
  const placed: PlacedProp[] = world.props.map((prop) => {
    const spec = propSpec(prop.kind)
    return { recipe: recipeOf(buildProp(prop.kind, materials)), world: placement(prop, spec), castShadow: throwsShadow(spec) }
  })
  const areas = regionsOf(world.props)
  for (const area of areas) group.add(area.region.group)
  const floorState = createFloorState(world)
  const isHidden = (index: number): boolean => world.props[index].broken === true || !floorState.standing(index)

  return {
    group,
    update(now, frame) {
      floorState.refresh(now)
      let bakes = BAKES_PER_FRAME
      for (const area of areas) {
        const { region } = area
        const near = overlaps(area, frame, DRAW_DISTANCE, DRAW_DISTANCE * 0.62)
        region.group.visible = near && region.built
        if (!region.built) {
          const onScreen = overlaps(area, frame, SCREEN_HALF_W, SCREEN_HALF_H)
          if (onScreen || (bakes > 0 && overlaps(area, frame, DRAW_DISTANCE + BAKE_AHEAD, DRAW_DISTANCE * 0.62 + BAKE_AHEAD))) {
            if (!onScreen) bakes -= 1
            region.build(placed, isHidden)
            region.group.visible = near
          }
          continue
        }
        if (near) syncHidden(region, isHidden, placed)
      }
    },
  }

  function syncHidden(region: Region, hidden: (index: number) => boolean, all: readonly PlacedProp[]): void {
    let shownAgain = false
    for (const index of region.props) {
      const want = hidden(index)
      if (want && !region.isHidden(index)) region.hide(index)
      else if (!want && region.isHidden(index)) shownAgain = true
    }
    // Folding is one-way; a prop that comes back (rare: only if its floor is rebuilt) needs a fresh bake.
    if (shownAgain) region.build(all, hidden)
  }
}

function regionsOf(props: readonly Prop[]): Area[] {
  const byKey = new Map<string, { x: number; y: number; props: number[] }>()
  props.forEach((prop, index) => {
    const x = Math.floor(prop.x / REGION_W) * REGION_W
    const y = Math.floor(prop.y / REGION_H) * REGION_H
    const key = `${x},${y}`
    const entry = byKey.get(key) ?? byKey.set(key, { x, y, props: [] }).get(key)!
    entry.props.push(index)
  })
  return [...byKey.values()].map(({ x, y, props: members }) => ({ region: new Region(members), x, y }))
}

/** Whether each floor prop still has floor under it, re-checked only when the tiles change. */
function createFloorState(world: World): { refresh(now: World): void; standing(index: number): boolean } {
  const onFloor = world.props.map((prop) => propSpec(prop.kind).mount === 'floor')
  const standing = new Uint8Array(world.props.length).fill(1)
  let version = -1
  return {
    refresh(now) {
      if (now.grid.version === version) return
      version = now.grid.version
      now.props.forEach((prop, index) => {
        standing[index] = !onFloor[index] || isSolidAt(now.grid, prop.x, prop.y) ? 1 : 0
      })
    },
    standing: (index) => standing[index] === 1,
  }
}
