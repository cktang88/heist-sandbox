/**
 * Every kind of object that can dress a room. This is the shared contract between
 * the code that furnishes rooms, the game rules (cover, fire, explosions) and the
 * code that draws them.
 *
 * - `w`, `h`: footprint in tiles (h is height above the floor, or size on the wall).
 * - `cover`: 'low' stops shots aimed at a crouching body, 'high' also hides a standing one.
 * - `mount`: stands on the floor, hangs on the back wall, or hangs from the ceiling.
 *   Wall and ceiling items never block movement or shots.
 * - `burns`: can catch fire and feed it.
 * - `hp`: damage it takes before it breaks. Infinity means it cannot be destroyed.
 * - `reacts`: special behaviour when shot or burnt.
 */
export type PropSpec = {
  w: number
  h: number
  cover: 'none' | 'low' | 'high'
  mount: 'floor' | 'wall' | 'ceiling'
  burns: boolean
  hp: number
  set: 'office' | 'living' | 'industrial' | 'security' | 'exterior' | 'decor'
  reacts?: 'explodes' | 'sprays' | 'gas' | 'sparks'
}

const spec = (
  set: PropSpec['set'], w: number, h: number, cover: PropSpec['cover'] = 'none', mount: PropSpec['mount'] = 'floor',
  burns = false, hp = 60, reacts?: PropSpec['reacts'],
): PropSpec => ({ set, w, h, cover, mount, burns, hp, reacts })

const INF = Number.POSITIVE_INFINITY

