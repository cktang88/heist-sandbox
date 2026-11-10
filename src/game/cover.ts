import { burst } from './effects'
import { propBroke } from './hazards/hazards'
import { addKey, currentBuckets, type KeyList, type PropBuckets } from './hazards/buckets'
import { propById, propsNear } from './hazards/props'
import { propCover } from './physprops/tip'
import { propSpec } from './propCatalog'
import type { Prop } from './site'
import { playSound } from './sounds'
import type { Body, Vec } from './types'
import type { World } from './world'

/** A prop in play: it can be damaged and broken. */
export type PropState = Prop & { id: number; hp: number; broken: boolean }

/** A point on a shot's path. Projectiles pass themselves, so their heading and owner are known when present. */
export type ShotPoint = Vec & { vx?: number; vy?: number; fromPlayer?: boolean }

type Box = { left: number; right: number; top: number; bottom: number }

/** Shots move in steps of up to this much, so a thin prop is tested along the step, not only at its end. */
const SHOT_STEP = 0.3
/** Someone this close to their own cover shoots over it. */
const OWN_COVER_REACH = 1.2
/** A target this close to a prop's footprint counts as tucked in behind it. */
const TUCKED_IN = 0.6
/** Props are bucketed by column so a lookup only looks at its neighbourhood. */
const BUCKET = 8
const WIDEST_PROP = 7
const QUERY_MARGIN = WIDEST_PROP / 2 + TUCKED_IN + SHOT_STEP
const DEBRIS = '#8b7d6b'

export function createProps(props: readonly Prop[]): PropState[] {
  return props.map((prop, id) => ({ ...prop, id, hp: propSpec(prop.kind).hp, broken: false }))
}

/**
 * Does a prop stop a shot at this point? If so the prop takes the damage.
 * A floor prop with low or high cover is a solid box up to its height, except to whoever is shooting
 * from right behind it: people fire over their own cover.
 */
export function shotHitsProp(world: World, at: ShotPoint, damage: number): boolean {
  const vx = at.vx ?? 0
  const vy = at.vy ?? 0
  const speed = Math.sqrt(vx * vx + vy * vy)
  const tailX = speed > 0 ? at.x - (vx / speed) * SHOT_STEP : at.x
  const tailY = speed > 0 ? at.y - (vy / speed) * SHOT_STEP : at.y
  const buckets = coverBuckets(world)
  for (let bucket = firstBucket(at.x); bucket <= lastBucket(at.x); bucket += 1) {
    for (const id of buckets.byKey.get(bucket) ?? NONE) {
      const prop = propById(world, id)
      if (!prop || !isStanding(world, prop)) continue
      const box = coverBox(prop, scratchBox)
      if (!segmentHitsBox(tailX, tailY, at.x, at.y, box) || firedFromBehind(world, box, at)) continue
      burst(world.effects, world.rng, at, 2, DEBRIS, 3)
      damageProp(world, prop, damage)
      return true
    }
  }
  return false
}

/**
 * Explosions chew up everything nearby, cover or not. Explosions call this alongside breaking tiles; it is the one
 * place blasts damage props, so a prop broken here reacts (blows up, sparks) exactly once, through `propBroke`.
 */
export function hurtPropsInRadius(world: World, at: Vec, radius: number, damage: number): void {
  for (const prop of propsNear(world, at, radius)) {
    if (prop.broken) continue
    const gap = Math.hypot(propCenter(prop).x - at.x, propCenter(prop).y - at.y)
    if (gap <= radius) damageProp(world, prop, damage * (1 - (gap / radius) * 0.75))
  }
}

/**
 * Is the view between two points blocked by furniture? High cover hides anyone tucked in behind it;
 * low cover only hides someone crouching. A viewer standing at the prop sees over it.
 */
export function sightBlockedByProps(world: World, from: Vec, to: Vec): boolean {
  const crouched = targetIsCrouching(world, to)
  const buckets = coverBuckets(world)
  for (let bucket = firstBucket(to.x); bucket <= lastBucket(to.x); bucket += 1) {
    for (const id of buckets.byKey.get(bucket) ?? NONE) {
      const prop = propById(world, id)
      if (!prop || !isStanding(world, prop) || (propCover(world, prop) === 'low' && !crouched)) continue
      const box = coverBox(prop, scratchBox)
      if (from.x >= box.left && from.x <= box.right) continue
      const tucked = to.x >= box.left - TUCKED_IN && to.x <= box.right + TUCKED_IN && to.y <= box.bottom
      if (tucked && segmentHitsBox(from.x, from.y, to.x, to.y, box)) return true
    }
  }
  return false
}

/** Is this body sheltering behind a prop right now? For the HUD. */
export function isInCover(world: World, body: Body & { crouching?: boolean }): boolean {
  const feet = body.y + body.h
  return coverNear(world, body.x + body.w / 2).some((prop) => {
    const box = coverBox(prop, { left: 0, right: 0, top: 0, bottom: 0 })
    const besideIt = body.x + body.w >= box.left - TUCKED_IN && body.x <= box.right + TUCKED_IN && Math.abs(feet - box.bottom) < 0.3
    return besideIt && (propCover(world, prop) === 'high' || body.crouching === true)
  })
}

