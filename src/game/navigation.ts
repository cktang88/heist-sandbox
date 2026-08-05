import { distance, distanceToPath } from './path'
import { distanceToPolygon } from './polygon'
import type { MapDefinition, Point } from './types'
import { distanceToWall } from './wall'

export type NavigationWall = Point & {
  id: number
  rotation?: number
  length: number
  radius: number
}

export type NavigationOptions = {
  cellSize: number
  corridorPadding: number
  obstaclePadding: number
}

export type NavigationField = {
  columns: number
  rows: number
  cellSize: number
  originX: number
  originZ: number
  distances: Float32Array
  nextCell: Int32Array
  walkable: Uint8Array
  blockingOwner: Int32Array
  wallIds: number[]
  goals: readonly Point[]
}

export type NavigationSample = {
  reachable: boolean
  atGoal: boolean
  next: Point
  direction: Point
  blockingWallId?: number
}

export type NavigationCache = {
  topologyKey: string
  field: NavigationField
  rebuilds: number
}

export const DEFAULT_NAVIGATION_OPTIONS: NavigationOptions = {
  cellSize: 0.4,
  corridorPadding: 0.9,
  obstaclePadding: 0.3,
}

const ORC_ROUTE_MARGIN = 0.28

export function buildNavigationField(
  map: MapDefinition,
  walls: readonly NavigationWall[] = [],
  options: NavigationOptions = DEFAULT_NAVIGATION_OPTIONS,
): NavigationField {
  const cellSize = Math.max(0.2, options.cellSize)
  const columns = Math.max(1, Math.ceil(map.width / cellSize))
  const rows = Math.max(1, Math.ceil(map.depth / cellSize))
  const originX = -map.width / 2
  const originZ = -map.depth / 2
  const cellCount = columns * rows
  const walkable = new Uint8Array(cellCount)
  const blockedOwner = new Int32Array(cellCount)
  const wallIds = walls.map((wall) => wall.id)

  for (let index = 0; index < cellCount; index += 1) {
    const point = cellCenter(index, columns, cellSize, originX, originZ)
    if (map.navigationMode !== 'open' && !isCorridorCellWalkable(point, map, walls, options)) continue
    if (map.obstacles?.some((obstacle) => distance(point, obstacle) <= obstacle.radius + options.obstaclePadding)) continue
    if (map.solidPolygons?.some((polygon) => distanceToPolygon(point, polygon.points) <= options.obstaclePadding)) continue
    const wallIndex = walls.findIndex((wall) => distanceToWall(point, wall, wall.length) <= wall.radius)
    if (wallIndex >= 0) blockedOwner[index] = wallIndex + 1
    else walkable[index] = 1
  }

  const distances = new Float32Array(cellCount).fill(Number.POSITIVE_INFINITY)
  const nextCell = new Int32Array(cellCount).fill(-1)
  const queue: number[] = []
  const goals = map.paths.map((path) => path[path.length - 1])
  for (const goal of goals) {
    const goalCell = nearestWalkableCell(goal, walkable, columns, rows, cellSize, originX, originZ)
    if (goalCell < 0 || distances[goalCell] === 0) continue
    distances[goalCell] = 0
    nextCell[goalCell] = goalCell
    queue.push(goalCell)
  }

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor]
    for (const neighbor of neighbors(current, columns, rows, walkable)) {
      if (Number.isFinite(distances[neighbor])) continue
      distances[neighbor] = distances[current] + 1
      nextCell[neighbor] = current
      queue.push(neighbor)
    }
  }

  const blockingOwner = new Int32Array(cellCount)
  const wallQueue: number[] = []
  for (let index = 0; index < cellCount; index += 1) {
    if (!walkable[index] || Number.isFinite(distances[index])) continue
    const owner = adjacentWallOwner(index, blockedOwner, columns, rows)
    if (!owner) continue
    blockingOwner[index] = owner
    nextCell[index] = nearestOwnedNeighbor(index, owner, blockedOwner, columns, rows)
    wallQueue.push(index)
  }
  for (let cursor = 0; cursor < wallQueue.length; cursor += 1) {
    const current = wallQueue[cursor]
    for (const neighbor of orthogonalNeighbors(current, columns, rows)) {
      if (!walkable[neighbor] || Number.isFinite(distances[neighbor]) || blockingOwner[neighbor]) continue
      blockingOwner[neighbor] = blockingOwner[current]
      nextCell[neighbor] = current
      wallQueue.push(neighbor)
    }
  }

  return { columns, rows, cellSize, originX, originZ, distances, nextCell, walkable, blockingOwner, wallIds, goals }
}

