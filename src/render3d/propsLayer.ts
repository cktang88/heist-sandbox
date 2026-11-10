import { Group, Matrix4, Vector3 } from 'three'
import type { PropState } from '../game/cover'
import { propSpec, type PropSpec } from '../game/propCatalog'
import type { World } from '../game/world'
import { BACK } from './levelMesh'
import { DRAW_DISTANCE, inView, type Frame, type LayerFactory } from './layer'
import { placeLooseProp } from './meleeLayer'
import { modelFromRecipe } from './propbatch/looseModel'
import { recipeOf, signatureOf } from './propbatch/recipe'
import { Region, type PlacedProp } from './propbatch/region'
import { buildProp } from './props'

/**
 * Furniture and clutter, about three thousand props on the big site. Each prop is still built as an ordinary model,
 * then drawn batched with its neighbours (see `propbatch/region.ts`), so a view costs a few dozen draws rather than
 * thousands. Broken props are hidden. The few props that move (dragged, kicked over, thrown, falling through a
 * destroyed floor) leave their batch for a model of their own that follows them.
 */

/** Size of a batching region in tiles: about a screen wide and six storeys tall. */
const REGION_W = 48
const REGION_H = 36
/** Regions this many tiles past the drawing distance are built ahead of time, one per frame. */
const BUILD_AHEAD = 8
/** Half the size of the screen in tiles: regions overlapping it are built at once, so nothing pops in on screen. */
const SCREEN_HALF_W = 23
const SCREEN_HALF_H = 13
const MIRROR = new Vector3(-1, 1, 1)

/**
 * Only furniture at least a tile tall throws a shadow worth its cost; wall decor, ceiling fittings and small
 * clutter stay out of the shadow passes.
 */
function throwsShadow(spec: PropSpec): boolean {
  return spec.mount === 'floor' && spec.h >= 1
}

function depthOf(spec: PropSpec): number {
  return spec.mount === 'floor' ? 0 : spec.mount === 'wall' ? BACK + 0.02 : -0.9
}

/** Wall items carry lettering (posters, signs, screens), which must not be mirrored. */
function mirrored(prop: PropState, spec: PropSpec): boolean {
  return prop.flip === true && spec.mount !== 'wall'
}

function placement(prop: PropState, spec: PropSpec): Matrix4 {
  const matrix = new Matrix4().makeTranslation(prop.x + 0.5, -prop.y, depthOf(spec))
  return mirrored(prop, spec) ? matrix.scale(MIRROR) : matrix
}

type Area = { region: Region; x: number; y: number }

function overlaps(area: Area, frame: Frame, halfW: number, halfH: number): boolean {
  return Math.abs(area.x + REGION_W / 2 - frame.view.x) < halfW + REGION_W / 2 && Math.abs(area.y + REGION_H / 2 - frame.view.y) < halfH + REGION_H / 2
}

export const createPropsLayer: LayerFactory = (world, materials) => {
  const group = new Group()
  // The game may hand out a fresh `world.props` array later (same props, same order), so keep these references.
  const props = world.props.slice()
  const specs = props.map((prop) => propSpec(prop.kind))
  // Built in site order, so each kind's variants come out the same as always.
  const placed: PlacedProp[] = props.map((prop, index) => {
    const recipe = recipeOf(buildProp(prop.kind, materials))
    return { recipe, placement: placement(prop, specs[index]), castShadow: throwsShadow(specs[index]), shape: `${prop.kind}|${signatureOf(recipe)}` }
  })
  const home = props.map((prop) => ({ x: prop.x, y: prop.y }))
  const indexOf = new Map(props.map((prop, index) => [prop.id, index]))
  const areas = regionsOf(props)
  const regionOf: Region[] = []
  for (const area of areas) {
    group.add(area.region.group)
    for (const index of area.region.props) regionOf[index] = area.region
  }
  const loose = new Map<number, Group>()
  const isHidden = (index: number): boolean => props[index].broken || loose.has(index)

  function pullOut(index: number): void {
    if (loose.has(index)) return
    const model = modelFromRecipe(placed[index].recipe, placed[index].castShadow)
    loose.set(index, model)
    group.add(model)
    regionOf[index].setHidden(index, true)
  }

  function placeLoose(now: World, frame: Frame): void {
    for (const [index, model] of loose) {
      const prop = props[index]
      model.visible = !prop.broken && inView(frame, prop.x, prop.y, 6)
      if (!model.visible) continue
      model.position.set(prop.x + 0.5, -prop.y, depthOf(specs[index]))
      model.rotation.set(0, 0, 0)
      model.scale.x = mirrored(prop, specs[index]) ? -1 : 1
      placeLooseProp(now, prop, model)
    }
  }

  /** Hides what broke and pulls out what moved (props fall when their floor is blown away). */
  function syncRegion(region: Region): void {
    for (const index of region.props) {
      const prop = props[index]
      if (!loose.has(index) && (prop.x !== home[index].x || prop.y !== home[index].y)) pullOut(index)
      region.setHidden(index, isHidden(index))
    }
  }

  return {
    group,
    update(now, frame) {
      for (const id of now.physProps.loose.keys()) {
        const index = indexOf.get(id)
        if (index !== undefined) pullOut(index)
      }
      let spare = 1
      for (const area of areas) {
        const { region } = area
        if (!region.built) {
          const onScreen = overlaps(area, frame, SCREEN_HALF_W, SCREEN_HALF_H)
          const ahead = overlaps(area, frame, DRAW_DISTANCE + BUILD_AHEAD, DRAW_DISTANCE * 0.62 + BUILD_AHEAD)
          if (onScreen || (spare > 0 && ahead)) {
            if (!onScreen) spare -= 1
            region.build(placed, isHidden)
          }
        }
        region.group.visible = region.built && overlaps(area, frame, DRAW_DISTANCE, DRAW_DISTANCE * 0.62)
        if (region.group.visible) syncRegion(region)
      }
      placeLoose(now, frame)
    },
  }
}

function regionsOf(props: readonly PropState[]): Area[] {
  const byKey = new Map<string, { x: number; y: number; members: number[] }>()
  props.forEach((prop, index) => {
    const x = Math.floor(prop.x / REGION_W) * REGION_W
    const y = Math.floor(prop.y / REGION_H) * REGION_H
    const key = `${x},${y}`
    const entry = byKey.get(key) ?? byKey.set(key, { x, y, members: [] }).get(key)!
    entry.members.push(index)
  })
  return [...byKey.values()].map(({ x, y, members }) => ({ region: new Region(members), x, y }))
}
