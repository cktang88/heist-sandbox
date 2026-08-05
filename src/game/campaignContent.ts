import type { EnemyKind, SpawnGroup, WaveDefinition } from './types'

function group(enemy: EnemyKind, count: number, interval: number, startDelay?: number, lane?: number): SpawnGroup {
  return { enemy, count, interval, ...(startDelay === undefined ? {} : { startDelay }), ...(lane === undefined ? {} : { lane }) }
}

// Larger counts arrive in road-width ranks. The interval controls distance between ranks, not individual orcs.
const CAMPAIGN_COUNT_SCALE = 6
const CAMPAIGN_INTERVAL_SCALE = 0.72

function wave(groups: readonly SpawnGroup[], intermission = 1.4, intervalScale = 1): WaveDefinition {
  return {
    groups: groups.map((entry) => entry.enemy === 'ogre' ? entry : {
      ...entry,
      count: entry.count * CAMPAIGN_COUNT_SCALE,
      interval: entry.interval * CAMPAIGN_INTERVAL_SCALE * intervalScale,
    }),
    intermission: Math.max(6, intermission),
  }
}

const forkWave = (groups: readonly SpawnGroup[], intermission = 1.4) => wave(groups, intermission, 1.45)
const citadelWave = (groups: readonly SpawnGroup[], intermission = 1.4) => wave(groups, intermission, 1.95)

export const GREEN_MARCH_WAVES: readonly WaveDefinition[] = [
  wave([group('grunt', 12, 0.58)]),
  wave([group('grunt', 12, 0.5, 0), group('runner', 6, 0.36, 1.5)]),
  wave([group('grunt', 12, 0.45, 0), group('shieldbearer', 6, 0.65, 1.8)]),
  wave([group('grunt', 14, 0.4, 0), group('runner', 8, 0.3, 1.2), group('brute', 3, 0.9, 3.4)]),
  wave([group('grunt', 16, 0.34, 0), group('runner', 8, 0.27, 1), group('shieldbearer', 6, 0.55, 2.2), group('brute', 3, 0.8, 4)]),
]

export const TWIN_FORK_WAVES: readonly WaveDefinition[] = [
  forkWave([group('grunt', 8, 0.52, 0, 0), group('grunt', 8, 0.52, 0, 1)]),
  forkWave([
    group('runner', 7, 0.32, 0, 0), group('runner', 7, 0.32, 0, 1),
    group('grunt', 5, 0.45, 1.5, 0), group('grunt', 5, 0.45, 1.5, 1),
  ]),
  forkWave([
    group('shieldbearer', 5, 0.62, 0, 0), group('shieldbearer', 5, 0.62, 0, 1),
    group('grunt', 8, 0.36, 1.2, 0), group('grunt', 8, 0.36, 1.2, 1),
  ]),
  forkWave([
    group('runner', 10, 0.26, 0, 0), group('runner', 10, 0.26, 0, 1),
    group('sapper', 3, 0.7, 1.8, 0), group('sapper', 3, 0.7, 1.8, 1),
    group('grunt', 5, 0.34, 2.8, 0), group('grunt', 5, 0.34, 2.8, 1),
  ]),
  forkWave([
    group('shieldbearer', 6, 0.52, 0, 0), group('shieldbearer', 6, 0.52, 0, 1),
    group('runner', 8, 0.24, 1, 0), group('runner', 8, 0.24, 1, 1),
    group('brute', 3, 0.78, 3, 0), group('brute', 3, 0.78, 3, 1),
  ]),
]

export const FROZEN_PASS_WAVES: readonly WaveDefinition[] = [
  wave([group('grunt', 16, 0.5)]),
  wave([group('grunt', 12, 0.42, 0), group('shieldbearer', 8, 0.6, 1.4)]),
  wave([group('armored', 8, 0.62, 0), group('runner', 10, 0.3, 1.2), group('grunt', 8, 0.38, 2.4)]),
  wave([group('shieldbearer', 10, 0.5, 0), group('runner', 12, 0.26, 1), group('brute', 6, 0.76, 2.8)]),
  wave([
    group('armored', 10, 0.5, 0), group('shieldbearer', 10, 0.45, 0.8),
    group('runner', 10, 0.24, 1.6), group('brute', 6, 0.7, 3), group('shaman', 4, 0.75, 3.8),
  ]),
]

export const ASH_FIELDS_WAVES: readonly WaveDefinition[] = [
  wave([group('grunt', 18, 0.46)]),
  wave([group('grunt', 12, 0.38, 0), group('armored', 10, 0.58, 1.2)]),
  wave([group('armored', 10, 0.5, 0), group('sapper', 8, 0.42, 1.1), group('berserker', 8, 0.38, 2)]),
  wave([group('armored', 12, 0.45, 0), group('grunt', 8, 0.3, 0.8), group('sapper', 10, 0.36, 1.6), group('banner', 4, 0.72, 2.4)]),
  wave([
    group('armored', 14, 0.4, 0), group('berserker', 12, 0.32, 0.7),
    group('sapper', 10, 0.34, 1.5), group('banner', 4, 0.68, 2.1), group('brute', 6, 0.7, 3.2),
  ]),
]

