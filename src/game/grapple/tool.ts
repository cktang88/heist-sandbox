import type { ToolDef } from '../toolDefs'

/**
 * The grappling hook's entry for `TOOLS`, in the shape `toolDefs.ts` uses. It goes on the drill key (7) as a third
 * entry after the Rope, so 7 cycles Drill, Rope, Grapple. The hands hold the same small kit item as the Rope until it
 * has a model of its own. It never runs out: the one hook comes back after each shot.
 *
 * `ToolAction` in `toolDefs.ts` must gain `| 'grapple'`; until then the action is typed here on its own.
 */
export const GRAPPLE_TOOL: Omit<ToolDef, 'action'> & { action: 'grapple' } = {
  id: 'c4', name: 'Grapple', ammo: Number.POSITIVE_INFINITY, cooldown: 0.25, auto: false, quiet: true, action: 'grapple', slot: 6,
}
