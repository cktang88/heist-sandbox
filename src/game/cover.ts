import { propSpec } from './propCatalog'
import type { Prop } from './site'
import type { Vec } from './types'
import type { World } from './world'

/** A prop in play: it can be damaged and broken. */
export type PropState = Prop & { id: number; hp: number; broken: boolean }

export function createProps(props: readonly Prop[]): PropState[] {
  return props.map((prop, id) => ({ ...prop, id, hp: propSpec(prop.kind).hp, broken: false }))
}

/**
 * Does a prop stop a shot at this point? If so the prop takes the damage.
 * (Placeholder: nothing provides cover yet.)
 */
export function shotHitsProp(_world: World, _at: Vec, _damage: number): boolean {
  return false
}

/** Is the view between two points blocked by tall furniture? (Placeholder: never.) */
export function sightBlockedByProps(_world: World, _from: Vec, _to: Vec): boolean {
  return false
}
