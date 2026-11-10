import type { PropKind } from '../propCatalog'
import { LIGHT, type FixtureKind, type RoomKind } from '../site'

const AMBER = 0xffb000
const VIOLET = 0x8a5cff

type Glow = { fixture: FixtureKind | readonly FixtureKind[]; color: number | readonly number[]; strength: number; radius: number }

/**
 * One layer of a room's lighting, after the lighting rules in docs/REFERENCES.md: an ambient layer
 * from the ceiling, task and accent light from lamps on and beside the furniture, and coloured accents.
 * - 'ceiling': fittings spread along the ceiling, one per `gap` tiles; `flicker` is the chance one tube is failing.
 * - 'wall': fittings on the back wall, one per `per` tiles, `up` tiles above the floor.
 * - 'host': a lamp for some of the props of the listed kinds: standing `on` it, `beside` it on the floor,
 *   hung `above` it, on `top` of it, or glowing from the `centre` of a wall item.
 * Where a field lists several fittings or colours, each room picks one.
 */
export type LightLayer =
  | (Glow & { at: 'ceiling'; gap: number; flicker?: number })
  | (Glow & { at: 'wall'; per: number; up: number })
  | (Glow & { at: 'host'; hosts: readonly PropKind[]; odds: number; place: 'on' | 'beside' | 'above' | 'top' | 'centre'; max?: number })

const deskLamps = (odds: number, max = 3): LightLayer => ({
  at: 'host', hosts: ['desk', 'deskCorner', 'executiveDesk', 'securityDesk', 'receptionDesk'], place: 'on', odds, max,
  fixture: 'deskLamp', color: LIGHT.lamp, strength: 0.4, radius: 4,
})
const floorLamps = (odds: number): LightLayer => ({
  at: 'host', hosts: ['sofa', 'armchair', 'bed', 'piano'], place: 'beside', odds, max: 3, fixture: 'floorLamp', color: LIGHT.lamp, strength: 0.5, radius: 5,
})
const tableLamps = (odds: number): LightLayer => ({
  at: 'host', hosts: ['nightstand', 'drinksCabinet', 'coffeeTable', 'footlocker'], place: 'on', odds, max: 3, fixture: 'tableLamp', color: LIGHT.lamp, strength: 0.35, radius: 4,
})
const neon = (odds: number): LightLayer => ({
  at: 'host', hosts: ['neonSign'], place: 'centre', odds, max: 2, fixture: 'neon', color: [LIGHT.magenta, LIGHT.cyan, VIOLET, AMBER], strength: 0.5, radius: 6,
})
const workLights: LightLayer = {
  at: 'host', hosts: ['workLight'], place: 'top', odds: 1, max: 3, fixture: 'workLight', color: LIGHT.warm, strength: 0.6, radius: 6,
}
const exitGlow = (per: number): LightLayer => ({ at: 'wall', per, up: 4.2, fixture: 'emergency', color: LIGHT.green, strength: 0.25, radius: 4 })
const redBeacon = (per: number): LightLayer => ({ at: 'wall', per, up: 3.8, fixture: 'emergency', color: LIGHT.red, strength: 0.3, radius: 4 })

const tubes = (color: number, strength: number, gap: number, flicker = 0.2): LightLayer => ({
  at: 'ceiling', gap, flicker, fixture: 'fluorescentTube', color, strength, radius: 8,
})

