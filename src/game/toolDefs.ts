import { GRAPPLE_TOOL } from './grapple/tool'

export type ToolId = 'pistol' | 'rifle' | 'shotgun' | 'sniper' | 'rocket' | 'c4' | 'drill' | 'drone' | 'smoke' | 'flash' | 'frag' | 'rope' | 'grapple'

/** The second-page tools, which share a hotkey with a first-page one. `id` is the item the renderers draw in the hands. */
export type ToolAction = 'frag' | 'rope' | 'grapple' | 'dart'

/**
 * `slot` is the hotkey a second-page tool shares with a first-page one: pressing that key again swaps between them.
 * First-page tools use the key of their own index.
 */
export type ToolDef = { id: ToolId; name: string; ammo: number; cooldown: number; auto: boolean; quiet: boolean; action?: ToolAction; slot?: number }

/** The ten hotkeys, 1-9 then 0. */
export const HOTKEYS = 10

/** The player's kit. The first ten are on keys 1-9, then 0; for guns, `ammo` is the spare rounds beyond the first magazine. */
export const TOOLS: readonly ToolDef[] = [
  { id: 'pistol', name: 'Pistol', ammo: 60, cooldown: 0.2, auto: false, quiet: true },
  { id: 'rifle', name: 'Rifle', ammo: 210, cooldown: 0.085, auto: true, quiet: false },
  { id: 'shotgun', name: 'Shotgun', ammo: 30, cooldown: 0.6, auto: false, quiet: false },
  { id: 'sniper', name: 'Sniper', ammo: 16, cooldown: 0.9, auto: false, quiet: false },
  { id: 'rocket', name: 'Rockets', ammo: 28, cooldown: 0.3, auto: true, quiet: false },
  { id: 'c4', name: 'C4', ammo: 8, cooldown: 0.4, auto: false, quiet: true },
  { id: 'drill', name: 'Drill', ammo: Number.POSITIVE_INFINITY, cooldown: 0, auto: true, quiet: true },
  { id: 'drone', name: 'Drone', ammo: 3, cooldown: 0.5, auto: false, quiet: true },
  { id: 'smoke', name: 'Smoke', ammo: 4, cooldown: 0.6, auto: false, quiet: true },
  { id: 'flash', name: 'Flash', ammo: 4, cooldown: 0.6, auto: false, quiet: false },
  // Second page: a frag shares the smoke key (9), the rope shares the drill key (7).
  { id: 'frag', name: 'Frag', ammo: 4, cooldown: 0.6, auto: false, quiet: false, action: 'frag', slot: 8 },
  { id: 'rope', name: 'Rope', ammo: 3, cooldown: 0.5, auto: false, quiet: true, action: 'rope', slot: 6 },
  // The grapple's entry predates its own hand model; it is drawn as a grappling gun.
  { ...GRAPPLE_TOOL, id: 'grapple' },
  // The dart gun shares the pistol key (1) and is drawn as a pistol.
  { id: 'pistol', name: 'Dart gun', ammo: 5, cooldown: 0.9, auto: false, quiet: true, action: 'dart', slot: 0 },
]

/** The first tool with this held item: always the first-page one. */
export function toolIndex(id: ToolId): number {
  return TOOLS.findIndex((tool) => tool.id === id && !tool.action)
}

export function actionIndex(action: ToolAction): number {
  return TOOLS.findIndex((tool) => tool.action === action)
}

function slotOf(index: number): number {
  return TOOLS[index].slot ?? index
}

/** Every tool a hotkey cycles through, first page first. */
export function toolsOnKey(key: number): number[] {
  return TOOLS.map((_, index) => index).filter((index) => slotOf(index) === key)
}

/** The tool a hotkey press picks. Pressing the key of the tool in hand swaps to the next tool on that key. */
export function toolForKey(key: number, current: number): number {
  const onKey = toolsOnKey(key)
  const at = onKey.indexOf(current)
  return at < 0 ? onKey[0] : onKey[(at + 1) % onKey.length]
}

/**
 * The mouse wheel steps through every tool in order, second page included. `Input.selectTool` carries it as a number
 * past the hotkeys, so it never reads as a key (or as a choice in an open terminal menu).
 */
export function wheelSelection(steps: number): number {
  return HOTKEYS + (((steps % TOOLS.length) + TOOLS.length) % TOOLS.length)
}

/** The tool an `Input.selectTool` picks: 0-9 is a hotkey, anything past that is a step of the wheel. */
export function toolForSelection(selection: number, current: number): number {
  if (selection >= HOTKEYS) return (current + selection - HOTKEYS) % TOOLS.length
  return toolForKey(selection, current)
}
