import type { Point } from './types'

export type SpatialBounds = { minX: number; maxX: number; minZ: number; maxZ: number }
export type SpatialIndexTelemetry = { entities: number; cells: number; queries: number; candidatesChecked: number }

type SpatialEntity = Point
type Predicate<T> = (entity: T) => boolean

/** A fixed-snapshot uniform grid. Buckets and links stay in compact typed arrays. */
export class EnemySpatialIndex<T extends SpatialEntity> {
  items: readonly T[]
  readonly cellSize: number
  private bounds: SpatialBounds
  private columns: number
  private rows: number
  private heads: Int32Array
  private next: Int32Array
  private xs: Float32Array
  private zs: Float32Array
  private queries = 0
  private candidatesChecked = 0

  constructor(items: readonly T[], cellSize = 1.5, bounds?: SpatialBounds) {
    this.items = []
    this.cellSize = Math.max(0.1, cellSize)
    this.bounds = normalizeBounds([], bounds, this.cellSize)
    this.columns = 0
    this.rows = 0
    this.heads = new Int32Array(0)
    this.next = new Int32Array(0)
    this.xs = new Float32Array(0)
    this.zs = new Float32Array(0)
    this.rebuild(items, bounds)
  }

  /** Rebuilds buckets in-place, retaining buffers while entity count and map bounds stay stable. */
  rebuild(items: readonly T[], bounds?: SpatialBounds): void {
    this.items = items
    this.bounds = normalizeBounds(items, bounds, this.cellSize)
    this.columns = Math.max(1, Math.ceil((this.bounds.maxX - this.bounds.minX) / this.cellSize))
    this.rows = Math.max(1, Math.ceil((this.bounds.maxZ - this.bounds.minZ) / this.cellSize))
    const cellCount = this.columns * this.rows
    if (this.heads.length !== cellCount) this.heads = new Int32Array(cellCount)
    this.heads.fill(-1)
    if (this.next.length < items.length) {
      const capacity = Math.max(items.length, Math.ceil(this.next.length * 1.5), 64)
      this.next = new Int32Array(capacity)
      this.xs = new Float32Array(capacity)
      this.zs = new Float32Array(capacity)
    }
    this.next.fill(-1, 0, items.length)
    this.queries = 0
    this.candidatesChecked = 0
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index]
      this.xs[index] = item.x
      this.zs[index] = item.z
      const cell = this.cellIndex(item.x, item.z)
      this.next[index] = this.heads[cell]
      this.heads[cell] = index
    }
  }

  /** Computes local crowd separation without allocating and sorting a neighbor array. */
  separationVector(point: T, radius: number, predicate: Predicate<T> = always, maxNeighbors = Number.POSITIVE_INFINITY, jitterSeed = 0, out: Point = { x: 0, z: 0 }): Point {
    this.queries += 1
    const safeRadius = Math.max(0, radius)
    const radiusSquared = safeRadius * safeRadius
    let x = 0
    let z = 0
    let matched = 0
    const minColumn = this.column(point.x - safeRadius)
    const maxColumn = this.column(point.x + safeRadius)
    const minRow = this.row(point.z - safeRadius)
    const maxRow = this.row(point.z + safeRadius)
    outer: for (let row = minRow; row <= maxRow; row += 1) {
      for (let column = minColumn; column <= maxColumn; column += 1) {
        for (let index = this.heads[row * this.columns + column]; index >= 0; index = this.next[index]) {
          this.candidatesChecked += 1
          const candidate = this.items[index]
          if (candidate === point || !predicate(candidate)) continue
          const dx = point.x - this.xs[index]
          const dz = point.z - this.zs[index]
          const distanceSquared = dx * dx + dz * dz
          if (distanceSquared > radiusSquared) continue
          if (distanceSquared < 0.000001) {
            const angle = jitterSeed * 2.399963229728653
            x += Math.cos(angle)
            z += Math.sin(angle)
          } else {
            const spacing = Math.sqrt(distanceSquared)
            const strength = (safeRadius - spacing) / safeRadius
            x += dx / spacing * strength
            z += dz / spacing * strength
          }
          matched += 1
          if (matched >= maxNeighbors) break outer
        }
      }
    }
    const length = Math.hypot(x, z)
    out.x = length > 0.0001 ? x / length : 0
    out.z = length > 0.0001 ? z / length : 0
    return out
  }

  nearest(point: Point, radius: number, predicate: Predicate<T> = always): T | undefined {
    this.queries += 1
    let bestIndex = -1
    let bestDistanceSquared = Math.max(0, radius) ** 2
    this.visitCandidateIndices(point, radius, (index) => {
      const item = this.items[index]
      if (!predicate(item)) return
      const distanceSquared = squaredDistance(point.x, point.z, this.xs[index], this.zs[index])
      if (distanceSquared < bestDistanceSquared || distanceSquared === bestDistanceSquared && (bestIndex < 0 || index < bestIndex)) {
        bestIndex = index
        bestDistanceSquared = distanceSquared
      }
    })
    return bestIndex < 0 ? undefined : this.items[bestIndex]
  }

  withinRadius(point: Point, radius: number, predicate: Predicate<T> = always, maxResults = Number.POSITIVE_INFINITY): T[] {
    this.queries += 1
    const radiusSquared = Math.max(0, radius) ** 2
    const matches: number[] = []
    this.visitCandidateIndices(point, radius, (index) => {
      if (squaredDistance(point.x, point.z, this.xs[index], this.zs[index]) <= radiusSquared && predicate(this.items[index])) matches.push(index)
      return matches.length < maxResults
    })
    matches.sort((left, right) => left - right)
    return matches.map((index) => this.items[index])
  }

  neighbors(entity: T, radius: number, predicate: Predicate<T> = always, maxResults = Number.POSITIVE_INFINITY): T[] {
    return this.withinRadius(entity, radius, (candidate) => candidate !== entity && predicate(candidate), maxResults)
  }

  someWithinRadius(point: Point, radius: number, predicate: Predicate<T>): boolean {
    this.queries += 1
    const radiusSquared = Math.max(0, radius) ** 2
    let found = false
    this.visitCandidateIndices(point, radius, (index) => {
      found = squaredDistance(point.x, point.z, this.xs[index], this.zs[index]) <= radiusSquared && predicate(this.items[index])
      return !found
    })
    return found
  }

  telemetry(): SpatialIndexTelemetry {
    return { entities: this.items.length, cells: this.heads.length, queries: this.queries, candidatesChecked: this.candidatesChecked }
  }

  private visitCandidateIndices(point: Point, radius: number, visit: (index: number) => boolean | void): void {
    const safeRadius = Math.max(0, radius)
    const minColumn = this.column(point.x - safeRadius)
    const maxColumn = this.column(point.x + safeRadius)
    const minRow = this.row(point.z - safeRadius)
    const maxRow = this.row(point.z + safeRadius)
    outer: for (let row = minRow; row <= maxRow; row += 1) {
      for (let column = minColumn; column <= maxColumn; column += 1) {
        for (let index = this.heads[row * this.columns + column]; index >= 0; index = this.next[index]) {
          this.candidatesChecked += 1
          if (visit(index) === false) break outer
        }
      }
    }
  }

  private cellIndex(x: number, z: number): number { return this.row(z) * this.columns + this.column(x) }
  private column(x: number): number { return clamp(Math.floor((x - this.bounds.minX) / this.cellSize), 0, this.columns - 1) }
  private row(z: number): number { return clamp(Math.floor((z - this.bounds.minZ) / this.cellSize), 0, this.rows - 1) }
}

function normalizeBounds<T extends SpatialEntity>(items: readonly T[], supplied: SpatialBounds | undefined, margin: number): SpatialBounds {
  if (supplied) return {
    minX: Math.min(supplied.minX, supplied.maxX - 0.001), maxX: Math.max(supplied.maxX, supplied.minX + 0.001),
    minZ: Math.min(supplied.minZ, supplied.maxZ - 0.001), maxZ: Math.max(supplied.maxZ, supplied.minZ + 0.001),
  }
  if (!items.length) return { minX: -margin, maxX: margin, minZ: -margin, maxZ: margin }
  return {
    minX: Math.min(...items.map((item) => item.x)) - margin,
    maxX: Math.max(...items.map((item) => item.x)) + margin,
    minZ: Math.min(...items.map((item) => item.z)) - margin,
    maxZ: Math.max(...items.map((item) => item.z)) + margin,
  }
}

function squaredDistance(ax: number, az: number, bx: number, bz: number): number { return (ax - bx) ** 2 + (az - bz) ** 2 }
function clamp(value: number, minimum: number, maximum: number): number { return Math.max(minimum, Math.min(maximum, value)) }
function always() { return true }
