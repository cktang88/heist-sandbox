import { Group, Matrix4, type BufferGeometry, type Material } from 'three'
import { loadShared } from '../assets'
import { BatchPlan, MIRROR, showInstances, type BatchedProps } from './batchPlan'
import { mergePieces, type BatchLook } from './merge'
import { mirrorGeometry } from './mirror'
import { isPlain, plainMaterial } from './plainMaterial'
import type { Part, Recipe } from './recipe'
import { scanPieces } from './scanBatch'

/**
 * The props of one large patch of the site, drawn as one batch per material (all plain colours share one), split by
 * whether they throw shadows. Three skips a region whose bounds are outside the view or a shadow camera, and culls
 * the props inside a region one by one, so drawing cost follows what is near the view, not the size of the site.
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

export class Region {
  readonly group = new Group()
  private batches: BatchedProps[] = []
  private hidden = new Set<number>()
  /** Goes up on every build, so a scanned model arriving late does not land in a build that has been replaced. */
  private generation = 0
  built = false

  constructor(readonly props: readonly number[]) {
    this.group.matrixAutoUpdate = false
  }

  build(placed: readonly PlacedProp[], isHidden: (prop: number) => boolean): void {
    this.dispose()
    this.built = true
    this.generation += 1
    const plans = new Map<string, BatchPlan>()
    for (const prop of this.props) addParts(plans, prop, placed[prop])
    for (const plan of plans.values()) this.addBatch(plan, placed)
    this.addScans(placed)
    for (const prop of this.props) if (isHidden(prop)) this.setHidden(prop, true)
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
    this.built = false
  }

  private addBatch(plan: BatchPlan, placed: readonly PlacedProp[]): BatchedProps {
    const batch = plan.build((prop) => placed[prop].placement)
    for (const prop of this.hidden) showInstances(batch, prop, false)
    this.group.add(batch.mesh)
    this.batches.push(batch)
    return batch
  }

  private addScans(placed: readonly PlacedProp[]): void {
    const urls = new Set(this.props.flatMap((prop) => placed[prop].recipe.scans.map((scan) => scan.url)))
    const generation = this.generation
    for (const url of urls) {
      loadShared(url).then((scene) => {
        if (generation !== this.generation || !this.built) return
        const plans = new Map<string, BatchPlan>()
        const pieces = scanPieces(scene)
        for (const prop of this.props) addScanUses(plans, prop, placed[prop], url, pieces)
        for (const plan of plans.values()) this.addBatch(plan, placed)
      }).catch(() => undefined)
    }
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
      const key = `${piece.material.uuid}:${castShadow}:${attributes}`
      const plan = plans.get(key) ?? plans.set(key, new BatchPlan(piece.material, castShadow)).get(key)!
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
    const key = `${look === 'plain' ? 'plain' : (look as Material).uuid}:${casts}`
    const group = groups.get(key) ?? groups.set(key, { look, casts, parts: [] }).get(key)!
    group.parts.push(part)
  }
  for (const [key, { look, casts, parts }] of groups) {
    const plan = plans.get(key) ?? plans.set(key, new BatchPlan(look === 'plain' ? plainMaterial() : look, casts)).get(key)!
    const shapeKey = `${shape}|${key}|${flip === MIRROR}`
    plan.add(shapeKey, () => shapeOf(shapeKey, look, parts, flip), flip, prop)
  }
}

function shapeOf(key: string, look: BatchLook, parts: Part[], flip: Matrix4): BufferGeometry {
  const known = shapes.get(key)
  if (known) return known
  const pieces = parts.map((part) => ({ part, world: flip.clone().multiply(part.matrix) }))
  const geometry = mergePieces(pieces, look)
  shapes.set(key, geometry)
  return geometry
}