export const ROOM_LIGHTING: Record<RoomKind, readonly LightLayer[]> = {
  lobby: [
    { at: 'ceiling', gap: 5, fixture: ['downlight', 'pendant'], color: LIGHT.warm, strength: 0.8, radius: 8 },
    { at: 'wall', per: 9, up: 3, fixture: 'wallSconce', color: LIGHT.lamp, strength: 0.4, radius: 5 },
    floorLamps(0.4), deskLamps(1, 1),
  ],
  office: [
    { at: 'ceiling', gap: 6, flicker: 0.25, fixture: ['fluorescentTube', 'ceilingPanel'], color: LIGHT.office, strength: 0.8, radius: 8 },
    deskLamps(0.45),
  ],
  executive: [
    { at: 'ceiling', gap: 9, fixture: 'downlight', color: LIGHT.warm, strength: 0.4, radius: 6 },
    { at: 'wall', per: 10, up: 3, fixture: 'wallSconce', color: LIGHT.lamp, strength: 0.35, radius: 5 },
    deskLamps(1, 1), floorLamps(0.8), tableLamps(0.6),
  ],
  conference: [
    { at: 'ceiling', gap: 5, fixture: 'downlight', color: LIGHT.office, strength: 0.7, radius: 7 },
    { at: 'host', hosts: ['conferenceTable'], place: 'above', odds: 0.6, max: 1, fixture: 'pendant', color: LIGHT.warm, strength: 0.5, radius: 6 },
  ],
  breakRoom: [{ at: 'ceiling', gap: 8, flicker: 0.3, fixture: 'ceilingPanel', color: LIGHT.office, strength: 0.8, radius: 8 }, floorLamps(0.3)],
  cafeteria: [tubes(LIGHT.sterile, 0.9, 5, 0.15), neon(0.7)],
  kitchen: [tubes(LIGHT.office, 1, 5, 0.15)],
  restroom: [tubes(LIGHT.sterile, 0.8, 7, 0.4)],
  lockers: [tubes(LIGHT.office, 0.8, 7, 0.25)],
  barracks: [
    { at: 'ceiling', gap: 12, fixture: 'bareBulb', color: LIGHT.warm, strength: 0.45, radius: 6 },
    tableLamps(0.7), redBeacon(30),
  ],
  lounge: [
    { at: 'ceiling', gap: 7, fixture: 'pendant', color: LIGHT.lamp, strength: 0.5, radius: 6 },
    neon(1), floorLamps(0.7), tableLamps(0.4),
  ],
  gym: [tubes(LIGHT.sterile, 1, 5, 0.15)],
  infirmary: [
    { at: 'ceiling', gap: 6, fixture: 'ceilingPanel', color: LIGHT.sterile, strength: 1, radius: 8 },
    { at: 'host', hosts: ['medicalBed'], place: 'above', odds: 0.7, max: 2, fixture: 'downlight', color: 0xffffff, strength: 0.6, radius: 5 },
  ],
  lab: [{ at: 'ceiling', gap: 6, flicker: 0.1, fixture: 'ceilingPanel', color: LIGHT.sterile, strength: 1.1, radius: 8 }],
  server: [tubes(LIGHT.cyan, 0.5, 8, 0.3), redBeacon(20)],
  security: [
    { at: 'ceiling', gap: 8, fixture: 'downlight', color: LIGHT.office, strength: 0.4, radius: 6 },
    deskLamps(1, 2),
  ],
  armory: [tubes(LIGHT.office, 0.9, 6, 0.15)],
  cells: [{ at: 'ceiling', gap: 7, flicker: 0.35, fixture: 'ceilingPanel', color: LIGHT.sterile, strength: 0.7, radius: 7 }],
  archive: [tubes(LIGHT.office, 0.6, 9, 0.3)],
  janitor: [{ at: 'ceiling', gap: 40, flicker: 0.3, fixture: 'bareBulb', color: LIGHT.warm, strength: 0.6, radius: 6 }],
  mechanical: [{ at: 'ceiling', gap: 13, fixture: ['bareBulb', 'pendant'], color: LIGHT.sodium, strength: 0.6, radius: 7 }, workLights, redBeacon(25)],
  electrical: [tubes(LIGHT.office, 0.6, 12, 0.35), redBeacon(15), workLights],
  storage: [tubes(LIGHT.office, 0.6, 10, 0.25)],
  loadingDock: [
    { at: 'ceiling', gap: 8, fixture: 'pendant', color: LIGHT.sodium, strength: 1, radius: 9 },
    { at: 'wall', per: 14, up: 3.6, fixture: 'workLight', color: AMBER, strength: 0.4, radius: 5 },
  ],
  garage: [tubes(LIGHT.sodium, 0.6, 10, 0.4), exitGlow(25)],
  stairwell: [
    { at: 'ceiling', gap: 30, flicker: 0.15, fixture: ['fluorescentTube', 'bareBulb'], color: LIGHT.office, strength: 0.6, radius: 7 },
    exitGlow(30),
  ],
  elevatorLobby: [{ at: 'ceiling', gap: 5, fixture: 'downlight', color: LIGHT.office, strength: 0.8, radius: 7 }],
  vault: [{ at: 'ceiling', gap: 6, fixture: 'ceilingPanel', color: LIGHT.sterile, strength: 1, radius: 8 }, redBeacon(30)],
  penthouse: [
    { at: 'ceiling', gap: 40, fixture: 'chandelier', color: LIGHT.lamp, strength: 0.7, radius: 9 },
    { at: 'wall', per: 9, up: 3, fixture: 'wallSconce', color: LIGHT.lamp, strength: 0.35, radius: 5 },
    floorLamps(0.8), tableLamps(0.8),
  ],
  workshop: [
    tubes(LIGHT.office, 0.9, 6, 0.25),
    { at: 'host', hosts: ['toolBench'], place: 'on', odds: 0.6, max: 2, fixture: 'deskLamp', color: LIGHT.warm, strength: 0.45, radius: 4 },
    workLights,
  ],
  silo: [
    { at: 'ceiling', gap: 40, fixture: 'bareBulb', color: LIGHT.sodium, strength: 0.7, radius: 9 },
    { at: 'wall', per: 20, up: 3, fixture: 'workLight', color: LIGHT.sodium, strength: 0.5, radius: 6 },
    { at: 'wall', per: 20, up: 10, fixture: 'bareBulb', color: LIGHT.sodium, strength: 0.5, radius: 6 },
    { at: 'wall', per: 20, up: 17, fixture: 'bareBulb', color: LIGHT.sodium, strength: 0.5, radius: 6 },
  ],
  gatehouse: [tubes(LIGHT.office, 0.8, 20, 0.2), deskLamps(1, 1)],
  sewer: [
    { at: 'ceiling', gap: 24, flicker: 0.5, fixture: 'bareBulb', color: LIGHT.green, strength: 0.5, radius: 7 },
    redBeacon(70),
  ],
  street: [],
  yard: [workLights],
  rooftop: [
    { at: 'host', hosts: ['antenna'], place: 'top', odds: 1, max: 4, fixture: 'emergency', color: LIGHT.red, strength: 0.4, radius: 4 },
    { at: 'host', hosts: ['helipadLight'], place: 'top', odds: 0.5, max: 4, fixture: 'emergency', color: AMBER, strength: 0.3, radius: 3 },
  ],
}
