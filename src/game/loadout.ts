/**
 * The kit the player takes into a heist, chosen on the drop planner: the pistol always, one primary gun, and a few
 * gadgets. Pure: storage and the panel live in the UI; a world made by `createWorld` carries the whole kit until a
 * loadout is applied, so tests and tools that expect every tool keep working.
 */
import type { Player } from './player'
import { actionIndex, toolIndex, TOOLS } from './toolDefs'

/** The pistol is always carried: it is the one-handed gun the player falls back to when carrying a body or a shield. */
export const SIDEARM = 'pistol' as const
export const PRIMARIES = ['rifle', 'shotgun', 'sniper', 'rocket'] as const
export const GADGETS = ['dart', 'c4', 'drill', 'drone', 'smoke', 'flash', 'frag', 'rope', 'grapple'] as const
/** How many gadgets fit in the bag. */
export const GADGET_SLOTS = 4

export type Primary = (typeof PRIMARIES)[number]
export type Gadget = (typeof GADGETS)[number]
export type Loadout = { primary: Primary; gadgets: readonly Gadget[] }

export const DEFAULT_LOADOUT: Readonly<Loadout> = { primary: 'rifle', gadgets: ['dart', 'c4', 'drill', 'grapple'] }

export const LOADOUT_STORAGE_KEY = 'smash-and-grab.loadout'

/** Where a loadout item sits in `TOOLS`. The dart gun, rope, frag and grapple are second-page tools. */
export function loadoutToolIndex(item: Primary | Gadget | typeof SIDEARM): number {
  return item === 'dart' || item === 'frag' || item === 'rope' || item === 'grapple' ? actionIndex(item) : toolIndex(item)
}

/** Repairs anything a stored or hand-made loadout could get wrong: an unknown gun, unknown or repeated gadgets, too many. */
export function normalizeLoadout(value: unknown): Loadout {
  const raw = (typeof value === 'object' && value !== null ? value : {}) as { primary?: unknown; gadgets?: unknown }
  const primary = PRIMARIES.includes(raw.primary as Primary) ? (raw.primary as Primary) : DEFAULT_LOADOUT.primary
  if (!Array.isArray(raw.gadgets)) return { primary, gadgets: [...DEFAULT_LOADOUT.gadgets] }
  const gadgets = [...new Set(raw.gadgets.filter((item): item is Gadget => GADGETS.includes(item as Gadget)))].slice(0, GADGET_SLOTS)
  return { primary, gadgets }
}

export function parseLoadout(text: string | null): Loadout {
  if (!text) return { ...DEFAULT_LOADOUT, gadgets: [...DEFAULT_LOADOUT.gadgets] }
  try {
    return normalizeLoadout(JSON.parse(text))
  } catch {
    return { ...DEFAULT_LOADOUT, gadgets: [...DEFAULT_LOADOUT.gadgets] }
  }
}

export function serializeLoadout(loadout: Loadout): string {
  return JSON.stringify(normalizeLoadout(loadout))
}

/** Adds or removes a gadget; adding one to a full bag does nothing. */
export function toggleGadget(loadout: Loadout, gadget: Gadget): Loadout {
  if (loadout.gadgets.includes(gadget)) return { ...loadout, gadgets: loadout.gadgets.filter((item) => item !== gadget) }
  if (loadout.gadgets.length >= GADGET_SLOTS) return loadout
  return { ...loadout, gadgets: [...loadout.gadgets, gadget] }
}

/** Which of `TOOLS` this loadout carries, by index. */
export function carriedTools(loadout: Loadout): boolean[] {
  const valid = normalizeLoadout(loadout)
  const carried = TOOLS.map(() => false)
  for (const item of [SIDEARM, valid.primary, ...valid.gadgets]) carried[loadoutToolIndex(item)] = true
  return carried
}

/** Gives the player only this loadout: tools left behind have no ammo and cannot be selected. The pistol is in hand. */
export function applyLoadout(player: Player, loadout: Loadout): void {
  player.carried = carriedTools(loadout)
  player.carried.forEach((carried, index) => {
    if (carried) return
    player.ammo[index] = 0
    player.mags[index] = 0
  })
  if (!player.carried[player.tool]) {
    player.tool = loadoutToolIndex(SIDEARM)
    player.reload = 0
  }
}