/** Keeps ordinary movement on the painted road while opening a local shoulder around authored walls. */
function isCorridorCellWalkable(point: Point, map: MapDefinition, walls: readonly NavigationWall[], options: NavigationOptions): boolean {
  const distanceFromRoad = Math.min(...map.paths.map((path) => distanceToPath(point, path)))
  const roadRadius = Math.max(options.cellSize * 0.55, map.pathWidth / 2 - ORC_ROUTE_MARGIN)
  if (distanceFromRoad <= roadRadius) return true
  const detourPadding = Math.max(0, options.corridorPadding)
  if (detourPadding === 0 || distanceFromRoad > map.pathWidth / 2 + detourPadding) return false
  return walls.some((wall) => distanceToWall(point, wall, wall.length) <= wall.radius + detourPadding + options.cellSize)
}

export function updateNavigationCache(
  previous: NavigationCache | null,
  map: MapDefinition,
  walls: readonly NavigationWall[],
  options: NavigationOptions = DEFAULT_NAVIGATION_OPTIONS,
): NavigationCache {
  const topologyKey = navigationTopologyKey(map, walls, options)
  if (previous?.topologyKey === topologyKey) return previous
  return { topologyKey, field: buildNavigationField(map, walls, options), rebuilds: (previous?.rebuilds ?? 0) + 1 }
}

export function sampleNavigation(field: NavigationField, point: Point): NavigationSample {
  const current = nearestWalkableCell(point, field.walkable, field.columns, field.rows, field.cellSize, field.originX, field.originZ)
  if (current < 0) return { reachable: false, atGoal: false, next: point, direction: { x: 0, z: 0 } }
  const reachable = Number.isFinite(field.distances[current])
  const targetIndex = field.nextCell[current]
  const owner = field.blockingOwner[current]
  const blockingWallId = owner ? field.wallIds[owner - 1] : undefined
  if (targetIndex < 0) return { reachable, atGoal: false, next: point, direction: { x: 0, z: 0 }, blockingWallId }
  const atGoal = reachable && field.distances[current] === 0
  const next = atGoal ? nearestPoint(point, field.goals) : cellCenter(targetIndex, field.columns, field.cellSize, field.originX, field.originZ)
  const length = distance(point, next)
  return {
    reachable,
    atGoal,
    next,
    direction: length > 0.0001 ? { x: (next.x - point.x) / length, z: (next.z - point.z) / length } : { x: 0, z: 0 },
    blockingWallId,
  }
}

/** Exact grid lookup used by collision-safe impulses; unlike sampling it never snaps through a blocker. */
export function isNavigationPointWalkable(field: NavigationField, point: Point): boolean {
  return isNavigationPositionWalkable(field, point.x, point.z)
}

/** Coordinate form avoids allocating temporary points in the 5k-enemy movement loop. */
export function isNavigationPositionWalkable(field: NavigationField, x: number, z: number): boolean {
  const column = Math.floor((x - field.originX) / field.cellSize)
  const row = Math.floor((z - field.originZ) / field.cellSize)
  if (column < 0 || column >= field.columns || row < 0 || row >= field.rows) return false
  return field.walkable[row * field.columns + column] === 1
}

