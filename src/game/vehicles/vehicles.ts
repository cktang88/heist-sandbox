import type { PropState } from '../cover'
import { igniteProp } from '../hazards/burning'
import type { PropKind } from '../propCatalog'
import type { World } from '../world'

/**
 * Parked vehicles are props (propCatalog.ts): bullets and blasts damage them through cover.ts, and a wrecked one blows
 * up through hazards/reactions.ts. A burning one cooks off after a few seconds (hazards/burning.ts). What is added here
 * is the crash: a vehicle that drops through a destroyed floor lands, crushes whoever is under it, and starts to burn.
 */
const VEHICLES: ReadonlySet<PropKind> = new Set(['car', 'van', 'truck', 'forklift'])
/** A drop faster than this (about two metres) ruptures the fuel tank. */
const RUPTURE_SPEED = 12

export function isVehicle(prop: PropState): boolean {
  return VEHICLES.has(prop.kind)
}

export function vehicleLanded(world: World, prop: PropState, speed: number): void {
  if (speed > RUPTURE_SPEED && !prop.broken) igniteProp(world, prop.id)
}
