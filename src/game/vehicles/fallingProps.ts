import type { PropState } from '../cover'
import { burst } from '../effects'
import { hurtGuard } from '../guards'
import { addKey, currentBuckets, refile, type KeyList, type KeysOf, type PropBuckets } from '../hazards/buckets'
import { propBox, propById, propMoved } from '../hazards/props'
import { breakProp } from '../hazards/reactions'
import type { Holes } from '../gaps/holes'
import { currentHoles } from '../gaps/state'
import { emitNoise } from '../noise'
import { GRAVITY } from '../physics'
import { standClear } from '../physprops/gravity'
import { propSpec } from '../propCatalog'
import { playSound } from '../sounds'
import { changeMark, changesFrom, TILE_DEFS, TILE_KINDS, tileAt, type Grid } from '../tiles'
import { overlaps, type Rect } from '../types'
import type { World } from '../world'
import { isVehicle, vehicleLanded } from './vehicles'

/**
 * Floor props whose floor has been blown away drop to the next solid floor, hurting whoever they land on.
 * Nothing here looks at every prop or tile each frame: only the tiles the grid lists as changed (and the floor beside
 * them, whose walk-past holes they may have widened) are compared with a copy, and only the props standing on tiles
 * that just stopped holding them are checked.
 */
export type FallingProp = { id: number; vy: number }

export type FallingPropsState = {
  falling: FallingProp[]
  /** One byte per tile, what held things up there when last compared (see `holdsUp`), and the grid it was taken from. */
  solid: Uint8Array | null
  grid: Grid | null
  /** Position in the grid's change list (see `changeMark`) up to which `solid` is up to date. */
  mark: number
  /** Floor props filed by the tiles they stand on. */
  standing: PropBuckets | null
}

const SOLID = Uint8Array.from(TILE_KINDS, (kind) => (TILE_DEFS[kind].solid ? 1 : 0))
const MAX_FALL_SPEED = 30
/** A prop with less than this share of its width on solid floor tips off and falls. */
const SUPPORT_SHARE = 0.5
/** Landing harder than this hurts the prop and anyone under it. */
const HARD_LANDING = 6
const PROP_DAMAGE_PER_SPEED = 4
/** Crushing damage per tile per second of landing speed, per square tile of the prop's side, up to a cap. */
const CRUSH_PER_SPEED_AREA = 1.5
const MAX_CRUSH = 300
const PLAYER_CRUSH_SHARE = 0.5
const DUST = '#8a8f98'

export function createFallingProps(): FallingPropsState {
  return { falling: [], solid: null, grid: null, mark: 0, standing: null }
}

export function stepFallingProps(world: World, dt: number): void {
  const state = world.fallingProps
  if (state.grid !== world.grid || !state.solid) remember(world, state)
  else if (changesFrom(world.grid, state.mark) !== world.grid.changes.tiles.length) {
    for (const prop of propsOnLostTiles(world, state)) {
      // Furniture the player has disturbed has its own physics (physprops/gravity.ts), which drops it.
      if (world.physProps.loose.has(prop.id)) continue
      if (!state.falling.some((item) => item.id === prop.id) && !isSupported(world, state.solid!, prop)) state.falling.push({ id: prop.id, vy: 0 })
    }
  }
  if (state.falling.length === 0) return
  // A prop shoved or grabbed on its way down is the furniture physics' to drop from then on, not both at once.
  state.falling = state.falling.filter((item) => !world.physProps.loose.has(item.id) && !dropProp(world, item, dt))
}

/** Takes the copy of the grid and files the floor props now, during loading, rather than on the first step. */
export function prepareFallingProps(world: World): void {
  remember(world, world.fallingProps)
  indexStanding(world, world.fallingProps)
}

/** Bit set when a tile is solid: what a vehicle needs under it. */
const HOLDS_VEHICLE = 1
/**
 * Bit set when a tile holds furniture up: solid, or a hole blasted in the front of a slab that leaves the back strip,
 * where furniture stands (z -2.2 to -0.6), in place.
 */
const HOLDS_FURNITURE = 2

