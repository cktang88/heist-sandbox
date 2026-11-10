import type { Stairwell } from './site'
import { landingX } from './stairs'
import type { Vec } from './types'

/** The next thing to do to get from one spot to another: walk along this floor, take a staircase, or drop through a hole in the floor. */
export type Hop =
  | { kind: 'walk'; x: number }
  | { kind: 'stairs'; well: Stairwell; stop: number; direction: 1 | -1 }
  | { kind: 'drop'; x: number }
  | { kind: 'none' }

/** The column of the hole in slab row `floorY` nearest x that someone may drop through, or null. Holes are a way down only. */
export type HoleFinder = (floorY: number, x: number) => number | null

/** A first step and what the whole route costs, in tiles of walking (Infinity when it is not known). */
type Planned = { hop: Hop; cost: number }

const SAME_FLOOR = 1.5
const AT_LANDING = 0.5
/** What a flight costs, in tiles of walking: a staircase is steep and slower than the floor. */
const FLIGHT_COST = 8

/**
 * Plans one step of a route between floors. Positions are feet positions.
 * Floors of different buildings only meet at street level, so a route to another building goes down to the
 * street, across, and up the other building's stairs. Within a building the route is the shortest one over its
 * staircases that never walks across the open void over a double-height room.
 * With `holes`, a hole in the floor is a way down too, taken when walking to it, dropping and walking on is shorter
 * than the route by the stairs.
 * Returns 'none' when no staircase serves this floor, so the caller can try something else (a ladder).
 */
export function nextHop(wells: readonly Stairwell[], from: Vec, goal: Vec, holes?: HoleFinder): Hop {
  const planned = byStairs(wells, from, goal)
  if (!holes || goal.y - from.y < SAME_FLOOR) return planned.hop
  const column = holes(Math.round(from.y), from.x)
  if (column === null) return planned.hop
  const x = column + 0.5
  return Math.abs(x - from.x) + Math.abs(goal.x - x) < planned.cost ? { kind: 'drop', x } : planned.hop
}

function byStairs(wells: readonly Stairwell[], from: Vec, goal: Vec): Planned {
  const plan = planFor(wells)
  const here = buildingAt(plan, from)
  const there = buildingAt(plan, goal)
  if (here === there) return route(graphOf(plan, here), from, goal)
  if (here !== null && Math.abs(from.y - plan.streetY) >= SAME_FLOOR) return route(graphOf(plan, here), from, { x: goal.x, y: plan.streetY })
  if (Math.abs(goal.y - from.y) < SAME_FLOOR || there === null) return { hop: { kind: 'walk', x: goal.x }, cost: Infinity }
  return route(graphOf(plan, there), from, goal)
}

type Split = { y: number; from: number; to: number }
type Landing = { well: Stairwell; stop: number; x: number; y: number }
/** One building's staircases as a graph: landings, and the flights and walks between them with their costs. */
type Graph = { wells: readonly Stairwell[]; splits: readonly Split[]; landings: Landing[]; links: { to: number; cost: number }[][] }
type Building = { name: string; x0: number; x1: number; top: number; bottom: number }
/**
 * What is worked out once per list of staircases. Breaking a flight replaces the list (see stairs.ts),
 * so a new list is planned afresh.
 */
type Plan = { wells: readonly Stairwell[]; buildings: Building[]; streetY: number; graphs: Map<string | null, Graph> }

const plans = new WeakMap<readonly Stairwell[], Plan>()

function planFor(wells: readonly Stairwell[]): Plan {
  const known = plans.get(wells)
  if (known) return known
  const buildings: Building[] = []
  for (const well of wells) {
    if (!well.bounds || buildings.some((other) => other.name === well.building)) continue
    const stops = wells.filter((other) => other.building === well.building).flatMap((other) => other.stops)
    buildings.push({ name: well.building, x0: well.bounds.x0, x1: well.bounds.x1, top: Math.min(...stops), bottom: Math.max(...stops) })
  }
  const plan = { wells, buildings, streetY: wells.find((well) => well.bounds)?.bounds?.streetY ?? 0, graphs: new Map() }
  plans.set(wells, plan)
  return plan
}

/** Plans every building's staircases now, during loading, rather than on each building's first route. */
export function planStairs(wells: readonly Stairwell[]): void {
  const plan = planFor(wells)
  graphOf(plan, null)
  for (const building of plan.buildings) graphOf(plan, building.name)
}

/**
 * The building a spot is in: between its outer walls and between its lowest and highest stair stops. Null outdoors
 * (the street, the sewer under everything), and on a site whose staircases carry no bounds.
 */
function buildingAt(plan: Plan, at: Vec): string | null {
  const inside = (building: Building) => at.x >= building.x0 && at.x <= building.x1 + 1 && at.y <= building.bottom + 0.5 && at.y >= building.top - 0.5
  return plan.buildings.find(inside)?.name ?? null
}

