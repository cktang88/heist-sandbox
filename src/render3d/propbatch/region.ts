import { Group, Matrix4, type BufferGeometry, type Material } from 'three'
import { loadShared } from '../assets'
import type { StepResult } from '../core/buildQueue'
import { prepareJob, type JobArea } from '../core/gpu'
import { BatchPlan, MIRROR, showInstances, type BatchedProps } from './batchPlan'
import { mergePieces, type BatchLook } from './merge'
import { mirrorGeometry } from './mirror'
import { isPlain, plainMaterial } from './plainMaterial'
import type { Part, Recipe } from './recipe'
import { scanPieces } from './scanBatch'

/**
 * The props of one large patch of the site, drawn as one batch per material (all plain colours share one), split by
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

function isMirror(matrix: Matrix4): boolean {
  return matrix.determinant() < 0
}

/** Where a region's build has got to: props still to sort into batches, batches still to make, scans still to come. */
type Work = {
  props: number[]
  plans: BatchPlan[]
  sorted: Map<string, BatchPlan>
  scans: Set<string>
  arrived: { url: string; scene: Group }[]
}

export class Region {
  readonly group = new Group()
  private batches: BatchedProps[] = []
  private hidden = new Set<number>()
  /** Goes up on every build, so a scanned model arriving late does not land in a build that has been replaced. */
  private generation = 0
  private work: Work | null = null
  /** True once every built prop is in a batch (scanned models may still be on their way). */
  built = false
  /** Batches made but still being uploaded and compiled. */
  private preparing = 0
  /** What the last step did, for the frame probe. */
  phase: 'prop' | 'batch' | 'scan' | 'idle' = 'idle'

  /**
   * `area` places the region for the build queue: each batch is uploaded and compiled there, nearest the view first,
   * and shown once ready. Without one (a region built away from any renderer) batches are shown at once.
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
    this.work = { props: [...this.props].reverse(), plans: [], sorted: new Map(), scans: new Set(), arrived: [] }
    for (const prop of this.props) if (isHidden(prop)) this.setHidden(prop, true)
  }

  /**
   * One small piece of the build: sorting one prop's parts, making one batch, or sorting one scanned model that has
   * arrived. `placedOf` builds a prop's recipe the first time it is asked for.
   */
  step(placedOf: (prop: number) => PlacedProp): StepResult {
    const work = this.work
    if (!work) return 'done'
    const prop = work.props.pop()
    if (prop !== undefined) {
      this.phase = 'prop'
      const entry = placedOf(prop)
      addParts(work.sorted, prop, entry)
      for (const scan of entry.recipe.scans) this.requestScan(work, scan.url)
      if (work.props.length === 0) work.plans.push(...work.sorted.values())
      return 'more'
    }
    const plan = work.plans.pop()
    if (plan) {
      this.phase = 'batch'
      this.addBatch(plan, placedOf)
      return 'more'
    }
    this.built = true
    const arrived = work.arrived.pop()
    if (arrived) {
      this.phase = 'scan'
      const plans = new Map<string, BatchPlan>()
      const pieces = scanPieces(arrived.scene)
      for (const member of this.props) addScanUses(plans, member, placedOf(member), arrived.url, pieces)
      work.plans.push(...plans.values())
      work.scans.delete(arrived.url)
      return 'more'
    }
    if (work.scans.size > 0) return 'waiting'
    this.work = null
    return 'done'
  }

  /**
   * True once the whole region is built, scanned models included, and every batch is on the GPU: the props layer
   * shows a region only then, so nothing in it ever appears piece by piece.
   */
  get ready(): boolean {
    return this.built && this.work === null && this.preparing === 0
  }

  isHidden(prop: number): boolean {
    return this.hidden.has(prop)
  }

  setHidden(prop: number, hidden: boolean): void {
    if (hidden === this.hidden.has(prop)) return
    if (hidden) this.hidden.add(prop)
    else this.hidden.delete(prop)
    for (const batch of this.batches) showInstances(batch, prop, !hidden)
  }

  dispose(): void {
    for (const { mesh } of this.batches) {
      this.group.remove(mesh)
      mesh.dispose()
    }
    this.batches = []
    this.preparing = 0
    this.built = false
    this.work = null
  }

  /** Scanned models load in the background; each one is sorted into batches by a later step once it is here. */
  private requestScan(work: Work, url: string): void {
    if (work.scans.has(url)) return
    work.scans.add(url)
    const generation = this.generation
    loadShared(url).then((scene) => {
      if (generation === this.generation) work.arrived.push({ url, scene })
    }).catch(() => work.scans.delete(url))
  }

  /** A batch joins the region once its shaders are compiled and its textures uploaded, so drawing it never stalls. */
  private addBatch(plan: BatchPlan, placedOf: (prop: number) => PlacedProp): void {
    const batch = plan.build((prop) => placedOf(prop).placement)
    for (const prop of this.hidden) showInstances(batch, prop, false)
    this.batches.push(batch)
    const generation = this.generation
    const show = () => {
      if (generation !== this.generation || !this.batches.includes(batch)) return
      this.preparing -= 1
      this.group.add(batch.mesh)
    }
    this.preparing += 1
    if (this.area) prepareJob(batch.mesh, this.area, show)
    else show()
  }
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