function holdsUp(kinds: Uint8Array, holes: Holes, index: number): number {
  if (SOLID[kinds[index]]) return HOLDS_VEHICLE | HOLDS_FURNITURE
  // Most open tiles were never floor: a byte lookup rules them out before the set is asked.
  return holes.built[index] !== 0 && holes.walkable.has(index) ? HOLDS_FURNITURE : 0
}

function remember(world: World, state: FallingPropsState): void {
  const { kinds } = world.grid
  const holes = currentHoles(world)
  state.solid = new Uint8Array(kinds.length)
  for (let index = 0; index < kinds.length; index += 1) state.solid[index] = holdsUp(kinds, holes, index)
  state.grid = world.grid
  state.mark = changeMark(world.grid)
}

/**
 * Floor props standing on tiles that held them up at the last look and do not now. Updates the copy as it goes.
 * A changed tile can also widen (or close) a walk-past hole along its row, which changes whether the open tiles
 * beside it hold furniture, so the row is looked at as far as any hole's width could reach.
 */
function propsOnLostTiles(world: World, state: FallingPropsState): PropState[] {
  const { grid } = world
  const holes = currentHoles(world)
  const standing = indexStanding(world, state)
  found.length = 0
  const from = changesFrom(grid, state.mark)
  if (from < 0) {
    for (let index = 0; index < grid.kinds.length; index += 1) compare(grid.kinds, holes, state.solid!, standing, index)
  } else {
    const reach = holeReach(holes)
    const { tiles } = grid.changes
    for (let entry = from; entry < tiles.length; entry += 1) {
      const index = tiles[entry]
      const x = index % grid.width
      const rowStart = index - x
      const last = Math.min(grid.width - 1, x + reach)
      for (let column = Math.max(0, x - reach); column <= last; column += 1) compare(grid.kinds, holes, state.solid!, standing, rowStart + column)
    }
  }
  state.mark = changeMark(grid)
  const props: PropState[] = []
  for (const id of found) {
    const prop = propById(world, id)
    if (prop) props.push(prop)
  }
  return props
}

/** Ids of the props found standing on lost tiles, in the order found, without repeats. */
const found: number[] = []

/** Brings one tile of the copy up to date, noting the props standing on it if it no longer holds what it did. */
function compare(kinds: Uint8Array, holes: Holes, solid: Uint8Array, standing: PropBuckets, index: number): void {
  const now = holdsUp(kinds, holes, index)
  if (solid[index] === now) return
  const lost = (solid[index] & ~now) !== 0
  solid[index] = now
  if (!lost) return
  for (const id of standing.byKey.get(index) ?? []) if (!found.includes(id)) found.push(id)
}

/** How far along a row a changed tile can change whether the tiles beside it are walk-past holes: the widest hole, and a tile more. */
function holeReach(holes: Holes): number {
  let reach = reaches.get(holes)
  if (reach === undefined) {
    reach = 2
    for (const widest of holes.widest) reach = Math.max(reach, widest + 2)
    reaches.set(holes, reach)
  }
  return reach
}
const reaches = new WeakMap<Holes, number>()

/** Floor props filed under the tiles they stand on, brought up to date when the prop list changed. */
function indexStanding(world: World, state: FallingPropsState): PropBuckets {
  state.standing = currentBuckets(state.standing, world.props, standingKeys(world.grid.width))
  return state.standing
}

/** The tiles a floor prop stands on, as bucket keys, for a grid this wide. */
function standingKeys(width: number): KeysOf {
  let keysOf = keyMakers.get(width)
  if (!keysOf) {
    keysOf = (prop: PropState, keys: KeyList): void => {
      const spec = propSpec(prop.kind)
      if (spec.mount !== 'floor') return
      const row = Math.floor(prop.y) * width
      const left = Math.floor(prop.x + 0.5 - spec.w / 2)
      const right = Math.max(left, Math.ceil(prop.x + 0.5 + spec.w / 2) - 1)
      for (let x = left; x <= right; x += 1) addKey(keys, row + x)
    }
    keyMakers.set(width, keysOf)
  }
  return keysOf
}
const keyMakers = new Map<number, KeysOf>()