/** A building's staircase graph; with no building known, of every staircase (a site of one building, or outdoors). */
function graphOf(plan: Plan, building: string | null): Graph {
  const known = plan.graphs.get(building)
  if (known) return known
  const wells = building === null ? plan.wells : plan.wells.filter((well) => well.building === building)
  const splits = building === null ? [] : (wells[0]?.bounds?.splits ?? [])
  const landings = wells.flatMap((well) => well.stops.map((y, stop) => ({ well, stop, x: landingX(well, stop), y })))
  const links = landings.map((landing) => landings.flatMap((next, to) => {
    if (next.well === landing.well) return Math.abs(next.stop - landing.stop) === 1 ? [{ to, cost: FLIGHT_COST }] : []
    return Math.abs(next.y - landing.y) < 0.5 && walkable(splits, landing.y, landing.x, next.x) ? [{ to, cost: Math.abs(next.x - landing.x) }] : []
  }))
  const graph = { wells, splits, landings, links }
  plan.graphs.set(building, graph)
  return graph
}

/** Can someone walk along floor `y` from `a` to `b`, or does a void cut the way? */
function walkable(splits: readonly Split[], y: number, a: number, b: number): boolean {
  const low = Math.min(a, b)
  const high = Math.max(a, b)
  for (const split of splits) if (Math.abs(split.y - y) < 0.5 && split.from < high && split.to + 1 > low) return false
  return true
}

/**
 * The first step of the cheapest route over a building's staircases: walk to a landing, ride flights, walk off.
 * A small Dijkstra over the landings (a building has a few dozen).
 */
function route(graph: Graph, from: Vec, goal: Vec): Planned {
  const { landings, links, splits } = graph
  if (Math.abs(goal.y - from.y) < SAME_FLOOR && walkable(splits, from.y, from.x, goal.x)) return { hop: { kind: 'walk', x: goal.x }, cost: Math.abs(goal.x - from.x) }
  const count = landings.length
  const { cost, previous, done } = scratchFor(count)
  for (let index = 0; index < count; index += 1) {
    cost[index] = onFloor(splits, landings[index], from) ? Math.abs(landings[index].x - from.x) : Infinity
    previous[index] = -1
    done[index] = 0
  }
  let bestTotal = Infinity
  let bestLanding = -1
  for (;;) {
    let index = -1
    for (let other = 0; other < count; other += 1) if (!done[other] && cost[other] < (index < 0 ? Infinity : cost[index])) index = other
    if (index < 0 || cost[index] >= bestTotal) break
    done[index] = 1
    if (onFloor(splits, landings[index], goal)) {
      const total = cost[index] + Math.abs(goal.x - landings[index].x)
      if (total < bestTotal) {
        bestTotal = total
        bestLanding = index
      }
    }
    for (const link of links[index]) {
      if (cost[index] + link.cost >= cost[link.to]) continue
      cost[link.to] = cost[index] + link.cost
      previous[link.to] = index
    }
  }
  // No way all the way there (a flight is down): climb as far toward it as the stairs go, then the caller tries a ladder.
  if (bestLanding < 0) return { hop: climb(graph.wells, from, goal.y), cost: Infinity }
  // Back from the last landing to the first, remembering the one after it.
  let at = bestLanding
  let after = -1
  while (previous[at] >= 0) {
    after = at
    at = previous[at]
  }
  return { hop: firstStep(landings[at], after < 0 ? null : landings[after], from, goal), cost: bestTotal }
}

/** Is a landing on the floor of this spot, with no void between them? */
function onFloor(splits: readonly Split[], landing: Landing, spot: Vec): boolean {
  return Math.abs(landing.y - spot.y) < 0.5 && walkable(splits, spot.y, landing.x, spot.x)
}

/** Scratch for `route`, kept between calls: guards ask for routes many times a frame. */
const scratch = { cost: new Float64Array(64), previous: new Int32Array(64), done: new Uint8Array(64) }

function scratchFor(count: number): typeof scratch {
  if (scratch.cost.length < count) {
    const size = Math.max(count, scratch.cost.length * 2)
    scratch.cost = new Float64Array(size)
    scratch.previous = new Int32Array(size)
    scratch.done = new Uint8Array(size)
  }
  return scratch
}

function firstStep(start: Landing, next: Landing | null, from: Vec, goal: Vec): Hop {
  if (Math.abs(start.x - from.x) > AT_LANDING) return { kind: 'walk', x: start.x }
  // At the landing: ride the flight, or (where the route walks over to another staircase, or this was the last landing) walk on.
  if (!next) return { kind: 'walk', x: goal.x }
  if (next.well !== start.well) return { kind: 'walk', x: next.x }
  return { kind: 'stairs', well: start.well, stop: start.stop, direction: next.stop > start.stop ? 1 : -1 }
}

/** Heads for the nearest staircase that goes the right way from this floor. */
function climb(wells: readonly Stairwell[], from: Vec, targetY: number): Hop {
  const direction = targetY < from.y ? 1 : -1
  let best: { well: Stairwell; stop: number; gap: number } | null = null
  for (const well of wells) {
    const stop = well.stops.findIndex((y) => Math.abs(y - from.y) < 0.5)
    if (stop < 0 || stop + direction < 0 || stop + direction >= well.stops.length) continue
    const gap = Math.abs(landingX(well, stop) - from.x)
    if (!best || gap < best.gap) best = { well, stop, gap }
  }
  if (!best) return { kind: 'none' }
  if (best.gap <= AT_LANDING) return { kind: 'stairs', well: best.well, stop: best.stop, direction }
  return { kind: 'walk', x: landingX(best.well, best.stop) }
}
