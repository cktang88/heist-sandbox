import { propSpec, type PropKind } from '../propCatalog'

/**
 * Which furniture can be shoved around, tipped, stood on and thrown. Decided from the catalogue's size and set,
 * plus a short list of things that are plumbed, bolted or built in however small they are.
 */

const BUILT_IN: ReadonlySet<PropKind> = new Set<PropKind>([
  'toilet', 'sink', 'showerStall', 'toiletStall', 'kitchenCounter', 'servingCounter', 'barCounter', 'receptionDesk', 'stove',
  'turnstile', 'metalDetector', 'cellBars', 'cellBench', 'fumeHood', 'labBench', 'pump', 'coolingUnit', 'rug',
])
/** Metal and stone things weigh more than wooden and padded ones of the same size. */
const DENSE = 1.8
const MAX_PUSH_WIDTH = 3.4
const MAX_PUSH_HEIGHT = 2.6
const MAX_PUSH_WEIGHT = 8
/** Lighter than this is a thing you pick up and throw rather than drag. */
const MIN_PUSH_WEIGHT = 0.9
const MAX_THROW_WIDTH = 0.9
const MAX_THROW_HEIGHT = 1.3
const MAX_THROW_WEIGHT = 1.7
/** Heavy enough to hold a door shut when shoved against it. */
const DOOR_BLOCKING_WEIGHT = 2.5
/** A thrown thing this heavy knocks a man off his feet. */
const KNOCKDOWN_WEIGHT = 0.9
/** Tables that go over onto their side when kicked, top toward the threat and the kicker behind it. */
const TABLES: ReadonlySet<PropKind> = new Set<PropKind>(['desk', 'deskCorner', 'executiveDesk', 'cafeteriaTable', 'tableTennis', 'toolBench'])
/** The one wall-hung thing small and loose enough to grab and throw. */
const WALL_THROWABLES: ReadonlySet<PropKind> = new Set<PropKind>(['fireExtinguisher'])

/** A rough mass in arbitrary units: footprint area, more for dense materials. */
export function weightOf(kind: PropKind): number {
  const spec = propSpec(kind)
  return spec.w * spec.h * (spec.burns ? 1 : DENSE)
}

function movable(kind: PropKind): boolean {
  const spec = propSpec(kind)
  return Number.isFinite(spec.hp) && spec.set !== 'exterior' && !BUILT_IN.has(kind)
}

/** Furniture standing on the floor that a person can drag or shove. */
export function isPushable(kind: PropKind): boolean {
  const spec = propSpec(kind)
  const weight = weightOf(kind)
  return spec.mount === 'floor' && movable(kind) && spec.w <= MAX_PUSH_WIDTH && spec.h <= MAX_PUSH_HEIGHT
    && weight >= MIN_PUSH_WEIGHT && weight <= MAX_PUSH_WEIGHT
}

/** Small loose things: bins, chairs, stools, signs, an extinguisher off the wall. Nothing that explodes in the hand. */
export function isThrowable(kind: PropKind): boolean {
  const spec = propSpec(kind)
  if (WALL_THROWABLES.has(kind)) return true
  return spec.mount === 'floor' && movable(kind) && spec.reacts !== 'explodes'
    && spec.w <= MAX_THROW_WIDTH && spec.h <= MAX_THROW_HEIGHT && weightOf(kind) <= MAX_THROW_WEIGHT
}

export function isTable(kind: PropKind): boolean {
  return TABLES.has(kind) && isPushable(kind)
}

/** A top firm and wide enough to stand on: anything pushable at least half a body wide and knee high. */
export function isStandable(kind: PropKind): boolean {
  const spec = propSpec(kind)
  return isPushable(kind) && spec.w >= 0.8 && spec.h >= 0.5
}

export function blocksDoors(kind: PropKind): boolean {
  return weightOf(kind) >= DOOR_BLOCKING_WEIGHT
}

export function knocksDown(kind: PropKind): boolean {
  return weightOf(kind) >= KNOCKDOWN_WEIGHT
}
