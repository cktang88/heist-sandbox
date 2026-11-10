import { burst } from './effects'
import { propBroke } from './hazards/hazards'
import { propsNear } from './hazards/props'
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
  const speed = Math.hypot(at.vx ?? 0, at.vy ?? 0)
  const tail = speed > 0 ? { x: at.x - ((at.vx ?? 0) / speed) * SHOT_STEP, y: at.y - ((at.vy ?? 0) / speed) * SHOT_STEP } : at
  for (const prop of coverNear(world, at.x)) {
    const box = coverBox(prop)
    if (!segmentHitsBox(tail, at, box) || firedFromBehind(world, box, at)) continue
    burst(world.effects, world.rng, at, 2, DEBRIS, 3)
    damageProp(world, prop, damage)
    return true
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
  for (const prop of coverNear(world, to.x)) {
    if (propCover(world, prop) === 'low' && !crouched) continue
    const box = coverBox(prop)
    if (from.x >= box.left && from.x <= box.right) continue
    const tucked = to.x >= box.left - TUCKED_IN && to.x <= box.right + TUCKED_IN && to.y <= box.bottom
    if (tucked && segmentHitsBox(from, to, box)) return true
  }
  return false
}

/** Is this body sheltering behind a prop right now? For the HUD. */
export function isInCover(world: World, body: Body & { crouching?: boolean }): boolean {
  const feet = body.y + body.h
  return coverNear(world, body.x + body.w / 2).some((prop) => {
    const box = coverBox(prop)
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
  const guards = world.guards.filter((guard) => guard.state !== 'dead')
  const shooters: Body[] = shot.fromPlayer === true ? [world.player] : shot.fromPlayer === false ? guards : [world.player, ...guards]
  return shooters.some((body) => {
    const near = body.x + body.w >= box.left - OWN_COVER_REACH && body.x <= box.right + OWN_COVER_REACH
    const sameFloor = Math.abs(body.y + body.h - box.bottom) < 0.6
    const awayFromThem = shot.vx === undefined || (shot.x - (body.x + body.w / 2)) * shot.vx >= 0
    return near && sameFloor && awayFromThem
  })
}

function targetIsCrouching(world: World, at: Vec): boolean {
  const { player } = world
  return player.crouching && at.x >= player.x && at.x <= player.x + player.w && at.y >= player.y && at.y <= player.y + player.h
}

function coverBox(prop: PropState): Box {
  const spec = propSpec(prop.kind)
  const middle = prop.x + 0.5
  return { left: middle - spec.w / 2, right: middle + spec.w / 2, top: prop.y - spec.h, bottom: prop.y }
}

/** Wall and ceiling props give their top edge as `y`; floor props stand on it. */
function propCenter(prop: PropState): Vec {
  const spec = propSpec(prop.kind)
  return { x: prop.x + 0.5, y: spec.mount === 'floor' ? prop.y - spec.h / 2 : prop.y + spec.h / 2 }
}

/** Does the segment from a to b touch the box? (Clips the segment against each pair of sides in turn.) */
function segmentHitsBox(a: Vec, b: Vec, box: Box): boolean {
  let enter = 0
  let leave = 1
  const clip = (start: number, delta: number, low: number, high: number): boolean => {
    if (delta === 0) return start >= low && start <= high
    let t0 = (low - start) / delta
    let t1 = (high - start) / delta
    if (t0 > t1) [t0, t1] = [t1, t0]
    enter = Math.max(enter, t0)
    leave = Math.min(leave, t1)
    return enter <= leave
  }
  return clip(a.x, b.x - a.x, box.left, box.right) && clip(a.y, b.y - a.y, box.top, box.bottom)
}

const coverIndex = new WeakMap<readonly PropState[], Map<number, PropState[]>>()

/** Unbroken floor props that give cover and stand near this column. A prop on fire is as good as gone. */
function coverNear(world: World, x: number): PropState[] {
  let index = coverIndex.get(world.props)
  if (!index) {
    index = new Map()
    for (const prop of world.props) {
      const spec = propSpec(prop.kind)
      if (spec.mount !== 'floor' || spec.cover === 'none') continue
      const bucket = Math.floor((prop.x + 0.5) / BUCKET)
      index.set(bucket, [...(index.get(bucket) ?? []), prop])
    }
    coverIndex.set(world.props, index)
  }
  const found: PropState[] = []
  for (let bucket = Math.floor((x - QUERY_MARGIN) / BUCKET); bucket <= Math.floor((x + QUERY_MARGIN) / BUCKET); bucket += 1) {
    for (const prop of index.get(bucket) ?? []) if (!prop.broken && !world.hazards.burningProps.has(prop.id)) found.push(prop)
  }
  return found
}
