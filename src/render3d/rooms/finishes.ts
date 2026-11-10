import type { RoomKind } from '../../game/site'
import type { PhotoSpec } from './photoMaterials'

/**
 * What each kind of room is finished with: wall bands, trims, floor, ceiling and windows.
 * Colours are display hex values; each surface lists a few and a room picks one by its id,
 * so the offices on one floor are not painted the same as the floor below.
 * Sources for the choices: docs/REFERENCES.md section 2 and docs/research/environment-art.md section 3.
 */

/** `scale` is how many tiles one copy of the photo covers. */
export type Surface = { photo: PhotoSpec; scale: number; tints: readonly number[] }

/** A wall band from the floor up to `upTo` tiles; the last band runs to the ceiling. */
export type Band = { surface: Surface; upTo?: number }

export type WallFinish = {
  bands: readonly Band[]
  skirting?: number
  /** A rail along the top of the first band (a dado rail). */
  rail?: number
  /** Yellow and black stripes along the foot of the wall. */
  hazard?: boolean
  /** Vertical joints between wall panels, every this many tiles. */
  joints?: number
  /** How dirty the wall is: 0 clean to 1 filthy (scuffs at the foot, water stains from above). */
  grime: number
}

export type FloorLines = 'bays' | 'walkway' | 'none'
export type FloorFinish = { surface: Surface; lines?: FloorLines }

export type Services = 'pipes' | 'trays' | 'ducts' | 'none'
export type CeilingFinish = { surface: Surface; services: Services; cove?: boolean }

/** Window shapes on the back wall. A room picks one of the listed options by its id. */
export type Glazing = 'band' | 'punched' | 'tall' | 'curtain' | 'high' | 'louvre' | 'none'

export type Extra = 'cableTray' | 'conduit' | 'logo' | 'stencil' | 'shutter' | 'mirror'

export type Finish = {
  wall: WallFinish
  floor: FloorFinish
  ceiling: CeilingFinish
  glazing: readonly Glazing[]
  /** Odds that a window has its blinds part way down. */
  blinds: number
  extras: readonly Extra[]
}

const s = (set: PhotoSpec['set'], scale: number, rough: number, tints: readonly number[], metal = 0): Surface => ({
  photo: { set, rough, metal }, scale, tints,
})

// Walls
const paint = (tints: readonly number[]) => s('painted_plaster_wall', 4, 0.85, tints)
const block = (tints: readonly number[]) => s('painted_brick', 2.2, 0.8, tints)
const wallTile = (tints: readonly number[]) => s('ceramic', 1.8, 0.3, tints)
const panelling = s('dark_paneled_wood', 2.4, 0.55, [0xc8b8a8, 0xa89080, 0xe0c8b0])
const wallpaper = s('decrepit_wallpaper', 3, 0.8, [0x6a7a5a, 0x7a4a48, 0x4a5a6a, 0x8a7a5a])
const stone = s('terrazzo_tiles', 2.5, 0.3, [0xd8d0c4, 0xc0b8b0, 0xb8b4ac])
const rawConcrete = s('old/concrete', 4, 0.9, [0xb0b0b0, 0x9a9890, 0xa8aab0])
const boardFormed = s('preconcrete_wall_001', 3, 0.9, [0x8a8a86, 0x9a948a, 0x7a7e84])
const brick = s('red_brick_03', 2.6, 0.85, [0xffffff, 0xd8c8c0, 0xb8b0a8])
const wetBrick = s('red_brick_03', 2.6, 0.3, [0x5a6a58, 0x4a5448])
const steelPlate = s('old/steel', 3, 0.45, [0xb0b8c0, 0x98a0a8], 1)
const rustyPaint = s('rusty_painted_metal', 3, 0.7, [0x7a8a8a, 0x6a7a8a, 0x8a8a7a])
const corrugated = s('corrugated_iron', 2.5, 0.6, [0xa8b0b0, 0x90a0a8], 0.6)
const siloSteel = s('rusty_metal_02', 4, 0.7, [0x9a9a9a, 0x8a8a8a], 0.5)

