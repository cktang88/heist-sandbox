import type { MapDefinition } from './types'

export const MAP_PALETTE_PRESETS = {
  woodland: { label: 'Woodland', palette: { ground: '#33472e', path: '#796442', background: '#101811', rock: '#6d7257' } },
  highland: { label: 'Highland', palette: { ground: '#384b35', path: '#806b48', background: '#111a12', rock: '#77765e' } },
  frost: { label: 'Frost', palette: { ground: '#53686a', path: '#96a7a0', background: '#10191c', rock: '#b7c2bd' } },
  ash: { label: 'Ash', palette: { ground: '#493d34', path: '#80624a', background: '#171210', rock: '#7c6c61' } },
  citadel: { label: 'Citadel', palette: { ground: '#34363a', path: '#6e6259', background: '#111216', rock: '#77777b' } },
} as const

export type MapPalettePreset = keyof typeof MAP_PALETTE_PRESETS

export const GREEN_MARCH: MapDefinition = {
  id: 'green-march',
  name: 'The Green March',
  width: 22,
  depth: 14,
  pathWidth: 1.8,
  paths: [[
    { x: -11, z: -2.8 }, { x: -7.5, z: -2.8 }, { x: -4.2, z: 2.7 },
    { x: 0.8, z: 2.7 }, { x: 4.4, z: -1.5 }, { x: 11, z: -1.5 },
  ]],
  palette: { ground: '#33472e', path: '#796442', background: '#101811', rock: '#6d7257' },
}

export const FROZEN_PASS: MapDefinition = {
  id: 'frozen-pass',
  name: 'Frozen Pass',
  width: 22,
  depth: 14,
  pathWidth: 1.35,
  paths: [[
    { x: -11, z: -4.5 }, { x: -7.5, z: -4.5 }, { x: -6, z: 2.8 },
    { x: -1.5, z: 3.6 }, { x: 1.5, z: -2.8 }, { x: 6, z: -3.4 },
    { x: 7.5, z: 1.2 }, { x: 11, z: 1.2 },
  ]],
  buildZones: [
    { x: -8.2, z: 0.2, radius: 1.5 },
    { x: -2.6, z: -0.8, radius: 1.65 },
    { x: 3.8, z: 0.2, radius: 1.6 },
    { x: 8.3, z: -2.2, radius: 1.35 },
  ],
  obstacles: [
    { x: -9, z: 4.8, radius: 0.7 },
    { x: -2, z: -5, radius: 0.75 },
    { x: 3, z: 4.9, radius: 0.65 },
    { x: 8.5, z: 4.7, radius: 0.75 },
  ],
  palette: { ground: '#53686a', path: '#96a7a0', background: '#10191c', rock: '#b7c2bd' },
}

export const ASH_FIELDS: MapDefinition = {
  id: 'ash-fields',
  name: 'Ash Fields',
  width: 22,
  depth: 14,
  pathWidth: 2.4,
  paths: [[
    { x: -11, z: 4.2 }, { x: -7.5, z: 4.2 }, { x: -4.5, z: 0.5 },
    { x: -1, z: -3.7 }, { x: 3.2, z: -3.7 }, { x: 5.2, z: 1.8 },
    { x: 8, z: 3.2 }, { x: 11, z: 3.2 },
  ]],
  obstacles: [
    { x: -9.2, z: -3.8, radius: 0.85 },
    { x: -5, z: 5.2, radius: 0.7 },
    { x: 0.2, z: 4.9, radius: 0.8 },
    { x: 8.7, z: -3.6, radius: 0.75 },
  ],
  palette: { ground: '#493d34', path: '#80624a', background: '#171210', rock: '#7c6c61' },
}

export const TWIN_FORK: MapDefinition = {
  id: 'twin-fork', name: 'Twin Fork', width: 22, depth: 14, pathWidth: 1.55,
  paths: [
    [{ x: -11, z: -4 }, { x: -7, z: -4 }, { x: -3, z: -1 }, { x: 1, z: 0 }, { x: 5, z: 2 }, { x: 11, z: 0 }],
    [{ x: -11, z: 4 }, { x: -7, z: 4 }, { x: -3, z: 1 }, { x: 1, z: 0 }, { x: 5, z: -2 }, { x: 11, z: 0 }],
  ],
  secondaryObjective: { kind: 'supplyCache', x: 1, z: 0, health: 280, bonusMedals: 12 },
  palette: { ground: '#384b35', path: '#806b48', background: '#111a12', rock: '#77765e' },
}

