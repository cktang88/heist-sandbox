import { Group, Matrix4, Vector3 } from 'three'
import type { PropState } from '../game/cover'
import { propSpec, type PropSpec } from '../game/propCatalog'
import type { World } from '../game/world'
import { loadShared } from './assets'
import { addBuildJob } from './core/buildQueue'
import { LITE_MODELS } from './liteModels'
import { BACK } from './levelMesh'
import { DRAW_DISTANCE, inView, type Frame, type LayerFactory } from './layer'
import { placeLooseProp } from './meleeLayer'
import { modelFromRecipe } from './propbatch/looseModel'
import { recipeOf, signatureOf } from './propbatch/recipe'
import { cardViewVersion } from './propbatch/cardAtlas'
import { Region, type PlacedProp } from './propbatch/region'
import { showcaseJob } from './propbatch/showcase'
import { buildProp } from './props'
import { pickFor } from './props/officeParts'

/**
 * Furniture and clutter, about three thousand props on the big site. Each prop is still built as an ordinary model,
 * then drawn batched with its neighbours (see `propbatch/region.ts`), so a view costs a few dozen draws rather than
 * thousands. Regions are built in small steps by the build queue (`core/buildQueue.ts`), nearest the view first, so
 * reaching a new part of the site never stalls a frame. Broken props are hidden. The few props that move (dragged, kicked over, thrown, falling through a
 * destroyed floor) leave their batch for a model of their own that follows them.
 */

/** Size of a batching region in tiles: about a screen wide and six storeys tall. */
const REGION_W = 48
const REGION_H = 36
const MIRROR = new Vector3(-1, 1, 1)

/**
 * Only tall furniture (cabinets, shelves, machines: about a person's height or more) throws a shadow worth its cost;
 * desks, chairs, wall decor, ceiling fittings and clutter stay out of the shadow passes.
 */
const SHADOW_MIN_HEIGHT = 1.4

function throwsShadow(spec: PropSpec): boolean {
  return spec.mount === 'floor' && spec.h >= SHADOW_MIN_HEIGHT
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
  // Each prop's model is built the first time its region asks for it; its variants depend only on its id.
  const placed: (PlacedProp | undefined)[] = []
  const placedOf = (index: number): PlacedProp => placed[index] ?? (placed[index] = placeProp(index))
  function placeProp(index: number): PlacedProp {
    pickFor(props[index].id)
    const recipe = recipeOf(buildProp(props[index].kind, materials))
    return { recipe, placement: placement(props[index], specs[index]), castShadow: throwsShadow(specs[index]), shape: `${props[index].kind}|${signatureOf(recipe)}` }
  }
  // Every library model a prop may use starts loading now, so it is here by the time its region is built.
  for (const url of LITE_MODELS.keys()) void loadShared(url).catch(() => undefined)
  const home = props.map((prop) => ({ x: prop.x, y: prop.y }))
  const indexOf = new Map(props.map((prop, index) => [prop.id, index]))
  const areas = regionsOf(props)
  const regionOf: Region[] = []
  const loose = new Map<number, Group>()
  const isHidden = (index: number): boolean => props[index].broken || loose.has(index)
  addBuildJob(showcaseJob(props, placedOf, { x: world.player.x, y: world.player.y }))
  for (const area of areas) {
    group.add(area.region.group)
    for (const index of area.region.props) regionOf[index] = area.region
  }
  /** Starts (or restarts) building every region through the build queue. */
  function queueRegions(): void {
    for (const area of areas) {
      const { region } = area
      region.start(isHidden)
      const generation = region.generationNow
      addBuildJob({
        x: area.x + REGION_W / 2, y: area.y + REGION_H / 2, halfW: REGION_W / 2, halfH: REGION_H / 2,
        get cause() {
          return `props ${area.x},${area.y} ${region.phase}`
        },
        // A job from an earlier build of this region (before a change of look) simply stops.
        step: () => (region.generationNow === generation ? region.step(placedOf) : 'done'),
      })
    }
  }
  queueRegions()
  // Cards are baked for one way of seeing; a look that sees the other way needs every region rebuilt.
  let cardsFor = cardViewVersion()

  function pullOut(index: number): void {
    if (loose.has(index)) return
    const entry = placedOf(index)
    const model = modelFromRecipe(entry.recipe, entry.castShadow)
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
      if (cardsFor !== cardViewVersion()) {
        cardsFor = cardViewVersion()
        queueRegions()
      }
      for (const id of now.physProps.loose.keys()) {
        const index = indexOf.get(id)
        if (index !== undefined) pullOut(index)
      }
      // Regions are built by the build queue (nearest first, a few milliseconds a frame); here they are only shown.
      for (const area of areas) {
        const { region } = area
        region.group.visible = region.ready && overlaps(area, frame, DRAW_DISTANCE, DRAW_DISTANCE * 0.62)
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
  return [...byKey.values()].map(({ x, y, members }) => {
    const area = { x: x + REGION_W / 2, y: y + REGION_H / 2, halfW: REGION_W / 2, halfH: REGION_H / 2, cause: `prepare props ${x},${y}` }
    return { region: new Region(members, area), x, y }
  })
}