/** The columns under a floor prop. */
function footprint(prop: PropState): number[] {
  const spec = propSpec(prop.kind)
  const left = Math.floor(prop.x + 0.5 - spec.w / 2)
  const right = Math.max(left, Math.ceil(prop.x + 0.5 + spec.w / 2) - 1)
  const columns: number[] = []
  for (let x = left; x <= right; x += 1) columns.push(x)
  return columns
}

/** Enough of the floor under it is left. A vehicle is too big for the back strip of a slab: it needs solid floor. */
function isSupported(world: World, holding: Uint8Array, prop: PropState): boolean {
  const columns = footprint(prop)
  const row = prop.y * world.grid.width
  const vehicle = isVehicle(prop)
  const held = columns.filter((x) => x >= 0 && x < world.grid.width && (holding[row + x] & (vehicle ? HOLDS_VEHICLE : HOLDS_FURNITURE)) !== 0).length
  return held > 0 && held >= columns.length * SUPPORT_SHARE
}

function touchesSolid(grid: Grid, prop: PropState, row: number): boolean {
  return footprint(prop).some((x) => TILE_DEFS[tileAt(grid, x, row)].solid)
}

/** Moves one falling prop. Returns true when it has landed. */
function dropProp(world: World, item: FallingProp, dt: number): boolean {
  const prop = propById(world, item.id)
  if (!prop) return true
  item.vy = Math.min(MAX_FALL_SPEED, item.vy + GRAVITY * dt)
  const next = prop.y + item.vy * dt
  for (let row = Math.floor(prop.y) + 1; row <= Math.floor(next); row += 1) {
    // Once falling it stops on anything solid under it, even a lump of rubble under one edge: going on would sink it in.
    if (row < world.grid.height && !touchesSolid(world.grid, prop, row)) continue
    land(world, prop, Math.min(row, world.grid.height - 1), item.vy)
    return true
  }
  prop.y = next
  return false
}

function land(world: World, prop: PropState, row: number, speed: number): void {
  prop.y = row
  // Through a hole narrower than itself it came down with its sides in the rim: it settles beside it, not in it.
  standClear(world.grid, prop)
  // The prop now covers other tiles: fire's index and the stand-on index file it afresh.
  propMoved(world, prop)
  const { standing } = world.fallingProps
  if (standing && standing.props === world.props) refile(standing, prop, standingKeys(world.grid.width))
  const spec = propSpec(prop.kind)
  const box = propBox(prop)
  const at = { x: box.x + box.w / 2, y: row - 0.2 }
  burst(world.effects, world.rng, at, 6 + Math.round(spec.w * 2), DUST, 5)
  if (speed < HARD_LANDING) return
  crush(world, box, Math.min(MAX_CRUSH, spec.w * spec.h * speed * CRUSH_PER_SPEED_AREA))
  playSound(world, isVehicle(prop) ? 'collapse' : 'impact', at)
  emitNoise(world, at, Math.min(30, 6 + spec.w * spec.h * 1.5))
  world.shake = Math.min(1, world.shake + Math.min(0.5, spec.w * spec.h * 0.03))
  hurtProp(world, prop, speed * PROP_DAMAGE_PER_SPEED)
  if (isVehicle(prop)) vehicleLanded(world, prop, speed)
}

/** Hurts everyone inside a box something heavy just came down on. */
export function crush(world: World, box: Rect, damage: number): void {
  for (const guard of world.guards) {
    if (guard.state !== 'dead' && overlaps(box, guard)) hurtGuard(world, guard, damage, { x: box.x + box.w / 2, y: box.y }, 'hazard')
  }
  if (overlaps(box, world.player)) world.player.hp -= damage * PLAYER_CRUSH_SHARE
}

/** A hard landing dents a prop; a weak one breaks (and reacts, if it is the kind that does). */
function hurtProp(world: World, prop: PropState, damage: number): void {
  if (prop.broken || !Number.isFinite(prop.hp)) return
  prop.hp -= damage
  if (prop.hp <= 0) breakProp(world, prop)
}
