export type ToolId = 'pistol' | 'rifle' | 'rocket' | 'c4' | 'drill' | 'drone'

export type ToolDef = { id: ToolId; name: string; ammo: number; cooldown: number; auto: boolean; quiet: boolean }

/** The player's kit, in hotkey order (1-6). Quiet tools do not raise the alarm by themselves. */
export const TOOLS: readonly ToolDef[] = [
  { id: 'pistol', name: 'Pistol', ammo: 60, cooldown: 0.28, auto: false, quiet: true },
  { id: 'rifle', name: 'Rifle', ammo: 240, cooldown: 0.085, auto: true, quiet: false },
  { id: 'rocket', name: 'Rockets', ammo: 30, cooldown: 0.32, auto: true, quiet: false },
  { id: 'c4', name: 'C4', ammo: 8, cooldown: 0.4, auto: false, quiet: true },
  { id: 'drill', name: 'Drill', ammo: Number.POSITIVE_INFINITY, cooldown: 0, auto: true, quiet: true },
  { id: 'drone', name: 'Drone', ammo: 3, cooldown: 0.5, auto: false, quiet: true },
]
