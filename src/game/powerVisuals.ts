import type { ActivePowerKind } from './types'

export type PowerTargetMark = 'aircraft' | 'shells' | 'snowflake' | 'radiation' | 'beam' | 'cross'
export const POWER_VISUALS: Record<ActivePowerKind, { color: string; mark: PowerTargetMark }> = {
  strafe: { color: '#f5d46c', mark: 'aircraft' },
  barrage: { color: '#ffad58', mark: 'shells' },
  cryoBeam: { color: '#80e8f2', mark: 'snowflake' },
  nuke: { color: '#ff583d', mark: 'radiation' },
  orbitalLaser: { color: '#f4c7ff', mark: 'beam' },
  repair: { color: '#79dfa0', mark: 'cross' },
}

export function getPowerVisual(kind: ActivePowerKind) { return POWER_VISUALS[kind] }
