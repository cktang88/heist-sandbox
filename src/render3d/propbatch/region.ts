import { Box3, Group, Matrix4, type BufferGeometry, type Material, type Object3D, type WebGLRenderer } from 'three'
import { loadShared } from '../assets'
import type { StepResult } from '../core/buildQueue'
import { currentRenderer, prepareJob, type JobArea } from '../core/gpu'
import { BatchPlan, MIRROR, showInstances, type BatchedProps } from './batchPlan'
import { bakeCard, canBake, cardView, piecesBounds, type CardPiece, type CardView } from './cardAtlas'
import { buildCards, type CardSet, type CardUse } from './cardBatch'
import { mergePieces, type BatchLook } from './merge'
import { mirrorGeometry } from './mirror'
import { isPlain, plainMaterial } from './plainMaterial'
import type { Part, Recipe } from './recipe'
import { scanPieces } from './scanBatch'

/**
 * The props of one large patch of the site. Most become flat pre-rendered cards (see `cardAtlas.ts`), drawn as one
 * instanced set per region; the rest stay 3D, drawn as one batch per material (all plain colours share one), split by
 * whether they throw shadows. Three skips a region whose bounds are outside the view or a shadow camera, and the props
 * layer hides regions away from the view, so drawing cost follows what is near the view, not the size of the site.
 */

/**
 * A prop ready to batch: what it is made of, where it stood when the site was built, whether it may throw a shadow
 * at all, and a key shared by every prop built exactly alike (so their shapes are stored once).
 */
export type PlacedProp = { recipe: Recipe; placement: Matrix4; castShadow: boolean; shape: string }

const IDENTITY = new Matrix4()
/** Prop shapes by key, shared by every region: the same desk is baked once for the whole site. */
const shapes = new Map<string, BufferGeometry>()
const mirroredScans = new WeakMap<BufferGeometry, BufferGeometry>()

/**
 * Which props stay 3D. In the pixel looks a card is exact, so only a big, deep prop whose front reaches the walking
 * lane stays a model (a person passes right in front of it, where a card's single shading plane would show). With
 * perspective a card is right only at the screen centre and shows the wrong side toward the edges, so only small,
 * shallow props become cards there (clutter, wall decor, small machines).
 */
const LANE_REACH_Z = -0.35
const DEEP_NEAR_LANE = 1.0
const WIDEST_CARD = 6
const SMALL = { w: 1.3, h: 1.6, depth: 0.9 }

export function suitsCard(bounds: Box3, placementZ: number, look: CardView): boolean {
  const w = bounds.max.x - bounds.min.x
  const h = bounds.max.y - bounds.min.y
  const depth = bounds.max.z - bounds.min.z
  if (look === 'straight') return w <= SMALL.w && h <= SMALL.h && depth <= SMALL.depth
  return w <= WIDEST_CARD && !(placementZ + bounds.max.z > LANE_REACH_Z && depth > DEEP_NEAR_LANE)
}

const modelKinds = new Set<string>()

/** Prop kinds that stayed 3D somewhere (for the debug readout): unbakeable, or too big or deep for a card. */
export function propKindsKept3d(): string[] {
  return [...modelKinds].sort()
}

function isMirror(matrix: Matrix4): boolean {
  return matrix.determinant() < 0
}

/**
 * Where a region's build has got to: props still to look at, scanned models still to come, props still to sort,
 * cards still to bake, batches still to make.
 */
type Work = {
  gather: number[]
  scans: Set<string>
  scenes: Map<string, Group>
  sort: number[]
  bake: number[]
  sorted: Map<string, BatchPlan>
  plans: BatchPlan[] | null
  cards: CardUse[]
}