export const BROKEN_CITADEL: MapDefinition = {
  id: 'broken-citadel', name: 'Broken Citadel', width: 22, depth: 14, pathWidth: 1.65,
  paths: [
    [{ x: -11, z: -4.8 }, { x: -7.5, z: -4.8 }, { x: -5, z: -1.8 }, { x: -1, z: -3.8 }, { x: 3, z: -2.8 }, { x: 6, z: 0 }, { x: 11, z: 0 }],
    [{ x: -11, z: 0 }, { x: -7, z: 0 }, { x: -4, z: 2 }, { x: 0, z: 0 }, { x: 5, z: 0 }, { x: 11, z: 0 }],
    [{ x: -11, z: 4.8 }, { x: -7.5, z: 4.8 }, { x: -5, z: 1.8 }, { x: -1, z: 3.8 }, { x: 3, z: 2.8 }, { x: 6, z: 0 }, { x: 11, z: 0 }],
  ],
  buildZones: [
    { x: -7.7, z: -2, radius: 1.25 },
    { x: -7.7, z: 2, radius: 1.25 },
    { x: -1.5, z: 0, radius: 1.45 },
    { x: 4.5, z: -4.8, radius: 1.2 },
    { x: 4.5, z: 4.8, radius: 1.2 },
  ],
  obstacles: [
    { x: -9, z: -2.2, radius: 0.6 },
    { x: -9, z: 2.2, radius: 0.6 },
    { x: -3, z: -5.5, radius: 0.65 },
    { x: -3, z: 5.5, radius: 0.65 },
    { x: 2, z: -5.4, radius: 0.6 },
    { x: 2, z: 5.4, radius: 0.6 },
  ],
  palette: { ground: '#34363a', path: '#6e6259', background: '#111216', rock: '#77777b' },
}

/** A late-game arena: the dashed anchor lines only identify three spawn regions and the shared fortress. */
export const SHATTERED_EXPANSE: MapDefinition = {
  id: 'shattered-expanse', name: 'Shattered Expanse', width: 22, depth: 14, pathWidth: 1.5,
  navigationMode: 'open',
  paths: [
    [{ x: -10.8, z: -4.7 }, { x: 10.4, z: 0 }],
    [{ x: -10.8, z: 0 }, { x: 10.4, z: 0 }],
    [{ x: -10.8, z: 4.7 }, { x: 10.4, z: 0 }],
  ],
  solidPolygons: [
    { kind: 'platform', points: [{ x: -7.8, z: -5.4 }, { x: -5.2, z: -5.4 }, { x: -4.8, z: -3.4 }, { x: -7.5, z: -3.1 }] },
    { kind: 'platform', points: [{ x: -7.1, z: -1.7 }, { x: -4.8, z: -1.7 }, { x: -4.5, z: 0.6 }, { x: -7.3, z: 0.8 }] },
    { kind: 'platform', points: [{ x: -7.6, z: 2.5 }, { x: -5.1, z: 2.2 }, { x: -4.8, z: 4.5 }, { x: -7.2, z: 5.2 }] },
    { kind: 'platform', points: [{ x: -2.8, z: -4.9 }, { x: -0.4, z: -5.1 }, { x: 0, z: -2.8 }, { x: -2.6, z: -2.6 }] },
    { kind: 'platform', points: [{ x: -2.2, z: -0.9 }, { x: 0.3, z: -1.1 }, { x: 0.8, z: 1 }, { x: -2.4, z: 1.3 }] },
    { kind: 'platform', points: [{ x: -2.5, z: 3 }, { x: 0.2, z: 2.6 }, { x: 0.5, z: 5.1 }, { x: -2.1, z: 5.3 }] },
    { kind: 'platform', points: [{ x: 2.5, z: -3.8 }, { x: 4.5, z: -4.4 }, { x: 5.2, z: -2.1 }, { x: 2.8, z: -1.8 }] },
    { kind: 'platform', points: [{ x: 2.8, z: 1.7 }, { x: 5, z: 1.5 }, { x: 5.3, z: 4.1 }, { x: 2.5, z: 4.5 }] },
    { kind: 'platform', points: [{ x: 6.7, z: -5.3 }, { x: 8.8, z: -5 }, { x: 9, z: -3.2 }, { x: 6.5, z: -3.1 }] },
    { kind: 'blocker', points: [{ x: 6.2, z: 0.5 }, { x: 7.2, z: -0.3 }, { x: 8, z: 0.5 }, { x: 7.1, z: 1.3 }] },
  ],
  palette: { ground: '#21363b', path: '#468e91', background: '#0b151c', rock: '#627078' },
}

export const BUILT_IN_MAPS: readonly MapDefinition[] = [GREEN_MARCH, TWIN_FORK, FROZEN_PASS, ASH_FIELDS, BROKEN_CITADEL, SHATTERED_EXPANSE]
export const DEFAULT_MAP = GREEN_MARCH

export function findBuiltInMap(id: string): MapDefinition | undefined {
  return BUILT_IN_MAPS.find((map) => map.id === id)
}
