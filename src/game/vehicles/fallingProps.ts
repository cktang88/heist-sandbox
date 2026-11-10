import type { PropState } from '../cover'
import { burst } from '../effects'
import { hurtGuard } from '../guards'
import { propById } from '../hazards/props'
import { breakProp } from '../hazards/reactions'
import { emitNoise } from '../noise'
import { GRAVITY } from '../physics'
import { propSpec } from '../propCatalog'
import { playSound } from '../sounds'
import { TILE_DEFS, TILE_KINDS, tileAt, type Grid } from '../tiles'
import { overlaps, type Rect } from '../types'
import type { World } from '../world'
import { isVehicle, vehicleLanded } from './vehicles'

/**
 * Floor props whose floor has been blown away drop to the next solid floor, hurting whoever they land on.
 * Nothing here looks at every prop each frame: the grid is compared with a copy only when it has changed, and only
 * the props standing on tiles that just stopped being solid are checked.
 */
export type FallingProp = { id: number; vy: number }

export type FallingPropsState = {
  falling: FallingProp[]
  /** One byte per tile, 1 where it was solid when last compared, and the grid it was taken from. */
  solid: Uint8Array | null
  grid: Grid | null
  version: number
  /** Tile index to the floor props standing on it, and the prop list it was built from. */
  standingOn: Map<number, number[]> | null
  props: readonly PropState[] | null
  propCount: number
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
  return { falling: [], solid: null, grid: null, version: -1, standingOn: null, props: null, propCount: 0 }
}

export function stepFallingProps(world: World, dt: number): void {
  const state = world.fallingProps
  if (state.grid !== world.grid || !state.solid) remember(world, state)
  else if (world.grid.version !== state.version) {
    for (const prop of propsOnLostTiles(world, state)) {
      if (!state.falling.some((item) => item.id === prop.id) && !isSupported(world.grid, prop, prop.y)) state.falling.push({ id: prop.id, vy: 0 })
    }
  }
  if (state.falling.length === 0) return
  state.falling = state.falling.filter((item) => !dropProp(world, item, dt))
}

function remember(world: World, state: FallingPropsState): void {
  const { kinds } = world.grid
  state.solid = new Uint8Array(kinds.length)
  for (let index = 0; index < kinds.length; index += 1) state.solid[index] = SOLID[kinds[index]]
  state.grid = world.grid
  state.version = world.grid.version
}

/** Floor props standing on tiles that were solid at the last look and are not now. Updates the copy as it goes. */
function propsOnLostTiles(world: World, state: FallingPropsState): PropState[] {
  const solid = state.solid!
  const { kinds } = world.grid
  const found = new Set<number>()
  const standingOn = indexStanding(world, state)
  for (let index = 0; index < kinds.length; index += 1) {
    const now = SOLID[kinds[index]]
    if (solid[index] === now) continue
    solid[index] = now
    if (now === 0) for (const id of standingOn.get(index) ?? []) found.add(id)
  }
  state.version = world.grid.version
  return [...found].map((id) => propById(world, id)).filter((prop): prop is PropState => prop !== undefined)
}

function indexStanding(world: World, state: FallingPropsState): Map<number, number[]> {
  if (state.standingOn && state.props === world.props && state.propCount === world.props.length) return state.standingOn
  const index = new Map<number, number[]>()
  for (const prop of world.props) {
    if (propSpec(prop.kind).mount !== 'floor') continue
    for (const x of footprint(prop)) {
      const key = prop.y * world.grid.width + x
      const list = index.get(key)
      if (list) list.push(prop.id)
      else index.set(key, [prop.id])
    }
  }
  state.standingOn = index
  state.props = world.props
  state.propCount = world.props.length
  return index
}

/** The columns under a floor prop. */
function footprint(prop: PropState): number[] {
  const spec = propSpec(prop.kind)
  const left = Math.floor(prop.x + 0.5 - spec.w / 2)
  const right = Math.max(left, Math.ceil(prop.x + 0.5 + spec.w / 2) - 1)
  const columns: number[] = []
  for (let x = left; x <= right; x += 1) columns.push(x)
  return columns
}

function isSupported(grid: Grid, prop: PropState, row: number): boolean {
  const columns = footprint(prop)
  const solid = columns.filter((x) => TILE_DEFS[tileAt(grid, x, row)].solid).length
  return solid > 0 && solid >= columns.length * SUPPORT_SHARE
}

/** Moves one falling prop. Returns true when it has landed. */
function dropProp(world: World, item: FallingProp, dt: number): boolean {
  const prop = propById(world, item.id)
  if (!prop) return true
  item.vy = Math.min(MAX_FALL_SPEED, item.vy + GRAVITY * dt)
  const next = prop.y + item.vy * dt
  for (let row = Math.floor(prop.y) + 1; row <= Math.floor(next); row += 1) {
    if (row < world.grid.height && !isSupported(world.grid, prop, row)) continue
    land(world, prop, Math.min(row, world.grid.height - 1), item.vy)
    return true
  }
  prop.y = next
  return false
}

function land(world: World, prop: PropState, row: number, speed: number): void {
  prop.y = row
  // The prop now covers other tiles: fire and the stand-on index must look again.
  world.hazards.propIndex = null
  world.fallingProps.standingOn = null
  const spec = propSpec(prop.kind)
  const box: Rect = { x: prop.x + 0.5 - spec.w / 2, y: row - spec.h, w: spec.w, h: spec.h }
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

function crush(world: World, box: Rect, damage: number): void {
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
