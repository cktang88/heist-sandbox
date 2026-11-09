export type ToolId = 'pistol' | 'rifle' | 'shotgun' | 'sniper' | 'rocket' | 'c4' | 'drill' | 'drone'

export type ToolDef = { id: ToolId; name: string; ammo: number; cooldown: number; auto: boolean; quiet: boolean }

/** The player's kit, in hotkey order (1-8). Quiet tools do not raise the alarm by themselves. */
export const TOOLS: readonly ToolDef[] = [
  { id: 'pistol', name: 'Pistol', ammo: 60, cooldown: 0.22, auto: false, quiet: true },
  { id: 'rifle', name: 'Rifle', ammo: 240, cooldown: 0.085, auto: true, quiet: false },
  { id: 'shotgun', name: 'Shotgun', ammo: 32, cooldown: 0.6, auto: false, quiet: false },
  { id: 'sniper', name: 'Sniper', ammo: 16, cooldown: 0.9, auto: false, quiet: false },
  { id: 'rocket', name: 'Rockets', ammo: 30, cooldown: 0.32, auto: true, quiet: false },
  { id: 'c4', name: 'C4', ammo: 8, cooldown: 0.4, auto: false, quiet: true },
  { id: 'drill', name: 'Drill', ammo: Number.POSITIVE_INFINITY, cooldown: 0, auto: true, quiet: true },
  { id: 'drone', name: 'Drone', ammo: 3, cooldown: 0.5, auto: false, quiet: true },
]

export function toolIndex(id: ToolId): number {
  return TOOLS.findIndex((tool) => tool.id === id)
}