// Floors
const carpet = s('Carpet012', 3, 0.95, [0xffffff, 0xb0c0b0, 0xc8b8a8, 0x9098a8])
const oldCarpet = s('dirty_carpet', 3, 0.95, [0xffffff, 0xc0a890, 0x9aa0a8])
const parquet = s('herringbone_parquet', 2.5, 0.45, [0xffffff, 0xc8a888, 0x9a7a60])
const laminate = s('laminate_floor_02', 3, 0.5, [0xffffff, 0xb89878, 0xd0c0b0])
const marble = s('marble_tiles', 3, 0.25, [0xffffff, 0xd8d0c8])
const checker = s('floor_tiles_06', 2, 0.35, [0xffffff, 0xd0d8d8, 0xe0d8c8])
const lino = s('old_linoleum_flooring_01', 2.5, 0.6, [0xffffff, 0xb8c8b0, 0xa8b8c8, 0xd0b8a8])
const epoxy = s('garage_floor', 4, 0.35, [0xb8c4cc, 0xc8ccc8, 0x9aa8b4])
const garageFloor = s('garage_floor', 4, 0.8, [0xffffff, 0xd0d0d0])
const wornConcrete = s('concrete_floor_worn_001', 4, 0.85, [0xffffff, 0xd8d4cc, 0xc0c4c8])
const diamond = s('DiamondPlate001', 1.6, 0.4, [0xc8ccd0], 1)
const raised = s('OfficeCeiling001', 2, 0.6, [0x8a9098, 0x9aa0a8])
const rubber = s('concrete_floor_worn_001', 4, 0.95, [0x4a4c50, 0x3a3e44])

// Ceilings
const acoustic = s('OfficeCeiling001', 2.2, 0.9, [0xe8e8e0, 0xd8d8d0, 0xc8c8c0])
const smooth = s('painted_plaster_wall', 4, 0.9, [0xe8e4dc, 0xd8d4cc])
const slab = s('old/concrete', 4, 0.95, [0x9a9a9a, 0x8a8a88])
const vault = s('old/brick', 2.6, 0.5, [0x5a6050])

const SKIRT = 0x2a2826
const RAIL = 0x4a4844

const office: Finish = {
  wall: { bands: [{ surface: paint([0x6b7a86, 0x6f7d6a, 0x8a7d6a, 0x5a6470]), upTo: 1 }, { surface: paint([0xd9d6cc, 0xcfd8d4, 0xd8d0c0, 0xc8ccd4]) }], skirting: SKIRT, rail: RAIL, grime: 0.3 },
  floor: { surface: carpet },
  ceiling: { surface: acoustic, services: 'none' },
  glazing: ['band', 'punched', 'tall', 'none'], blinds: 0.5, extras: ['conduit'],
}

