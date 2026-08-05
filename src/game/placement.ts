import { BUILD, isTowerKind } from './config'
import { distance, distanceToPath } from './path'
import type { BuildTool, MapDefinition, Placement, Point } from './types'

export function isValidPlacement(point: Point, kind: BuildTool, placements: readonly Placement[], map: MapDefinition): boolean {
  const insideMap = Math.abs(point.x) < map.width / 2 - 0.7 && Math.abs(point.z) < map.depth / 2 - 0.7
  if (!insideMap || placements.some((item) => distance(point, item) < BUILD.minSpacing)) return false
  if (map.obstacles?.some((obstacle) => distance(point, obstacle) < obstacle.radius + 0.65)) return false
  if (map.secondaryObjective && distance(point, map.secondaryObjective) < 1.1) return false
  if (kind === 'wall' && map.paths.some((path) => distance(point, path[0]) < 1.2 || distance(point, path[path.length - 1]) < 1.2)) return false
  if (isTowerKind(kind) && map.buildZones?.length && !map.buildZones.some((zone) => distance(point, zone) <= zone.radius)) return false
  const pathDistance = Math.min(...map.paths.map((path) => distanceToPath(point, path)))
  return isTowerKind(kind) ? pathDistance > map.pathWidth / 2 + 0.3 : pathDistance < 0.45
}