export function damageProp(world: World, prop: PropState, amount: number): void {
  if (prop.broken || !Number.isFinite(prop.hp)) return
  prop.hp -= amount
  if (prop.hp > 0) return
  prop.hp = 0
  prop.broken = true
  const center = propCenter(prop)
  playSound(world, 'impact', center)
  burst(world.effects, world.rng, center, 8, DEBRIS, 6)
  propBroke(world, prop)
}

/** True when the shot came from someone standing in or right beside this prop, heading away from them. */
function firedFromBehind(world: World, box: Box, shot: ShotPoint): boolean {
  if (shot.fromPlayer !== false && shootsOver(world.player, box, shot)) return true
  if (shot.fromPlayer === true) return false
  for (const guard of world.guards) if (guard.state !== 'dead' && shootsOver(guard, box, shot)) return true
  return false
}

/** Is this body standing at the cover, so that a shot heading away from them passes over it? */
function shootsOver(body: Body, box: Box, shot: ShotPoint): boolean {
  const near = body.x + body.w >= box.left - OWN_COVER_REACH && body.x <= box.right + OWN_COVER_REACH
  const sameFloor = Math.abs(body.y + body.h - box.bottom) < 0.6
  const awayFromThem = shot.vx === undefined || (shot.x - (body.x + body.w / 2)) * shot.vx >= 0
  return near && sameFloor && awayFromThem
}

function targetIsCrouching(world: World, at: Vec): boolean {
  const { player } = world
  return player.crouching && at.x >= player.x && at.x <= player.x + player.w && at.y >= player.y && at.y <= player.y + player.h
}

/** Fills `box` with the box a floor prop fills. Callers in hot loops pass `scratchBox` to avoid allocating. */
function coverBox(prop: PropState, box: Box): Box {
  const spec = propSpec(prop.kind)
  const middle = prop.x + 0.5
  box.left = middle - spec.w / 2
  box.right = middle + spec.w / 2
  box.top = prop.y - spec.h
  box.bottom = prop.y
  return box
}

const scratchBox: Box = { left: 0, right: 0, top: 0, bottom: 0 }

/** Wall and ceiling props give their top edge as `y`; floor props stand on it. */
function propCenter(prop: PropState): Vec {
  const spec = propSpec(prop.kind)
  return { x: prop.x + 0.5, y: spec.mount === 'floor' ? prop.y - spec.h / 2 : prop.y + spec.h / 2 }
}

/**
 * Does the segment from (ax, ay) to (bx, by) touch the box? Clips the segment against the left and right sides,
 * then the top and bottom, narrowing the part of it that is inside.
 */
function segmentHitsBox(ax: number, ay: number, bx: number, by: number, box: Box): boolean {
  let enter = 0
  let leave = 1
  const dx = bx - ax
  if (dx === 0) {
    if (ax < box.left || ax > box.right) return false
  } else {
    const t0 = (box.left - ax) / dx
    const t1 = (box.right - ax) / dx
    enter = Math.max(enter, Math.min(t0, t1))
    leave = Math.min(leave, Math.max(t0, t1))
    if (enter > leave) return false
  }
  const dy = by - ay
  if (dy === 0) return ay >= box.top && ay <= box.bottom
  const t0 = (box.top - ay) / dy
  const t1 = (box.bottom - ay) / dy
  enter = Math.max(enter, Math.min(t0, t1))
  leave = Math.min(leave, Math.max(t0, t1))
  return enter <= leave
}

const NONE: readonly number[] = []
const coverIndex = new WeakMap<World, PropBuckets>()

/** Floor props that can give cover, filed by column band. Follows props that move without rebuilding. */
function coverBuckets(world: World): PropBuckets {
  const buckets = currentBuckets(coverIndex.get(world) ?? null, world.props, coverKeyOf)
  coverIndex.set(world, buckets)
  return buckets
}

function coverKeyOf(prop: PropState, keys: KeyList): void {
  const spec = propSpec(prop.kind)
  if (spec.mount !== 'floor' || spec.cover === 'none') return
  addKey(keys, Math.floor((prop.x + 0.5) / BUCKET))
}

function firstBucket(x: number): number {
  return Math.floor((x - QUERY_MARGIN) / BUCKET)
}

function lastBucket(x: number): number {
  return Math.floor((x + QUERY_MARGIN) / BUCKET)
}

/** A broken prop gives no cover, and a prop on fire is as good as gone. */
function isStanding(world: World, prop: PropState): boolean {
  return !prop.broken && !world.hazards.burningProps.has(prop.id)
}

/** Unbroken floor props that give cover and stand near this column. */
function coverNear(world: World, x: number): PropState[] {
  const buckets = coverBuckets(world)
  const found: PropState[] = []
  for (let bucket = firstBucket(x); bucket <= lastBucket(x); bucket += 1) {
    for (const id of buckets.byKey.get(bucket) ?? NONE) {
      const prop = propById(world, id)
      if (prop && isStanding(world, prop)) found.push(prop)
    }
  }
  return found
}