export const BROKEN_CITADEL_WAVES: readonly WaveDefinition[] = [
  citadelWave([group('grunt', 6, 0.48, 0, 0), group('grunt', 6, 0.48, 0, 1), group('grunt', 6, 0.48, 0, 2)]),
  citadelWave([
    group('runner', 6, 0.3, 0, 0), group('runner', 6, 0.3, 0, 1), group('runner', 6, 0.3, 0, 2),
    group('shieldbearer', 2, 0.65, 1.4, 0), group('shieldbearer', 2, 0.65, 1.4, 1), group('shieldbearer', 2, 0.65, 1.4, 2),
  ]),
  citadelWave([
    group('armored', 4, 0.58, 0, 0), group('armored', 4, 0.58, 0, 1), group('armored', 4, 0.58, 0, 2),
    group('grunt', 4, 0.34, 1, 0), group('grunt', 4, 0.34, 1, 1), group('grunt', 4, 0.34, 1, 2),
    group('shaman', 2, 0.78, 2, 0), group('shaman', 2, 0.78, 2, 1), group('shaman', 2, 0.78, 2, 2),
  ]),
  citadelWave([
    group('sapper', 4, 0.4, 0, 0), group('sapper', 4, 0.4, 0, 1), group('sapper', 4, 0.4, 0, 2),
    group('berserker', 5, 0.34, 1, 0), group('berserker', 5, 0.34, 1, 1), group('berserker', 5, 0.34, 1, 2),
    group('banner', 2, 0.75, 2.2, 0), group('banner', 2, 0.75, 2.2, 1), group('banner', 2, 0.75, 2.2, 2),
  ]),
  { ...citadelWave([
    group('shieldbearer', 4, 0.48, 0, 0), group('shieldbearer', 4, 0.48, 0, 1), group('shieldbearer', 4, 0.48, 0, 2),
    group('armored', 4, 0.45, 0.8, 0), group('armored', 4, 0.45, 0.8, 1), group('armored', 4, 0.45, 0.8, 2),
    group('brute', 3, 0.7, 1.8, 0), group('brute', 3, 0.7, 1.8, 1), group('brute', 3, 0.7, 1.8, 2),
    group('berserker', 3, 0.32, 2.6, 0), group('berserker', 3, 0.32, 2.6, 1), group('berserker', 3, 0.32, 2.6, 2),
    group('shaman', 3, 0.72, 3.2), group('banner', 3, 0.68, 3.4), group('ogre', 1, 1, 5, 1),
  ], 1.8), boss: true, rewardMultiplier: 1.5 },
]

// Broad overlapping streams make the open arena feel like a flood instead of three discrete lanes.
export const SHATTERED_EXPANSE_WAVES: readonly WaveDefinition[] = [
  wave([group('grunt', 20, 0.12, 0, 0), group('grunt', 20, 0.12, 0, 1), group('grunt', 20, 0.12, 0, 2)], 8, 0.55),
  wave([group('grunt', 24, 0.1, 0, 0), group('runner', 16, 0.09, 0.5, 1), group('shieldbearer', 12, 0.16, 1, 2)], 8, 0.5),
  wave([group('armored', 18, 0.14, 0, 0), group('grunt', 24, 0.08, 0, 1), group('sapper', 14, 0.12, 0.8, 2), group('runner', 18, 0.08, 1.2)], 8, 0.45),
  wave([group('berserker', 20, 0.1, 0, 0), group('shieldbearer', 20, 0.11, 0, 1), group('banner', 12, 0.18, 0.6, 2), group('grunt', 30, 0.07, 1)], 8, 0.42),
  { ...wave([group('armored', 24, 0.1, 0, 0), group('berserker', 24, 0.09, 0, 1), group('shaman', 16, 0.16, 0, 2), group('runner', 30, 0.06, 0.7), group('brute', 12, 0.18, 1.2)], 8, 0.4), boss: true, rewardMultiplier: 1.6 },
]

export const CAMPAIGN_WAVES_BY_MAP: Readonly<Record<string, readonly WaveDefinition[]>> = {
  'green-march': GREEN_MARCH_WAVES,
  'twin-fork': TWIN_FORK_WAVES,
  'frozen-pass': FROZEN_PASS_WAVES,
  'ash-fields': ASH_FIELDS_WAVES,
  'broken-citadel': BROKEN_CITADEL_WAVES,
  'shattered-expanse': SHATTERED_EXPANSE_WAVES,
}