export class Region {
  readonly group = new Group()
  private batches: BatchedProps[] = []
  private cards: CardSet | null = null
  private hidden = new Set<number>()
  /** Goes up on every build, so a scanned model arriving late does not land in a build that has been replaced. */
  private generation = 0
  private work: Work | null = null
  /** True once every prop is in a batch or a card set. */
  built = false
  /** Batches made but still being uploaded and compiled. */
  private preparing = 0
  /** What the last step did, for the frame probe. */
  phase: 'prop' | 'scan' | 'sort' | 'card' | 'batch' | 'idle' = 'idle'

  /**
   * `area` places the region for the build queue: each batch is uploaded and compiled there, nearest the view first,
   * and shown once ready. Without one (a region built away from any renderer) everything stays 3D and batches are
   * shown at once.
   */
  constructor(readonly props: readonly number[], private readonly area?: JobArea) {
    this.group.matrixAutoUpdate = false
  }

  /** Builds the whole region at once. The props layer uses `start` and `step` instead, to spread the work. */
  build(placed: readonly PlacedProp[], isHidden: (prop: number) => boolean): void {
    this.start(isHidden)
    while (this.step((prop) => placed[prop]) === 'more');
  }

  /** Throws away any earlier build and gets ready to build afresh, one `step` at a time. */
  start(isHidden: (prop: number) => boolean): void {
    this.dispose()
    this.generation += 1
    const order = [...this.props].reverse()
    this.work = { gather: order, scans: new Set(), scenes: new Map(), sort: [...order], bake: [], sorted: new Map(), plans: null, cards: [] }
    for (const prop of this.props) if (isHidden(prop)) this.setHidden(prop, true)
  }

  /**
   * One small piece of the build: looking at one prop, sorting it into a card or batches, baking one card, or making
   * one batch. `placedOf` builds a prop's recipe the first time it is asked for.
   */
  step(placedOf: (prop: number) => PlacedProp): StepResult {
    const work = this.work
    if (!work) return 'done'
    const gathered = work.gather.pop()
    if (gathered !== undefined) {
      this.phase = 'prop'
      for (const scan of placedOf(gathered).recipe.scans) this.requestScan(work, scan.url)
      return 'more'
    }
    if (work.scans.size > 0) {
      this.phase = 'scan'
      return 'waiting'
    }
    const sorting = work.sort.pop()
    if (sorting !== undefined) {
      this.phase = 'sort'
      const entry = placedOf(sorting)
      if (this.area && cardMaterials(entry.recipe)) work.bake.push(sorting)
      else this.addModel(work, sorting, entry)
      return 'more'
    }
    const baking = work.bake.pop()
    if (baking !== undefined) {
      const renderer = currentRenderer()
      if (!renderer) {
        work.bake.push(baking)
        return 'waiting'
      }
      this.phase = 'card'
      const entry = placedOf(baking)
      const use = cardUse(renderer, work, baking, entry)
      if (use) work.cards.push(use)
      else {
        modelKinds.add(entry.shape.split('|')[0])
        this.addModel(work, baking, entry)
      }
      return 'more'
    }
    work.plans ??= [...work.sorted.values()]
    const plan = work.plans.pop()
    if (plan) {
      this.phase = 'batch'
      this.addBatch(plan, placedOf)
      return 'more'
    }
    if (work.cards.length > 0) this.addCards(work.cards)
    this.built = true
    this.work = null
    return 'done'
  }

  /**
   * True once the whole region is built and every batch is on the GPU: the props layer shows a region only then, so
   * nothing in it ever appears piece by piece.
   */
  get ready(): boolean {
    return this.built && this.work === null && this.preparing === 0
  }

  /** Which build this is: a change means the region was restarted. */
  get generationNow(): number {
    return this.generation
  }

  isHidden(prop: number): boolean {
    return this.hidden.has(prop)
  }

  setHidden(prop: number, hidden: boolean): void {
    if (hidden === this.hidden.has(prop)) return
    if (hidden) this.hidden.add(prop)
    else this.hidden.delete(prop)
    for (const batch of this.batches) showInstances(batch, prop, !hidden)
    this.cards?.setHidden(prop, hidden)
  }