export function navigationTopologyKey(map: MapDefinition, walls: readonly NavigationWall[], options: NavigationOptions = DEFAULT_NAVIGATION_OPTIONS): string {
  const mapShape = [map.id, map.width, map.depth, map.pathWidth,
    map.navigationMode ?? 'corridor',
    ...map.paths.flatMap((path) => path.flatMap((point) => [point.x, point.z])),
    ...(map.obstacles ?? []).flatMap((obstacle) => [obstacle.x, obstacle.z, obstacle.radius]),
    ...(map.solidPolygons ?? []).flatMap((polygon) => polygon.points.flatMap((point) => [point.x, point.z]))]
  const wallShape = [...walls].sort((left, right) => left.id - right.id)
    .flatMap((wall) => [wall.id, wall.x, wall.z, wall.rotation ?? 0, wall.length, wall.radius])
  return [...mapShape, options.cellSize, options.corridorPadding, options.obstaclePadding, ...wallShape].join('|')
}

function cellCenter(index: number, columns: number, cellSize: number, originX: number, originZ: number): Point {
  return { x: originX + (index % columns + 0.5) * cellSize, z: originZ + (Math.floor(index / columns) + 0.5) * cellSize }
}

function nearestWalkableCell(point: Point, walkable: Uint8Array, columns: number, rows: number, cellSize: number, originX: number, originZ: number): number {
  const column = clamp(Math.floor((point.x - originX) / cellSize), 0, columns - 1)
  const row = clamp(Math.floor((point.z - originZ) / cellSize), 0, rows - 1)
  const direct = row * columns + column
  if (walkable[direct]) return direct
  for (let radius = 1; radius <= 4; radius += 1) {
    let best = -1
    let bestDistance = Number.POSITIVE_INFINITY
    for (let z = Math.max(0, row - radius); z <= Math.min(rows - 1, row + radius); z += 1) {
      for (let x = Math.max(0, column - radius); x <= Math.min(columns - 1, column + radius); x += 1) {
        const index = z * columns + x
        if (!walkable[index]) continue
        const currentDistance = distance(point, cellCenter(index, columns, cellSize, originX, originZ))
        if (currentDistance < bestDistance) { best = index; bestDistance = currentDistance }
      }
    }
    if (best >= 0) return best
  }
  return -1
}

function neighbors(index: number, columns: number, rows: number, walkable: Uint8Array): number[] {
  const result = orthogonalNeighbors(index, columns, rows).filter((neighbor) => walkable[neighbor])
  const x = index % columns
  const z = Math.floor(index / columns)
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const nextX = x + dx
    const nextZ = z + dz
    if (nextX < 0 || nextX >= columns || nextZ < 0 || nextZ >= rows) continue
    const diagonal = nextZ * columns + nextX
    const horizontal = z * columns + nextX
    const vertical = nextZ * columns + x
    if (walkable[diagonal] && walkable[horizontal] && walkable[vertical]) result.push(diagonal)
  }
  return result
}

function orthogonalNeighbors(index: number, columns: number, rows: number): number[] {
  const x = index % columns
  const z = Math.floor(index / columns)
  const result: number[] = []
  if (x > 0) result.push(index - 1)
  if (x + 1 < columns) result.push(index + 1)
  if (z > 0) result.push(index - columns)
  if (z + 1 < rows) result.push(index + columns)
  return result
}

function adjacentWallOwner(index: number, blockedOwner: Int32Array, columns: number, rows: number): number {
  for (const neighbor of orthogonalNeighbors(index, columns, rows)) if (blockedOwner[neighbor]) return blockedOwner[neighbor]
  return 0
}

function nearestOwnedNeighbor(index: number, owner: number, blockedOwner: Int32Array, columns: number, rows: number): number {
  return orthogonalNeighbors(index, columns, rows).find((neighbor) => blockedOwner[neighbor] === owner) ?? -1
}

function nearestPoint(point: Point, candidates: readonly Point[]): Point {
  return candidates.reduce((closest, candidate) => distance(point, candidate) < distance(point, closest) ? candidate : closest, candidates[0] ?? point)
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}
