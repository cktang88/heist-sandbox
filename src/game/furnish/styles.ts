import type { PropKind } from '../propCatalog'
import type { RoomKind } from '../site'

/** Props that stand side by side as one group (desk, chair, bin). Mirrored as a whole when flipped. */
export type Cluster = readonly PropKind[]

/**
 * How one kind of room is dressed. Pools may list a kind more than once to make it more likely.
 * Follows the room-by-room guide in docs/research/environment-art.md.
 */
export type RoomStyle = {
  /** Always placed first, so the room reads as what it is (the radio in a security room). */
  must?: readonly Cluster[]
  /** Big signature pieces: one in a small room, more in a wide one. */
  hero: readonly Cluster[]
  /** Furniture groups that fill the rest of the floor. */
  medium: readonly Cluster[]
  /** Small floor items tucked into leftover gaps. */
  clutter: readonly PropKind[]
  wall: readonly PropKind[]
  ceiling: readonly PropKind[]
  /** Big items for high up on the wall of a double-height room. */
  tall?: readonly PropKind[]
  /** Small pieces of cover used to top up a wide room that came out too open. */
  cover: readonly PropKind[]
  /** Chance of a rug laid under the first seating group. */
  rug?: number
}

const SERVICES: readonly PropKind[] = ['ventGrille', 'fireExtinguisher', 'exitSign', 'roomNumber', 'stain', 'conduitRun']
const CEILING_SERVICES: readonly PropKind[] = ['sprinkler', 'sprinkler', 'smokeDetector', 'cableBundle', 'ceilingDuct']
const OFFICE_WALL: readonly PropKind[] = ['whiteboard', 'noticeBoard', 'poster', 'wallClock', 'picture', 'windowBlinds', 'window', 'wallAc', ...SERVICES]