const FINISHES: Record<Exclude<RoomKind, 'street' | 'yard' | 'rooftop'>, Finish> = {
  office,
  conference: {
    wall: { bands: [{ surface: panelling, upTo: 1.1 }, { surface: paint([0xc8c0b4, 0xb8c0c4, 0xd0c8bc]) }], skirting: SKIRT, rail: 0x3a2a20, grime: 0.15 },
    floor: { surface: carpet }, ceiling: { surface: acoustic, services: 'none' }, glazing: ['tall', 'punched'], blinds: 0.6, extras: [],
  },
  executive: {
    wall: { bands: [{ surface: panelling, upTo: 2.2 }, { surface: wallpaper }], skirting: 0x1a1210, rail: 0x3a2418, grime: 0.05 },
    floor: { surface: parquet }, ceiling: { surface: smooth, services: 'none', cove: true }, glazing: ['tall', 'curtain'], blinds: 0.5, extras: [],
  },
  penthouse: {
    wall: { bands: [{ surface: panelling, upTo: 0.9 }, { surface: paint([0xe8e0d0, 0xd8d0c4]) }], skirting: 0x1a1210, rail: 0x3a2418, grime: 0 },
    floor: { surface: marble }, ceiling: { surface: smooth, services: 'none', cove: true }, glazing: ['curtain'], blinds: 0.2, extras: [],
  },
  lobby: {
    wall: { bands: [{ surface: stone }], joints: 2.5, skirting: 0x1c1c1c, grime: 0.1 },
    floor: { surface: marble }, ceiling: { surface: smooth, services: 'none', cove: true }, glazing: ['curtain'], blinds: 0, extras: ['logo'],
  },
  elevatorLobby: {
    wall: { bands: [{ surface: stone, upTo: 3 }, { surface: steelPlate }], joints: 2, skirting: 0x1c1c1c, grime: 0.1 },
    floor: { surface: marble }, ceiling: { surface: smooth, services: 'none' }, glazing: ['none'], blinds: 0, extras: [],
  },
  breakRoom: {
    wall: { bands: [{ surface: wallTile([0xffffff, 0xd8e8e0, 0xe8e0c8]), upTo: 1.3 }, { surface: s('yellow_plaster', 4, 0.85, [0xffffff, 0xd8e0c8, 0xe0c8b0]) }], rail: 0x6a6a64, grime: 0.45 },
    floor: { surface: lino }, ceiling: { surface: acoustic, services: 'none' }, glazing: ['punched', 'band'], blinds: 0.3, extras: [],
  },
  cafeteria: {
    wall: { bands: [{ surface: wallTile([0xffffff, 0xe0e8d8]), upTo: 1.6 }, { surface: paint([0xe0d8b8, 0xc8d8c8, 0xd8c8b0]) }], rail: 0x7a6a50, grime: 0.35 },
    floor: { surface: lino }, ceiling: { surface: acoustic, services: 'none' }, glazing: ['curtain', 'tall'], blinds: 0.2, extras: [],
  },
  kitchen: {
    wall: { bands: [{ surface: wallTile([0xffffff, 0xe8f0f0]) }], skirting: 0x9a9a9a, grime: 0.5 },
    floor: { surface: checker }, ceiling: { surface: smooth, services: 'ducts' }, glazing: ['high', 'punched'], blinds: 0, extras: [],
  },
  restroom: {
    wall: { bands: [{ surface: wallTile([0xffffff, 0xd8e8f0, 0xd8f0e0, 0xf0e8d8]) }], grime: 0.45 },
    floor: { surface: checker }, ceiling: { surface: acoustic, services: 'none' }, glazing: ['high'], blinds: 0, extras: ['mirror'],
  },
  lockers: {
    wall: { bands: [{ surface: wallTile([0xd8e0e8, 0xffffff]), upTo: 1.5 }, { surface: block([0xc8ccc0, 0xb8c4c8]) }], grime: 0.5 },
    floor: { surface: checker }, ceiling: { surface: slab, services: 'pipes' }, glazing: ['high'], blinds: 0, extras: [],
  },
  infirmary: {
    wall: { bands: [{ surface: wallTile([0xffffff]), upTo: 1.2 }, { surface: paint([0xd0e4d8, 0xd8e4ec]) }], rail: 0x8aa0a0, grime: 0.1 },
    floor: { surface: s('old_linoleum_flooring_01', 2.5, 0.4, [0xc8d8d0, 0xd0d8e0]) }, ceiling: { surface: acoustic, services: 'none' }, glazing: ['punched'], blinds: 0.7, extras: [],
  },
  lab: {
    wall: { bands: [{ surface: paint([0xe8ecec, 0xe0e8ec, 0xf0f0e8]) }], joints: 2, skirting: 0x6a7480, grime: 0.05 },
    floor: { surface: epoxy }, ceiling: { surface: acoustic, services: 'trays' }, glazing: ['high', 'none'], blinds: 0.4, extras: ['cableTray'],
  },
  server: {
    wall: { bands: [{ surface: paint([0xc0c8d0, 0xb8c0c4]) }], joints: 2, skirting: 0x2a3038, grime: 0.05 },
    floor: { surface: raised }, ceiling: { surface: slab, services: 'trays' }, glazing: ['none'], blinds: 0, extras: ['cableTray', 'conduit'],
  },
  security: {
    wall: { bands: [{ surface: block([0x3a4048, 0x343c38]), upTo: 1.2 }, { surface: block([0x58606a, 0x4c5450]) }], rail: 0x8a7a2a, grime: 0.4 },
    floor: { surface: oldCarpet }, ceiling: { surface: acoustic, services: 'none' }, glazing: ['punched', 'none'], blinds: 0.9, extras: ['conduit'],
  },
  armory: {
    wall: { bands: [{ surface: block([0x4a5040, 0x404848]) }], hazard: true, grime: 0.4 },
    floor: { surface: wornConcrete }, ceiling: { surface: slab, services: 'pipes' }, glazing: ['none'], blinds: 0, extras: ['conduit'],
  },
  cells: {
    wall: { bands: [{ surface: rawConcrete, upTo: 1.4 }, { surface: block([0x8a8c80, 0x7a7e7a]) }], grime: 0.8 },
    floor: { surface: wornConcrete }, ceiling: { surface: slab, services: 'none' }, glazing: ['high'], blinds: 0, extras: [],
  },
  barracks: {
    wall: { bands: [{ surface: block([0x6a6a50, 0x5a6458]), upTo: 1.2 }, { surface: block([0xc8c4a8, 0xb8bca8, 0xc0b8a0]) }], rail: 0x4a4a3a, grime: 0.6 },
    floor: { surface: lino }, ceiling: { surface: slab, services: 'pipes' }, glazing: ['punched'], blinds: 0.6, extras: [],
  },
  lounge: {
    wall: { bands: [{ surface: panelling, upTo: 1 }, { surface: wallpaper }], skirting: SKIRT, rail: 0x3a2a20, grime: 0.35 },
    floor: { surface: laminate }, ceiling: { surface: smooth, services: 'none', cove: true }, glazing: ['band', 'tall'], blinds: 0.5, extras: [],
  },
  gym: {
    wall: { bands: [{ surface: block([0x8a9aa8, 0xa8a8a0]), upTo: 1 }, { surface: block([0xd8d8d0, 0xc8d0d8]) }], grime: 0.4 },
    floor: { surface: rubber }, ceiling: { surface: slab, services: 'ducts' }, glazing: ['high'], blinds: 0, extras: ['mirror'],
  },
  archive: {
    wall: { bands: [{ surface: paint([0x6a7068, 0x707070]), upTo: 1 }, { surface: paint([0xb8bcb0, 0xc0c0b8]) }], skirting: SKIRT, grime: 0.5 },
    floor: { surface: wornConcrete }, ceiling: { surface: slab, services: 'pipes' }, glazing: ['high', 'none'], blinds: 0.8, extras: [],
  },
  janitor: {
    wall: { bands: [{ surface: block([0x7a8070, 0x8a8478]) }], grime: 0.9 },
    floor: { surface: wornConcrete }, ceiling: { surface: slab, services: 'pipes' }, glazing: ['none'], blinds: 0, extras: ['conduit'],
  },
  mechanical: {
    wall: { bands: [{ surface: boardFormed }], hazard: true, grime: 0.8 },
    floor: { surface: wornConcrete, lines: 'walkway' }, ceiling: { surface: slab, services: 'pipes' }, glazing: ['louvre', 'none'], blinds: 0, extras: ['conduit'],
  },
  electrical: {
    wall: { bands: [{ surface: rawConcrete }], hazard: true, grime: 0.6 },
    floor: { surface: wornConcrete, lines: 'walkway' }, ceiling: { surface: slab, services: 'trays' }, glazing: ['louvre', 'none'], blinds: 0, extras: ['cableTray', 'conduit'],
  },
  storage: {
    wall: { bands: [{ surface: brick }], grime: 0.6 },
    floor: { surface: wornConcrete }, ceiling: { surface: slab, services: 'pipes' }, glazing: ['high', 'none'], blinds: 0, extras: [],
  },
  loadingDock: {
    wall: { bands: [{ surface: rawConcrete, upTo: 1.5 }, { surface: corrugated }], hazard: true, grime: 0.8 },
    floor: { surface: garageFloor, lines: 'bays' }, ceiling: { surface: slab, services: 'ducts' }, glazing: ['none'], blinds: 0, extras: ['shutter'],
  },
  garage: {
    wall: { bands: [{ surface: rawConcrete }], hazard: true, grime: 0.7 },
    floor: { surface: garageFloor, lines: 'bays' }, ceiling: { surface: slab, services: 'pipes' }, glazing: ['none'], blinds: 0, extras: ['stencil'],
  },
  workshop: {
    wall: { bands: [{ surface: brick, upTo: 1.6 }, { surface: corrugated }], grime: 0.7 },
    floor: { surface: wornConcrete, lines: 'walkway' }, ceiling: { surface: slab, services: 'ducts' }, glazing: ['band', 'high'], blinds: 0, extras: ['conduit'],
  },
  stairwell: {
    wall: { bands: [{ surface: block([0x5a6a70, 0x6a6458, 0x506058]), upTo: 1.2 }, { surface: block([0xc8ccc4, 0xd0ccc0]) }], rail: 0x2a2a2a, grime: 0.6 },
    floor: { surface: wornConcrete }, ceiling: { surface: slab, services: 'pipes' }, glazing: ['high'], blinds: 0, extras: ['stencil'],
  },
  vault: {
    wall: { bands: [{ surface: steelPlate }], joints: 1.5, grime: 0.1 },
    floor: { surface: diamond }, ceiling: { surface: s('old/steel', 3, 0.5, [0x8a9098], 1), services: 'none' }, glazing: ['none'], blinds: 0, extras: [],
  },
  silo: {
    wall: { bands: [{ surface: siloSteel }], grime: 0.5 },
    floor: { surface: s('metal_plate', 2, 0.6, [0xa0a0a0], 0.6) }, ceiling: { surface: s('rusty_metal_02', 4, 0.7, [0x7a7a7a], 0.5), services: 'none' }, glazing: ['none'], blinds: 0, extras: [],
  },
  gatehouse: {
    wall: { bands: [{ surface: block([0x6a7058, 0x5a6268]), upTo: 1.1 }, { surface: block([0xb8b8a8]) }], rail: 0x3a3a30, grime: 0.6 },
    floor: { surface: wornConcrete }, ceiling: { surface: acoustic, services: 'none' }, glazing: ['band'], blinds: 0.3, extras: [],
  },
  sewer: {
    wall: { bands: [{ surface: wetBrick }], grime: 1 },
    floor: { surface: wornConcrete }, ceiling: { surface: vault, services: 'pipes' }, glazing: ['none'], blinds: 0, extras: [],
  },
}

/** Outdoor areas have no walls or ceiling of their own; the exterior code dresses them. */
export function finishOf(kind: RoomKind): Finish | undefined {
  return kind === 'street' || kind === 'yard' || kind === 'rooftop' ? undefined : FINISHES[kind]
}

/** Plain painted metal for things like the sky bridge, which has a back wall but no room record. */
export const CORRIDOR: Finish = {
  wall: { bands: [{ surface: rustyPaint, upTo: 1 }, { surface: paint([0xc8ccd0]) }], skirting: SKIRT, grime: 0.3 },
  floor: { surface: s('metal_plate', 2, 0.55, [0xb0b0b0], 0.6) }, ceiling: { surface: slab, services: 'none' }, glazing: ['curtain'], blinds: 0, extras: [],
}