export const PROP_CATALOG = {
  // --- Office ---
  desk: spec('office', 2, 1.5, 'low', 'floor', true),
  deskCorner: spec('office', 3, 1.5, 'low', 'floor', true),
  executiveDesk: spec('office', 3, 1.3, 'low', 'floor', true, 90),
  receptionDesk: spec('office', 5, 1.3, 'low', 'floor', true, 120),
  officeChair: spec('office', 0.8, 1.2, 'none', 'floor', true, 20),
  filingCabinet: spec('office', 1, 1.9, 'high', 'floor', false, 110),
  bookshelf: spec('office', 2, 2.6, 'high', 'floor', true, 70),
  printer: spec('office', 1.2, 1.3, 'low', 'floor', false, 40),
  waterCooler: spec('office', 0.7, 1.6, 'none', 'floor', false, 20),
  plant: spec('office', 0.8, 1.5, 'none', 'floor', true, 15),
  plantTall: spec('office', 1, 2.4, 'none', 'floor', true, 15),
  sofa: spec('office', 3, 1.1, 'low', 'floor', true, 70),
  armchair: spec('office', 1.3, 1.1, 'low', 'floor', true, 40),
  coffeeTable: spec('office', 1.6, 0.6, 'none', 'floor', true, 30),
  conferenceTable: spec('office', 6, 1, 'low', 'floor', true, 120),
  partition: spec('office', 0.3, 1.9, 'high', 'floor', true, 35),
  turnstile: spec('office', 1, 1.2, 'low', 'floor', false, 150),
  kiosk: spec('office', 0.9, 1.8, 'none', 'floor', false, 40),
  bin: spec('office', 0.5, 0.7, 'none', 'floor', true, 10),
  cardboardBoxes: spec('office', 1.4, 1.1, 'low', 'floor', true, 20),
  paperStack: spec('office', 0.6, 0.3, 'none', 'floor', true, 5),
  rug: spec('office', 4, 0.05, 'none', 'floor', true, INF),
  drinksCabinet: spec('office', 1.6, 1.5, 'low', 'floor', true, 50),
  trophyCase: spec('office', 1.6, 2.2, 'high', 'floor', false, 30),
  safeSmall: spec('office', 1, 1.1, 'low', 'floor', false, INF),
  coatRack: spec('office', 0.6, 2, 'none', 'floor', true, 10),
  whiteboard: spec('office', 2.4, 1.4, 'none', 'wall', true, 10),
  wallScreen: spec('office', 2.2, 1.3, 'none', 'wall', false, 10, 'sparks'),
  logoSign: spec('office', 3, 1.2, 'none', 'wall', false, 30),
  projector: spec('office', 0.6, 0.4, 'none', 'ceiling', false, 10),

  // --- Living quarters, food and recreation ---
  bunkBed: spec('living', 2.4, 2.4, 'high', 'floor', true, 80),
  bed: spec('living', 2.6, 0.9, 'low', 'floor', true, 60),
  footlocker: spec('living', 1.2, 0.6, 'none', 'floor', false, 60),
  wallLocker: spec('living', 0.9, 2.3, 'high', 'floor', false, 120),
  lockerRow: spec('living', 3, 2.3, 'high', 'floor', false, 200),
  bench: spec('living', 2.2, 0.6, 'none', 'floor', true, 40),
  nightstand: spec('living', 0.7, 0.8, 'none', 'floor', true, 20),
  wardrobe: spec('living', 1.6, 2.5, 'high', 'floor', true, 70),
  showerStall: spec('living', 1.2, 2.6, 'high', 'floor', false, 40),
  sink: spec('living', 0.9, 1.2, 'none', 'floor', false, 50),
  toilet: spec('living', 0.8, 1, 'none', 'floor', false, 50),
  toiletStall: spec('living', 1.4, 2.5, 'high', 'floor', false, 50),
  tvStand: spec('living', 2, 1.6, 'low', 'floor', true, 30, 'sparks'),
  poolTable: spec('living', 3.4, 1.1, 'low', 'floor', true, 120),
  tableTennis: spec('living', 3.4, 1.1, 'low', 'floor', true, 50),
  arcadeCabinet: spec('living', 1, 2.3, 'high', 'floor', false, 60, 'sparks'),
  vendingMachine: spec('living', 1.3, 2.5, 'high', 'floor', false, 160, 'sparks'),
  fridge: spec('living', 1.1, 2.4, 'high', 'floor', false, 140),
  kitchenCounter: spec('living', 3, 1.2, 'low', 'floor', false, 120),
  stove: spec('living', 1.4, 1.2, 'low', 'floor', false, 100, 'gas'),
  servingCounter: spec('living', 5, 1.3, 'low', 'floor', false, 150),
  cafeteriaTable: spec('living', 3.2, 1, 'low', 'floor', true, 60),
  trayRack: spec('living', 1, 1.9, 'none', 'floor', false, 30),
  coffeeMachine: spec('living', 0.8, 1.6, 'none', 'floor', false, 30),
  treadmill: spec('living', 2, 1.5, 'low', 'floor', false, 70),
  weightRack: spec('living', 2, 1.6, 'low', 'floor', false, INF),
  benchPress: spec('living', 2, 1.3, 'low', 'floor', false, 100),
  punchingBag: spec('living', 0.6, 1.8, 'none', 'ceiling', true, 60),
  medicalBed: spec('living', 2.4, 1.1, 'low', 'floor', true, 60),
  ivStand: spec('living', 0.5, 2, 'none', 'floor', false, 10),
  medCabinet: spec('living', 1.2, 2.2, 'high', 'floor', false, 60),
  curtainScreen: spec('living', 1.8, 2.2, 'high', 'floor', true, 10),
  piano: spec('living', 2.6, 1.4, 'low', 'floor', true, 120),
  barCounter: spec('living', 4, 1.4, 'low', 'floor', true, 150),
  barStool: spec('living', 0.6, 1, 'none', 'floor', false, 20),
  fireplace: spec('living', 2.4, 1.8, 'none', 'wall', false, INF),
  rangeHood: spec('living', 2, 0.8, 'none', 'ceiling', false, 60),
  mirror: spec('living', 1.4, 1.2, 'none', 'wall', false, 5),

  // --- Industrial, storage, labs and servers ---
  crate: spec('industrial', 1.2, 1.1, 'low', 'floor', true, 60),
  crateStack: spec('industrial', 2.2, 2.2, 'high', 'floor', true, 120),
  steelCrate: spec('industrial', 1.4, 1.2, 'low', 'floor', false, 300),
  barrel: spec('industrial', 0.9, 1.3, 'low', 'floor', false, 90),
  explosiveBarrel: spec('industrial', 0.9, 1.3, 'low', 'floor', true, 25, 'explodes'),
  gasCylinder: spec('industrial', 0.5, 1.6, 'none', 'floor', false, 20, 'explodes'),
  pallet: spec('industrial', 1.6, 0.25, 'none', 'floor', true, 20),
  palletStack: spec('industrial', 1.8, 1.6, 'low', 'floor', true, 90),
  forklift: spec('industrial', 2.6, 2.4, 'high', 'floor', false, 400),
  shelvingRack: spec('industrial', 2.4, 3, 'high', 'floor', false, 120),
  toolBench: spec('industrial', 2.6, 1.3, 'low', 'floor', true, 90),
  toolChest: spec('industrial', 1.1, 1.3, 'low', 'floor', false, 120),
  generator: spec('industrial', 3, 2, 'high', 'floor', false, 300, 'explodes'),
  transformer: spec('industrial', 2, 2.4, 'high', 'floor', false, 300, 'sparks'),
  switchgear: spec('industrial', 2.4, 2.6, 'high', 'floor', false, 250, 'sparks'),
  boiler: spec('industrial', 2.2, 3, 'high', 'floor', false, 400, 'explodes'),
  pump: spec('industrial', 1.6, 1.2, 'low', 'floor', false, 200),
  waterTank: spec('industrial', 2.6, 3, 'high', 'floor', false, 300, 'sprays'),
  hvacUnit: spec('industrial', 3, 1.8, 'high', 'floor', false, 300),
  cableReel: spec('industrial', 1.4, 1.4, 'low', 'floor', true, 60),
  mopBucket: spec('industrial', 0.7, 1.3, 'none', 'floor', false, 10),
  wetFloorSign: spec('industrial', 0.5, 0.8, 'none', 'floor', false, 5),
  stepLadder: spec('industrial', 1, 2, 'none', 'floor', false, 20),
  workLight: spec('industrial', 0.8, 1.8, 'none', 'floor', false, 10, 'sparks'),
  car: spec('industrial', 4.6, 1.6, 'high', 'floor', true, 300, 'explodes'),
  van: spec('industrial', 5.6, 2.4, 'high', 'floor', true, 400, 'explodes'),
  truck: spec('industrial', 7, 3.2, 'high', 'floor', true, 600, 'explodes'),
  dumpster: spec('industrial', 2.6, 1.6, 'high', 'floor', true, 400),
  tireStack: spec('industrial', 1, 1.4, 'low', 'floor', true, 80),
  labBench: spec('industrial', 3, 1.3, 'low', 'floor', false, 120),
  fumeHood: spec('industrial', 2, 2.8, 'high', 'floor', false, 100, 'gas'),
  centrifuge: spec('industrial', 0.9, 1.2, 'low', 'floor', false, 50),
  specimenTank: spec('industrial', 1.2, 2.6, 'high', 'floor', false, 30, 'sprays'),
  serverRack: spec('industrial', 1.1, 2.5, 'high', 'floor', false, 120, 'sparks'),
  coolingUnit: spec('industrial', 1.6, 2.6, 'high', 'floor', false, 200),
  consoleCart: spec('industrial', 1.2, 1.4, 'low', 'floor', false, 40, 'sparks'),
  archiveShelf: spec('industrial', 2.2, 2.8, 'high', 'floor', true, 80),
  toolWall: spec('industrial', 2.4, 1.4, 'none', 'wall', false, 20),

  // --- Security, armoury, cells and vault ---
  securityDesk: spec('security', 4, 1.4, 'low', 'floor', false, 200, 'sparks'),
  monitorWall: spec('security', 4, 1.8, 'none', 'wall', false, 20, 'sparks'),
  radioStation: spec('security', 1.6, 1.5, 'low', 'floor', false, 60, 'sparks'),
  weaponRack: spec('security', 2.2, 2.2, 'high', 'floor', false, 150),
  ammoLocker: spec('security', 1.4, 2.2, 'high', 'floor', false, 200, 'explodes'),
  gunCage: spec('security', 3, 2.8, 'high', 'floor', false, 300),
  riotShields: spec('security', 1.6, 1.6, 'low', 'floor', false, 200),
  sandbags: spec('security', 2.4, 1.1, 'low', 'floor', false, 400),
  barricade: spec('security', 2, 1.2, 'low', 'floor', false, 250),
  metalDetector: spec('security', 1.2, 2.5, 'none', 'floor', false, 60),
  cellBars: spec('security', 0.3, 4, 'none', 'floor', false, 400),
  cellBench: spec('security', 2.2, 0.6, 'none', 'floor', false, INF),
  depositBoxes: spec('security', 3, 2.8, 'none', 'wall', false, INF),
  vaultShelves: spec('security', 2.4, 2.6, 'high', 'floor', false, INF),
  gold: spec('security', 1.2, 0.5, 'none', 'floor', false, INF),
  goldPallet: spec('security', 1.8, 1.1, 'low', 'floor', false, INF),
  cashPallet: spec('security', 1.8, 1.1, 'low', 'floor', true, 80),
  safeLarge: spec('security', 1.8, 2.2, 'high', 'floor', false, INF),
  keyBox: spec('security', 0.6, 0.7, 'none', 'wall', false, 20),

  // --- Exterior, roof and perimeter ---
  antenna: spec('exterior', 0.6, 5, 'none', 'floor', false, 60),
  satelliteDish: spec('exterior', 2.2, 2.2, 'low', 'floor', false, 80),
  roofAcUnit: spec('exterior', 2.4, 1.5, 'high', 'floor', false, 300),
  roofVent: spec('exterior', 1, 1, 'low', 'floor', false, 100),
  roofWaterTank: spec('exterior', 3, 3.4, 'high', 'floor', false, 300, 'sprays'),
  helipadLight: spec('exterior', 0.3, 0.3, 'none', 'floor', false, 5),
  billboard: spec('exterior', 6, 3, 'none', 'wall', false, 60),
  bollard: spec('exterior', 0.4, 1, 'low', 'floor', false, INF),
  jerseyBarrier: spec('exterior', 2.4, 1.1, 'low', 'floor', false, INF),
  fireHydrant: spec('exterior', 0.5, 0.9, 'none', 'floor', false, 80, 'sprays'),
  powerBox: spec('exterior', 1, 1.6, 'low', 'floor', false, 100, 'sparks'),
  streetSign: spec('exterior', 0.3, 2.6, 'none', 'floor', false, 20),
  flagPole: spec('exterior', 0.3, 6, 'none', 'floor', false, 100),
  guardBooth: spec('exterior', 2.4, 2.8, 'high', 'floor', false, 300),
  razorCoil: spec('exterior', 2, 0.7, 'none', 'floor', false, 60),

  // --- Small wall and ceiling details ---
  poster: spec('decor', 1, 1.4, 'none', 'wall', true, 5),
  posterTorn: spec('decor', 1, 1.4, 'none', 'wall', true, 5),
  graffiti: spec('decor', 2.4, 1.4, 'none', 'wall', false, INF),
  noticeBoard: spec('decor', 1.6, 1.2, 'none', 'wall', true, 10),
  picture: spec('decor', 1.2, 1, 'none', 'wall', true, 5),
  artLarge: spec('decor', 2.6, 1.6, 'none', 'wall', true, 10),
  wallClock: spec('decor', 0.6, 0.6, 'none', 'wall', false, 5),
  ventGrille: spec('decor', 1, 0.6, 'none', 'wall', false, 20),
  pipeRun: spec('decor', 6, 0.5, 'none', 'wall', false, INF),
  conduitRun: spec('decor', 5, 0.3, 'none', 'wall', false, INF),
  wallAc: spec('decor', 1.4, 0.7, 'none', 'wall', false, 30),
  intercom: spec('decor', 0.4, 0.5, 'none', 'wall', false, 10),
  lightSwitch: spec('decor', 0.25, 0.3, 'none', 'wall', false, 10),
  fireExtinguisher: spec('decor', 0.4, 0.8, 'none', 'wall', false, 10, 'sprays'),
  fireAlarmPull: spec('decor', 0.3, 0.3, 'none', 'wall', false, 10),
  exitSign: spec('decor', 0.9, 0.35, 'none', 'wall', false, 10),
  neonSign: spec('decor', 2.4, 0.9, 'none', 'wall', false, 10, 'sparks'),
  roomNumber: spec('decor', 0.6, 0.4, 'none', 'wall', false, INF),
  hazardStripe: spec('decor', 3, 0.4, 'none', 'wall', false, INF),
  stain: spec('decor', 1.8, 1.6, 'none', 'wall', false, INF),
  window: spec('decor', 3, 2.2, 'none', 'wall', false, INF),
  windowBlinds: spec('decor', 3, 2.2, 'none', 'wall', true, INF),
  shelfWall: spec('decor', 2, 0.5, 'none', 'wall', true, 20),
  cableBundle: spec('decor', 5, 0.4, 'none', 'ceiling', true, INF),
  ceilingDuct: spec('decor', 6, 0.6, 'none', 'ceiling', false, INF),
  sprinkler: spec('decor', 0.2, 0.2, 'none', 'ceiling', false, INF, 'sprays'),
  smokeDetector: spec('decor', 0.3, 0.15, 'none', 'ceiling', false, 5),
  speaker: spec('decor', 0.5, 0.4, 'none', 'ceiling', false, 10),
  ceilingFan: spec('decor', 2, 0.5, 'none', 'ceiling', false, 20),
} as const satisfies Record<string, PropSpec>

export type PropKind = keyof typeof PROP_CATALOG

export function propSpec(kind: PropKind): PropSpec {
  return PROP_CATALOG[kind]
}

export const PROP_KINDS = Object.keys(PROP_CATALOG) as PropKind[]
