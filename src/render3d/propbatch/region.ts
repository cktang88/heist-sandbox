import { Group, Mesh, type BufferAttribute, type Material, type Matrix4 } from 'three'
import { loadShared } from '../assets'
import { mergePieces, type BatchLook, type Piece, type PropSpan } from './merge'
import { isPlain, plainMaterial } from './plainMaterial'
import type { Recipe } from './recipe'
import { instanceScans, type ScanInstances, type ScanUse } from './scanBatch'

/**
 * The props of one patch of the site, baked into a handful of meshes: one per material (all plain colours share
 * one), split by whether they throw shadows, plus instanced batches for scanned models. Three skips a whole
 * region whose bounds are off screen or outside a shadow camera, so drawing cost follows what is near the view.
 */

/** A prop ready to bake: what it is made of, where it stands and whether it may throw a shadow at all. */
export type PlacedProp = { recipe: Recipe; world: Matrix4; castShadow: boolean }

type Batch = { mesh: Mesh; spans: Map<number, PropSpan> }

export class Region {
  readonly group = new Group()
  private batches: Batch[] = []
  private scans: ScanInstances[] = []
  /** Props left out of, or folded away in, the current bake. */
  private hidden = new Set<number>()
  /** Goes up on every bake, so a scanned model arriving late does not land in a bake that has been replaced. */
  private generation = 0
  built = false

  constructor(readonly props: readonly number[]) {
    this.group.matrixAutoUpdate = false
  }

  build(placed: readonly PlacedProp[], isHidden: (prop: number) => boolean): void {
    this.dispose()
    this.built = true
    this.generation += 1
    const shown = this.props.filter((prop) => !isHidden(prop))
    this.hidden = new Set(this.props.filter((prop) => isHidden(prop)))
    for (const [look, pieces, castShadow] of groupPieces(shown, placed)) this.addBatch(look, pieces, castShadow)
    this.addScans(shown, placed)
  }

  isHidden(prop: number): boolean {
    return this.hidden.has(prop)
  }

  /** Folds a prop's vertices into a point, which draws nothing, without rebuilding anything. */
  hide(prop: number): void {
    if (this.hidden.has(prop)) return
    this.hidden.add(prop)
    for (const { mesh, spans } of this.batches) {
      const span = spans.get(prop)
      if (!span) continue
      const position = mesh.geometry.attributes.position as BufferAttribute
      position.array.fill(0, span.start * 3, (span.start + span.count) * 3)
      position.addUpdateRange(span.start * 3, span.count * 3)
      position.needsUpdate = true
    }
    for (const scans of this.scans) scans.hide(prop)
  }

  dispose(): void {
    for (const { mesh } of this.batches) {
      this.group.remove(mesh)
      mesh.geometry.dispose()
    }
    for (const scans of this.scans) scans.dispose()
    this.batches = []
    this.scans = []
    this.built = false
  }

  private addBatch(look: BatchLook, pieces: Piece[], castShadow: boolean): void {
    const merged = mergePieces(pieces, look)
    const mesh = new Mesh(merged.geometry, look === 'plain' ? plainMaterial() : look)
    mesh.castShadow = castShadow
    mesh.receiveShadow = true
    mesh.matrixAutoUpdate = false
    this.group.add(mesh)
    this.batches.push({ mesh, spans: new Map(merged.spans.map((span) => [span.prop, span])) })
  }

  private addScans(shown: readonly number[], placed: readonly PlacedProp[]): void {
    const byUrl = new Map<string, ScanUse[]>()
    for (const prop of shown) {
      const { recipe, world, castShadow } = placed[prop]
      for (const scan of recipe.scans) {
        const uses = byUrl.get(scan.url) ?? byUrl.set(scan.url, []).get(scan.url)!
        uses.push({ world: world.clone().multiply(scan.matrix), prop, castShadow })
      }
    }
    const generation = this.generation
    for (const [url, uses] of byUrl) {
      loadShared(url).then((scene) => {
        if (generation !== this.generation || !this.built) return
        const scans = instanceScans(uses, scene, this.group)
        this.scans.push(scans)
        for (const use of uses) if (this.hidden.has(use.prop)) scans.hide(use.prop)
      }).catch(() => undefined)
    }
  }
}

/** Sorts every part of the given props into batches by how it is drawn and whether it throws a shadow. */
function groupPieces(shown: readonly number[], placed: readonly PlacedProp[]): [BatchLook, Piece[], boolean][] {
  const batches = new Map<string, [BatchLook, Piece[], boolean]>()
  for (const prop of shown) {
    const { recipe, world, castShadow } = placed[prop]
    for (const part of recipe.parts) {
      const look: BatchLook = isPlain(part.material) ? 'plain' : part.material
      const casts = castShadow && part.castShadow
      const key = `${look === 'plain' ? 'plain' : (look as Material).uuid}:${casts}`
      const batch = batches.get(key) ?? batches.set(key, [look, [], casts]).get(key)!
      batch[1].push({ part, world: world.clone().multiply(part.matrix), prop })
    }
  }
  return [...batches.values()]
}