  dispose(): void {
    for (const { mesh } of this.batches) {
      this.group.remove(mesh)
      mesh.dispose()
    }
    this.batches = []
    if (this.cards) {
      for (const mesh of this.cards.meshes) this.group.remove(mesh)
      this.cards.dispose()
      this.cards = null
    }
    this.preparing = 0
    this.built = false
    this.work = null
  }

  /** Scanned models load in the background; the region sorts its props once all of them are here. */
  private requestScan(work: Work, url: string): void {
    if (work.scans.has(url) || work.scenes.has(url)) return
    work.scans.add(url)
    const generation = this.generation
    loadShared(url).then((scene) => {
      if (generation !== this.generation) return
      work.scenes.set(url, scene)
      work.scans.delete(url)
    }).catch(() => work.scans.delete(url))
  }

  /** Sorts a prop that stays 3D into the region's batches: its own parts, then its scanned models. */
  private addModel(work: Work, prop: number, entry: PlacedProp): void {
    addParts(work.sorted, prop, entry)
    for (const [url, scene] of work.scenes) addScanUses(work.sorted, prop, entry, url, scanPieces(scene))
  }

  /** A batch joins the region once its shaders are compiled and its textures uploaded, so drawing it never stalls. */
  private addBatch(plan: BatchPlan, placedOf: (prop: number) => PlacedProp): void {
    const batch = plan.build((prop) => placedOf(prop).placement)
    for (const prop of this.hidden) showInstances(batch, prop, false)
    this.batches.push(batch)
    this.prepare(batch.mesh, () => this.batches.includes(batch))
  }

  private addCards(uses: CardUse[]): void {
    const cards = buildCards(uses)
    this.cards = cards
    for (const prop of this.hidden) cards.setHidden(prop, true)
    const holder = new Group()
    holder.add(...cards.meshes)
    this.prepare(holder, () => this.cards === cards, () => {
      holder.remove(...cards.meshes)
      this.group.add(...cards.meshes)
    })
  }

  private prepare(object: Object3D, current: () => boolean, attach: () => void = () => this.group.add(object)): void {
    const generation = this.generation
    const show = () => {
      if (generation !== this.generation || !current()) return
      this.preparing -= 1
      attach()
    }
    this.preparing += 1
    if (this.area) prepareJob(object, this.area, show)
    else show()
  }
}

/** True when every part of the prop can be reproduced on a card. */
function cardMaterials(recipe: Recipe): boolean {
  return recipe.parts.every((part) => canBake(part.material))
}

/** Everything a prop is drawn with, in its own space: its parts and its scanned models. */
function cardPieces(work: Work, entry: PlacedProp): CardPiece[] | null {
  const pieces: CardPiece[] = entry.recipe.parts.map(({ geometry, material, matrix, start, count }) => ({ geometry, material, matrix, start, count }))
  for (const scan of entry.recipe.scans) {
    const scene = work.scenes.get(scan.url)
    if (!scene) continue
    for (const piece of scanPieces(scene)) {
      if (!canBake(piece.material)) return null
      const count = piece.geometry.index ? piece.geometry.index.count : piece.geometry.attributes.position.count
      pieces.push({ geometry: piece.geometry, material: piece.material, matrix: scan.matrix, start: 0, count })
    }
  }
  return pieces
}

/** Card key: the prop's shape plus where its scanned models sit (the shape key covers its own parts only). */
function cardKey(entry: PlacedProp): string {
  const scans = entry.recipe.scans.map((scan) => `${scan.url}@${scan.matrix.elements.map((value) => Math.round(value * 1e4)).join(',')}`)
  return `${entry.shape}#${scans.join(';')}`
}