export const ROOM_STYLES: Record<RoomKind, RoomStyle> = {
  lobby: {
    must: [['plantTall', 'receptionDesk', 'officeChair']],
    hero: [['turnstile', 'turnstile'], ['metalDetector', 'turnstile'], ['kiosk', 'plant']],
    medium: [['plant', 'sofa', 'coffeeTable', 'plant'], ['armchair', 'coffeeTable', 'armchair'], ['waterCooler', 'bin'], ['bench', 'plant'], ['plantTall'], ['kiosk'], ['coatRack', 'armchair']],
    clutter: ['bin', 'wetFloorSign', 'plant', 'paperStack'],
    wall: ['logoSign', 'wallScreen', 'artLarge', 'picture', 'wallClock', 'windowBlinds', 'window', 'noticeBoard', 'fireAlarmPull', 'intercom', ...SERVICES],
    ceiling: ['speaker', 'sprinkler', 'sprinkler', 'smokeDetector', 'ceilingDuct'],
    tall: ['logoSign', 'window', 'artLarge', 'wallScreen', 'neonSign', 'window'],
    cover: ['armchair', 'cardboardBoxes', 'printer'],
    rug: 0.6,
  },
  office: {
    hero: [['desk', 'officeChair', 'bin'], ['deskCorner', 'officeChair'], ['officeChair', 'desk', 'partition', 'desk', 'officeChair']],
    medium: [['desk', 'officeChair'], ['filingCabinet', 'filingCabinet'], ['printer', 'paperStack'], ['waterCooler'], ['plant'], ['partition', 'desk', 'officeChair', 'bin'], ['bookshelf'], ['cardboardBoxes'], ['coatRack'], ['filingCabinet', 'plantTall']],
    clutter: ['bin', 'paperStack', 'cardboardBoxes', 'plant', 'officeChair'],
    wall: OFFICE_WALL,
    ceiling: CEILING_SERVICES,
    cover: ['filingCabinet', 'cardboardBoxes', 'printer'],
  },
  executive: {
    must: [['executiveDesk', 'officeChair']],
    hero: [['bookshelf', 'bookshelf'], ['trophyCase'], ['sofa', 'coffeeTable', 'armchair']],
    medium: [['drinksCabinet'], ['plantTall'], ['armchair', 'coffeeTable'], ['safeSmall'], ['bookshelf'], ['coatRack'], ['plant', 'armchair']],
    clutter: ['bin', 'paperStack', 'plant'],
    wall: ['artLarge', 'picture', 'picture', 'windowBlinds', 'window', 'window', 'wallClock', 'wallScreen', 'shelfWall', 'mirror', 'ventGrille', 'fireAlarmPull'],
    ceiling: ['sprinkler', 'smokeDetector', 'speaker', 'ceilingFan'],
    cover: ['safeSmall', 'armchair', 'filingCabinet'],
    rug: 0.8,
  },
  conference: {
    must: [['officeChair', 'conferenceTable', 'officeChair']],
    hero: [['plantTall'], ['drinksCabinet']],
    medium: [['officeChair', 'officeChair'], ['plant'], ['waterCooler'], ['filingCabinet'], ['printer'], ['coatRack']],
    clutter: ['bin', 'paperStack', 'officeChair'],
    wall: ['wallScreen', 'whiteboard', 'whiteboard', 'wallClock', 'picture', 'windowBlinds', 'window', 'artLarge', 'noticeBoard', ...SERVICES],
    ceiling: ['sprinkler', 'smokeDetector', 'speaker', 'cableBundle'],
    cover: ['filingCabinet', 'printer', 'cardboardBoxes'],
  },
  breakRoom: {
    // A tap: the water the chain reactions need, and what makes it a break room.
    must: [['sink']],
    hero: [['fridge', 'kitchenCounter', 'sink'], ['vendingMachine', 'vendingMachine'], ['coffeeMachine', 'kitchenCounter']],
    medium: [['cafeteriaTable'], ['sofa', 'coffeeTable'], ['waterCooler'], ['bin', 'vendingMachine'], ['plant'], ['tvStand'], ['armchair']],
    clutter: ['bin', 'cardboardBoxes', 'paperStack', 'wetFloorSign'],
    wall: ['noticeBoard', 'noticeBoard', 'poster', 'posterTorn', 'wallClock', 'shelfWall', 'window', 'wallScreen', ...SERVICES],
    ceiling: CEILING_SERVICES,
    cover: ['cardboardBoxes', 'crate', 'armchair'],
  },
  cafeteria: {
    // The counter makes it a canteen; a tray rack beside it is dressing a narrow room can give up for a locker.
    must: [['servingCounter']],
    hero: [['cafeteriaTable', 'cafeteriaTable'], ['vendingMachine', 'vendingMachine', 'coffeeMachine']],
    medium: [['cafeteriaTable'], ['cafeteriaTable', 'bin'], ['plant'], ['waterCooler'], ['fridge'], ['trayRack']],
    clutter: ['bin', 'wetFloorSign', 'cardboardBoxes'],
    wall: ['noticeBoard', 'poster', 'wallScreen', 'wallClock', 'window', 'windowBlinds', 'neonSign', ...SERVICES],
    ceiling: ['ceilingDuct', 'sprinkler', 'sprinkler', 'smokeDetector', 'speaker', 'ceilingFan'],
    tall: ['window', 'neonSign', 'wallScreen', 'poster', 'ventGrille', 'pipeRun'],
    cover: ['crate', 'cardboardBoxes', 'barrel'],
  },
  kitchen: {
    // Gas rings, which the site's faults and the gas fittings on E look for.
    must: [['stove']],
    hero: [['stove', 'stove', 'kitchenCounter'], ['fridge', 'fridge'], ['kitchenCounter', 'sink', 'stove']],
    medium: [['trayRack'], ['shelvingRack'], ['kitchenCounter'], ['gasCylinder', 'gasCylinder'], ['fridge'], ['sink'], ['barrel'], ['cardboardBoxes', 'crate']],
    clutter: ['bin', 'mopBucket', 'wetFloorSign', 'cardboardBoxes', 'gasCylinder'],
    wall: ['shelfWall', 'shelfWall', 'noticeBoard', 'fireExtinguisher', 'fireExtinguisher', 'ventGrille', 'wallClock', 'pipeRun', 'stain', 'hazardStripe', 'posterTorn'],
    ceiling: ['ceilingDuct', 'sprinkler', 'sprinkler', 'smokeDetector', 'cableBundle'],
    cover: ['crate', 'cardboardBoxes', 'barrel'],
  },
  restroom: {
    // A stall to hide in and a tap to open, however narrow the room.
    must: [['toiletStall'], ['sink']],
    hero: [['toiletStall', 'toiletStall', 'toiletStall'], ['toiletStall', 'toiletStall']],
    medium: [['sink', 'sink'], ['sink', 'bin'], ['showerStall'], ['mopBucket'], ['toilet'], ['wallLocker']],
    clutter: ['bin', 'wetFloorSign', 'mopBucket'],
    wall: ['mirror', 'mirror', 'graffiti', 'ventGrille', 'posterTorn', 'stain', 'stain', 'wallClock', 'shelfWall', 'roomNumber'],
    ceiling: ['sprinkler', 'smokeDetector', 'ceilingDuct'],
    cover: ['wallLocker', 'cardboardBoxes', 'crate'],
  },
  lockers: {
    hero: [['lockerRow', 'lockerRow'], ['lockerRow', 'bench']],
    medium: [['bench'], ['wallLocker', 'wallLocker'], ['showerStall', 'showerStall'], ['sink'], ['lockerRow'], ['footlocker'], ['riotShields']],
    clutter: ['bin', 'footlocker', 'wetFloorSign', 'cardboardBoxes'],
    wall: ['mirror', 'noticeBoard', 'poster', 'posterTorn', 'wallClock', 'shelfWall', ...SERVICES],
    ceiling: CEILING_SERVICES,
    cover: ['wallLocker', 'cardboardBoxes', 'crate'],
  },
  barracks: {
    hero: [['bunkBed', 'footlocker'], ['footlocker', 'bunkBed'], ['bunkBed', 'nightstand', 'bunkBed']],
    medium: [['wallLocker', 'wallLocker'], ['bed', 'nightstand'], ['tvStand', 'armchair'], ['cafeteriaTable'], ['footlocker'], ['lockerRow'], ['wardrobe']],
    clutter: ['footlocker', 'bin', 'cardboardBoxes', 'paperStack'],
    wall: ['poster', 'poster', 'posterTorn', 'noticeBoard', 'picture', 'wallClock', 'shelfWall', 'graffiti', ...SERVICES],
    ceiling: ['ceilingFan', 'sprinkler', 'smokeDetector', 'cableBundle'],
    cover: ['wallLocker', 'cardboardBoxes', 'crate'],
  },
  lounge: {
    hero: [['plant', 'sofa', 'coffeeTable', 'armchair'], ['barStool', 'barCounter', 'barStool'], ['poolTable'], ['arcadeCabinet', 'arcadeCabinet']],
    medium: [['armchair', 'coffeeTable'], ['tvStand'], ['vendingMachine'], ['plantTall'], ['bookshelf'], ['tableTennis'], ['drinksCabinet'], ['sofa']],
    clutter: ['bin', 'plant', 'barStool'],
    wall: ['neonSign', 'neonSign', 'poster', 'artLarge', 'picture', 'wallScreen', 'graffiti', 'window', 'shelfWall', 'ventGrille', 'exitSign', 'wallAc'],
    ceiling: ['ceilingFan', 'sprinkler', 'smokeDetector', 'speaker'],
    tall: ['neonSign', 'artLarge', 'window', 'wallScreen', 'neonSign'],
    cover: ['armchair', 'cardboardBoxes', 'crate'],
    rug: 0.7,
  },
  gym: {
    hero: [['weightRack', 'benchPress'], ['treadmill', 'treadmill']],
    medium: [['benchPress'], ['treadmill'], ['weightRack'], ['bench'], ['waterCooler'], ['lockerRow']],
    clutter: ['bin', 'footlocker', 'waterCooler'],
    wall: ['mirror', 'mirror', 'poster', 'wallClock', 'noticeBoard', 'window', 'wallScreen', ...SERVICES],
    ceiling: ['punchingBag', 'punchingBag', 'ceilingFan', 'sprinkler', 'smokeDetector', 'speaker'],
    tall: ['window', 'poster', 'neonSign', 'pipeRun'],
    cover: ['wallLocker', 'crate', 'cardboardBoxes'],
  },
  infirmary: {
    hero: [['ivStand', 'medicalBed', 'curtainScreen'], ['medicalBed', 'ivStand']],
    medium: [['medCabinet'], ['sink'], ['consoleCart'], ['curtainScreen', 'medicalBed'], ['desk', 'officeChair'], ['medCabinet', 'bin']],
    clutter: ['bin', 'ivStand', 'cardboardBoxes'],
    wall: ['noticeBoard', 'poster', 'mirror', 'wallClock', 'shelfWall', 'wallScreen', 'intercom', ...SERVICES],
    ceiling: CEILING_SERVICES,
    cover: ['medCabinet', 'cardboardBoxes', 'consoleCart'],
  },
  lab: {
    hero: [['labBench', 'centrifuge'], ['fumeHood'], ['specimenTank', 'specimenTank']],
    medium: [['labBench'], ['gasCylinder', 'gasCylinder'], ['medCabinet'], ['consoleCart'], ['sink'], ['fridge'], ['centrifuge'], ['specimenTank']],
    clutter: ['bin', 'gasCylinder', 'cardboardBoxes'],
    wall: ['whiteboard', 'noticeBoard', 'shelfWall', 'wallScreen', 'hazardStripe', 'ventGrille', 'pipeRun', 'intercom', ...SERVICES],
    ceiling: ['ceilingDuct', 'sprinkler', 'sprinkler', 'smokeDetector', 'cableBundle'],
    tall: ['window', 'pipeRun', 'ventGrille', 'hazardStripe', 'wallScreen'],
    cover: ['centrifuge', 'steelCrate', 'cardboardBoxes'],
  },
  server: {
    must: [['serverRack']],
    hero: [['serverRack', 'serverRack', 'serverRack'], ['coolingUnit', 'serverRack', 'serverRack']],
    medium: [['serverRack', 'serverRack'], ['coolingUnit'], ['consoleCart'], ['cableReel'], ['serverRack'], ['powerBox']],
    clutter: ['cardboardBoxes', 'cableReel', 'stepLadder'],
    wall: ['conduitRun', 'conduitRun', 'hazardStripe', 'ventGrille', 'wallAc', 'fireExtinguisher', 'noticeBoard', 'roomNumber', 'exitSign'],
    ceiling: ['cableBundle', 'cableBundle', 'ceilingDuct', 'sprinkler', 'smokeDetector'],
    tall: ['conduitRun', 'pipeRun', 'ventGrille', 'hazardStripe'],
    cover: ['steelCrate', 'cardboardBoxes', 'powerBox'],
  },
  security: {
    must: [['officeChair', 'securityDesk', 'officeChair'], ['radioStation']],
    hero: [['filingCabinet', 'filingCabinet'], ['wallLocker', 'wallLocker']],
    medium: [['desk', 'officeChair'], ['coffeeMachine'], ['waterCooler'], ['riotShields'], ['filingCabinet'], ['consoleCart']],
    clutter: ['bin', 'paperStack', 'cardboardBoxes'],
    wall: ['monitorWall', 'monitorWall', 'keyBox', 'noticeBoard', 'whiteboard', 'wallClock', 'intercom', ...SERVICES],
    ceiling: CEILING_SERVICES,
    cover: ['filingCabinet', 'riotShields', 'steelCrate'],
  },
  armory: {
    hero: [['weaponRack', 'weaponRack'], ['gunCage'], ['ammoLocker', 'ammoLocker']],
    medium: [['toolBench'], ['riotShields'], ['steelCrate'], ['ammoLocker'], ['weaponRack'], ['desk', 'officeChair'], ['sandbags']],
    clutter: ['steelCrate', 'crate', 'footlocker'],
    wall: ['keyBox', 'noticeBoard', 'toolWall', 'hazardStripe', 'wallClock', 'poster', ...SERVICES],
    ceiling: CEILING_SERVICES,
    cover: ['steelCrate', 'crate', 'sandbags'],
  },
  cells: {
    hero: [['cellBars', 'cellBench', 'toilet', 'cellBars'], ['cellBars', 'bed', 'cellBars']],
    medium: [['cellBench', 'cellBars'], ['desk', 'officeChair'], ['barricade'], ['wallLocker'], ['sink']],
    clutter: ['bin', 'cardboardBoxes'],
    wall: ['graffiti', 'stain', 'stain', 'intercom', 'hazardStripe', 'noticeBoard', 'keyBox', 'ventGrille', 'roomNumber', 'exitSign'],
    ceiling: ['sprinkler', 'smokeDetector', 'speaker', 'cableBundle'],
    cover: ['barricade', 'steelCrate', 'cardboardBoxes'],
  },
  archive: {
    hero: [['archiveShelf', 'archiveShelf'], ['archiveShelf', 'stepLadder', 'archiveShelf']],
    medium: [['archiveShelf'], ['filingCabinet', 'filingCabinet'], ['cardboardBoxes'], ['desk', 'officeChair'], ['bookshelf'], ['shelvingRack']],
    clutter: ['cardboardBoxes', 'paperStack', 'stepLadder', 'bin'],
    wall: ['noticeBoard', 'roomNumber', 'conduitRun', 'stain', 'ventGrille', 'fireExtinguisher', 'exitSign', 'wallClock'],
    ceiling: CEILING_SERVICES,
    cover: ['filingCabinet', 'cardboardBoxes', 'crate'],
  },
  janitor: {
    hero: [['sink', 'mopBucket'], ['shelvingRack']],
    medium: [['shelvingRack'], ['cardboardBoxes'], ['stepLadder'], ['barrel'], ['bed'], ['crate'], ['toolChest']],
    clutter: ['mopBucket', 'wetFloorSign', 'bin', 'cardboardBoxes', 'gasCylinder'],
    wall: ['shelfWall', 'shelfWall', 'toolWall', 'posterTorn', 'stain', 'pipeRun', 'ventGrille', 'fireExtinguisher', 'noticeBoard'],
    ceiling: ['cableBundle', 'sprinkler', 'smokeDetector'],
    cover: ['crate', 'cardboardBoxes', 'barrel'],
  },
  mechanical: {
    hero: [['boiler', 'pump'], ['waterTank'], ['hvacUnit'], ['pump', 'boiler']],
    medium: [['pump'], ['explosiveBarrel', 'barrel'], ['gasCylinder', 'gasCylinder'], ['toolChest'], ['workLight'], ['cableReel'], ['hvacUnit'], ['barrel', 'explosiveBarrel']],
    clutter: ['barrel', 'mopBucket', 'workLight', 'gasCylinder', 'stepLadder'],
    wall: ['pipeRun', 'pipeRun', 'pipeRun', 'hazardStripe', 'ventGrille', 'wallAc', 'fireExtinguisher', 'stain', 'noticeBoard', 'toolWall'],
    ceiling: ['ceilingDuct', 'ceilingDuct', 'cableBundle', 'sprinkler'],
    tall: ['pipeRun', 'pipeRun', 'ventGrille', 'hazardStripe', 'wallAc'],
    cover: ['barrel', 'crate', 'toolChest'],
  },
  electrical: {
    hero: [['switchgear', 'switchgear'], ['transformer'], ['generator']],
    medium: [['powerBox', 'powerBox'], ['cableReel'], ['transformer'], ['toolChest'], ['workLight'], ['switchgear']],
    clutter: ['cableReel', 'stepLadder', 'workLight', 'cardboardBoxes'],
    wall: ['hazardStripe', 'hazardStripe', 'conduitRun', 'conduitRun', 'noticeBoard', 'fireExtinguisher', 'ventGrille', 'stain', 'roomNumber'],
    ceiling: ['cableBundle', 'cableBundle', 'sprinkler', 'smokeDetector'],
    cover: ['powerBox', 'toolChest', 'crate'],
  },
  storage: {
    hero: [['shelvingRack', 'shelvingRack'], ['crateStack'], ['palletStack', 'crateStack']],
    medium: [['crate', 'crate'], ['cardboardBoxes'], ['shelvingRack'], ['barrel'], ['pallet', 'crate'], ['steelCrate'], ['palletStack'], ['stepLadder']],
    clutter: ['crate', 'cardboardBoxes', 'barrel', 'gasCylinder'],
    wall: ['shelfWall', 'hazardStripe', 'noticeBoard', 'roomNumber', 'stain', 'pipeRun', 'ventGrille', 'fireExtinguisher', 'exitSign'],
    ceiling: CEILING_SERVICES,
    cover: ['crate', 'cardboardBoxes', 'barrel'],
  },
  loadingDock: {
    hero: [['forklift'], ['palletStack', 'palletStack'], ['van']],
    medium: [['crateStack'], ['pallet', 'crate'], ['barrel', 'explosiveBarrel'], ['dumpster'], ['steelCrate'], ['shelvingRack'], ['palletStack']],
    clutter: ['crate', 'pallet', 'barrel', 'cardboardBoxes', 'tireStack'],
    wall: ['hazardStripe', 'hazardStripe', 'pipeRun', 'stain', 'noticeBoard', 'roomNumber', 'fireExtinguisher', 'ventGrille'],
    ceiling: ['ceilingDuct', 'cableBundle', 'sprinkler'],
    tall: ['hazardStripe', 'pipeRun', 'billboard', 'ventGrille', 'window'],
    cover: ['crate', 'barrel', 'palletStack'],
  },
  garage: {
    // A car to hide a body in, tap for fuel or set alight (block.ts keeps garages wide enough for one).
    must: [['car']],
    hero: [['car'], ['van'], ['car', 'tireStack']],
    medium: [['tireStack', 'tireStack'], ['explosiveBarrel'], ['toolChest'], ['car'], ['barrel', 'explosiveBarrel'], ['bollard'], ['dumpster'], ['powerBox']],
    clutter: ['tireStack', 'bollard', 'barrel', 'gasCylinder', 'bin'],
    wall: ['hazardStripe', 'roomNumber', 'roomNumber', 'pipeRun', 'stain', 'graffiti', 'fireExtinguisher', 'exitSign', 'ventGrille'],
    ceiling: ['ceilingDuct', 'cableBundle', 'sprinkler', 'sprinkler'],
    tall: ['hazardStripe', 'pipeRun', 'billboard', 'ventGrille'],
    cover: ['bollard', 'tireStack', 'barrel'],
  },
  stairwell: {
    hero: [['vendingMachine'], ['cardboardBoxes', 'powerBox']],
    medium: [['bin'], ['crate'], ['plant']],
    clutter: ['bin', 'cardboardBoxes', 'paperStack'],
    wall: ['exitSign', 'exitSign', 'roomNumber', 'roomNumber', 'fireExtinguisher', 'graffiti', 'posterTorn', 'pipeRun', 'stain', 'fireAlarmPull'],
    ceiling: ['sprinkler', 'smokeDetector', 'cableBundle'],
    cover: ['cardboardBoxes', 'powerBox', 'crate'],
  },
  elevatorLobby: {
    hero: [['bench', 'plant'], ['plantTall', 'kiosk']],
    medium: [['plant'], ['bin'], ['waterCooler'], ['armchair']],
    clutter: ['bin', 'plant'],
    wall: ['wallScreen', 'noticeBoard', 'mirror', 'picture', 'roomNumber', 'exitSign', 'fireExtinguisher', 'ventGrille'],
    ceiling: ['sprinkler', 'smokeDetector', 'speaker'],
    cover: ['armchair', 'cardboardBoxes'],
  },
  vault: {
    must: [['vaultShelves', 'goldPallet']],
    hero: [['safeLarge', 'cashPallet'], ['vaultShelves'], ['goldPallet', 'gold']],
    medium: [['cashPallet'], ['gold'], ['safeLarge'], ['steelCrate'], ['vaultShelves']],
    clutter: ['gold', 'steelCrate'],
    wall: ['depositBoxes', 'depositBoxes', 'hazardStripe', 'keyBox', 'roomNumber', 'ventGrille'],
    ceiling: ['sprinkler', 'smokeDetector', 'speaker'],
    cover: ['steelCrate', 'cashPallet', 'goldPallet'],
  },
  penthouse: {
    hero: [['plant', 'sofa', 'coffeeTable', 'armchair'], ['piano'], ['barStool', 'barCounter', 'barStool'], ['nightstand', 'bed', 'nightstand']],
    medium: [['drinksCabinet'], ['plantTall'], ['armchair', 'coffeeTable'], ['tvStand'], ['bookshelf'], ['wardrobe'], ['trophyCase'], ['safeSmall']],
    clutter: ['plant', 'barStool', 'bin'],
    wall: ['fireplace', 'artLarge', 'artLarge', 'picture', 'window', 'window', 'mirror', 'wallScreen', 'shelfWall', 'ventGrille'],
    ceiling: ['ceilingFan', 'sprinkler', 'smokeDetector', 'speaker'],
    cover: ['safeSmall', 'armchair', 'drinksCabinet'],
    rug: 0.9,
  },
  workshop: {
    hero: [['toolBench', 'toolChest'], ['toolChest', 'toolBench', 'workLight'], ['generator']],
    medium: [['shelvingRack'], ['cableReel'], ['gasCylinder', 'explosiveBarrel'], ['stepLadder'], ['crate', 'crate'], ['car'], ['toolBench'], ['barrel']],
    clutter: ['toolChest', 'gasCylinder', 'cableReel', 'bin', 'workLight'],
    wall: ['toolWall', 'toolWall', 'shelfWall', 'pipeRun', 'hazardStripe', 'poster', 'noticeBoard', 'fireExtinguisher', 'stain', 'wallClock'],
    ceiling: ['ceilingDuct', 'cableBundle', 'sprinkler', 'sprinkler'],
    tall: ['window', 'pipeRun', 'hazardStripe', 'toolWall', 'ventGrille'],
    cover: ['toolChest', 'crate', 'barrel'],
  },
  silo: {
    hero: [['crateStack'], ['palletStack', 'barrel']],
    medium: [['barrel', 'barrel'], ['pallet'], ['crate'], ['explosiveBarrel']],
    clutter: ['barrel', 'crate', 'cableReel'],
    wall: ['hazardStripe', 'stain', 'stain', 'pipeRun', 'roomNumber', 'ventGrille', 'graffiti'],
    ceiling: ['cableBundle'],
    tall: ['pipeRun', 'hazardStripe', 'stain', 'ventGrille', 'conduitRun'],
    cover: ['barrel', 'crate'],
  },
  gatehouse: {
    must: [['desk', 'officeChair']],
    hero: [['radioStation'], ['filingCabinet']],
    medium: [['coffeeMachine'], ['bin'], ['wallLocker']],
    clutter: ['bin', 'paperStack'],
    wall: ['monitorWall', 'keyBox', 'noticeBoard', 'window', 'wallClock', 'poster', 'fireExtinguisher'],
    ceiling: ['smokeDetector', 'cableBundle'],
    cover: ['filingCabinet', 'cardboardBoxes'],
  },
  sewer: {
    hero: [['pump'], ['crate', 'barrel']],
    medium: [['barrel'], ['pallet'], ['dumpster'], ['crate'], ['tireStack'], ['explosiveBarrel'], ['cardboardBoxes']],
    clutter: ['barrel', 'bin', 'tireStack', 'paperStack'],
    wall: ['pipeRun', 'pipeRun', 'graffiti', 'graffiti', 'stain', 'stain', 'ventGrille', 'conduitRun', 'posterTorn', 'hazardStripe'],
    ceiling: ['cableBundle'],
    cover: ['barrel', 'crate', 'tireStack'],
  },
  street: {
    hero: [['car'], ['van'], ['dumpster', 'bin']],
    medium: [['bollard', 'bollard'], ['fireHydrant'], ['streetSign'], ['powerBox'], ['jerseyBarrier'], ['bin'], ['plantTall'], ['bench']],
    clutter: ['bin', 'bollard', 'cardboardBoxes', 'tireStack'],
    wall: [],
    ceiling: [],
    cover: ['bollard', 'jerseyBarrier', 'powerBox'],
  },
  yard: {
    hero: [['jerseyBarrier'], ['sandbags'], ['crateStack']],
    medium: [['crate'], ['pallet'], ['barrel'], ['powerBox'], ['flagPole'], ['workLight']],
    clutter: ['bollard', 'crate', 'barrel'],
    wall: [],
    ceiling: [],
    cover: ['jerseyBarrier', 'crate', 'sandbags'],
  },
  rooftop: {
    hero: [['roofAcUnit', 'roofAcUnit'], ['roofWaterTank'], ['antenna', 'satelliteDish']],
    medium: [['roofVent'], ['satelliteDish'], ['roofAcUnit'], ['antenna'], ['hvacUnit'], ['roofVent', 'roofVent'], ['helipadLight', 'helipadLight'], ['powerBox']],
    clutter: ['roofVent', 'helipadLight', 'cableReel'],
    wall: [],
    ceiling: [],
    cover: ['roofVent', 'roofAcUnit'],
  },
}

/** Fittings that sit above the floor prop they serve. */
export const ABOVE: Partial<Record<PropKind, PropKind>> = { stove: 'rangeHood', conferenceTable: 'projector' }

/** Furniture that carries a computer terminal. */
export const DESKS: readonly PropKind[] = ['desk', 'deskCorner', 'executiveDesk', 'securityDesk', 'receptionDesk', 'labBench', 'consoleCart', 'toolBench']

export const OUTDOOR: readonly RoomKind[] = ['street', 'yard', 'rooftop']
