import { propBox } from '../hazards/props'
import type { PropKind } from '../propCatalog'
import type { Lamp, Room } from '../site'
import type { Rect } from '../types'
import type { World } from '../world'

/**
 * Things a bullet can hit that the ballistics code passes straight through: water pipes in the walls and ceilings,
 * sinks and toilets, hung fittings (fans, signs, chandeliers). Filed by tile once, so checking a bullet's path is a
 * few map lookups.
 *
 * The generator draws some pipes (`pipeRun` props); rooms that need water (washrooms, kitchens, plant rooms, labs)
 * also get a supply pipe along their ceiling. Which other rooms get one is decided from the room and storey, so it
 * is the same every time the site is built and needs nothing from the generator.
 */
export type TargetKind = 'pipe' | 'fixture' | 'fitting' | 'lamp'
export type Target = { kind: TargetKind; box: Rect; prop: number; lamp: Lamp | null }

const FIXTURES: ReadonlySet<PropKind> = new Set(['sink', 'toilet', 'toiletStall', 'showerStall', 'waterCooler', 'coffeeMachine'])
export const FITTINGS: ReadonlySet<PropKind> = new Set(['ceilingFan', 'projector', 'speaker', 'rangeHood', 'punchingBag', 'neonSign', 'logoSign', 'shelfWall', 'wallAc', 'billboard'])
const HUNG_LAMPS: ReadonlySet<Lamp['fixture']> = new Set(['chandelier', 'pendant'])
const ALWAYS_PIPED: ReadonlySet<Room['kind']> = new Set(['restroom', 'kitchen', 'mechanical', 'janitor', 'lockers'])
const SOMETIMES_PIPED: ReadonlySet<Room['kind']> = new Set(['cafeteria', 'lab', 'infirmary', 'gym', 'breakRoom', 'server', 'office', 'storage', 'workshop', 'garage'])
const CEILING_PIPE_HEIGHT = 0.35

export type TargetIndex = { byTile: Map<number, Target[]>; all: Target[]; props: object; propCount: number; grid: object }

let cache: WeakMap<World, TargetIndex> = new WeakMap()

/** Does this room carry a ceiling supply pipe? */
export function hasCeilingPipe(room: Room): boolean {
  if (ALWAYS_PIPED.has(room.kind)) return true
  if (!SOMETIMES_PIPED.has(room.kind)) return false
  return (room.id * 7 + room.storey * 3 + room.x) % 3 === 0
}

export function ceilingPipeBox(room: Room): Rect {
  return { x: room.x, y: room.y, w: room.w, h: CEILING_PIPE_HEIGHT }
}

export function targetIndex(world: World): TargetIndex {
  const cached = cache.get(world)
  if (cached && cached.grid === world.grid && cached.propCount === world.props.length) return cached
  const all: Target[] = []
  for (const prop of world.props) {
    if (prop.broken) continue
    if (prop.kind === 'pipeRun') all.push({ kind: 'pipe', box: propBox(prop), prop: prop.id, lamp: null })
    else if (FIXTURES.has(prop.kind)) all.push({ kind: 'fixture', box: propBox(prop), prop: prop.id, lamp: null })
    else if (FITTINGS.has(prop.kind)) all.push({ kind: 'fitting', box: propBox(prop), prop: prop.id, lamp: null })
  }
  for (const room of world.rooms) if (hasCeilingPipe(room)) all.push({ kind: 'pipe', box: ceilingPipeBox(room), prop: -1, lamp: null })
  for (const lamp of world.lamps) {
    if (lamp.hung && HUNG_LAMPS.has(lamp.fixture)) all.push({ kind: 'lamp', box: { x: lamp.x - 0.6, y: lamp.y, w: 1.2, h: 0.9 }, prop: -1, lamp })
  }
  const byTile = new Map<number, Target[]>()
  const width = world.grid.width
  for (const target of all) {
    const { box } = target
    for (let y = Math.floor(box.y); y <= Math.floor(box.y + box.h - 0.001); y += 1) {
      for (let x = Math.floor(box.x); x <= Math.floor(box.x + box.w - 0.001); x += 1) {
        const key = y * width + x
        const list = byTile.get(key)
        if (list) list.push(target)
        else byTile.set(key, [target])
      }
    }
  }
  const index = { byTile, all, props: world.props, propCount: world.props.length, grid: world.grid }
  cache.set(world, index)
  return index
}

/** Forgets the index (tests that add props after the first step). */
export function forgetTargets(): void {
  cache = new WeakMap()
}

const NONE: readonly Target[] = []

/** Targets whose box holds this point. */
export function targetsAt(world: World, x: number, y: number): readonly Target[] {
  const list = targetIndex(world).byTile.get(Math.floor(y) * world.grid.width + Math.floor(x))
  if (!list) return NONE
  return list.filter((target) => x >= target.box.x && x <= target.box.x + target.box.w && y >= target.box.y && y <= target.box.y + target.box.h)
}