/** The card for a prop, or null if it should stay 3D (too big or deep for a card here, or unbakeable). */
function cardUse(renderer: WebGLRenderer, work: Work, prop: number, entry: PlacedProp): CardUse | null {
  const pieces = cardPieces(work, entry)
  if (!pieces || pieces.length === 0) return null
  const bounds = piecesBounds(pieces)
  const placementZ = entry.placement.elements[14]
  if (!suitsCard(bounds, placementZ, cardView())) return null
  const card = bakeCard(renderer, cardKey(entry), pieces)
  if (!card) return null
  return { prop, card, placement: entry.placement, mirrored: isMirror(entry.placement), shadow: entry.castShadow ? bounds : null }
}

function addScanUses(plans: Map<string, BatchPlan>, prop: number, { recipe, placement, castShadow }: PlacedProp, url: string, pieces: ReturnType<typeof scanPieces>): void {
  for (const scan of recipe.scans) {
    if (scan.url !== url) continue
    const mirrored = isMirror(new Matrix4().multiplyMatrices(placement, scan.matrix))
    const local = mirrored ? scan.matrix.clone().multiply(MIRROR) : scan.matrix
    pieces.forEach((piece, index) => {
      // Pieces that could not be joined may differ in their vertex data, and a batch needs it all alike.
      const attributes = Object.keys(piece.geometry.attributes).sort().join()
      const key = `${piece.material.uuid}:${attributes}`
      const plan = plans.get(key) ?? plans.set(key, new BatchPlan(piece.material)).get(key)!
      plan.castShadow ||= castShadow
      plan.add(`${index}:${mirrored}`, () => (mirrored ? mirroredScan(piece.geometry) : piece.geometry), local, prop)
    })
  }
}

function mirroredScan(geometry: BufferGeometry): BufferGeometry {
  return mirroredScans.get(geometry) ?? mirroredScans.set(geometry, mirrorGeometry(geometry)).get(geometry)!
}

/**
 * Sorts a prop's built parts into batches by how they are drawn and whether they throw a shadow. Each group of parts
 * becomes one shape in the prop's own space; a mirrored prop gets a mirrored shape, and its instance undoes the mirror.
 */
function addParts(plans: Map<string, BatchPlan>, prop: number, { recipe, placement, castShadow, shape }: PlacedProp): void {
  const flip = isMirror(placement) ? MIRROR : IDENTITY
  const groups = new Map<string, { look: BatchLook; casts: boolean; parts: Part[] }>()
  for (const part of recipe.parts) {
    const look: BatchLook = isPlain(part.material) ? 'plain' : part.material
    const casts = castShadow && part.castShadow
    const key = batchKey(look, casts)
    const group = groups.get(key) ?? groups.set(key, { look, casts, parts: [] }).get(key)!
    group.casts ||= casts
    group.parts.push(part)
  }
  for (const [key, { look, casts, parts }] of groups) {
    const plan = plans.get(key) ?? plans.set(key, new BatchPlan(look === 'plain' ? plainMaterial() : look)).get(key)!
    plan.castShadow ||= casts
    const shapeKey = `${shape}|${key}|${casts}|${flip === MIRROR}`
    plan.add(shapeKey, () => shapeOf(shapeKey, look, parts, flip), flip, prop)
  }
}

/**
 * Plain parts are split into a batch that throws shadows and one that does not. Any other material gets one batch
 * per region, which throws shadows if any part in it should: a second draw per material costs more than the few
 * extra shadows (a poster on a tall cabinet) that this adds.
 */
function batchKey(look: BatchLook, casts: boolean): string {
  return look === 'plain' ? `plain:${casts}` : (look as Material).uuid
}

function shapeOf(key: string, look: BatchLook, parts: Part[], flip: Matrix4): BufferGeometry {
  const known = shapes.get(key)
  if (known) return known
  const pieces = parts.map((part) => ({ part, world: flip.clone().multiply(part.matrix) }))
  const geometry = mergePieces(pieces, look)
  shapes.set(key, geometry)
  return geometry
}
