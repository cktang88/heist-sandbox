import type { PropKind } from './propCatalog'
import type { Grid } from './tiles'
import type { Rect, Vec } from './types'

/**
 * The shape of a heist site: what a level generator produces and what the game,
 * the guards and the renderers read. All positions are in tiles.
 * A "floor y" is the row a person's feet stand on (the top of the slab).
 */

export type RoomKind =
  | 'lobby' | 'office' | 'executive' | 'conference' | 'breakRoom' | 'cafeteria' | 'kitchen' | 'restroom'
  | 'lockers' | 'barracks' | 'lounge' | 'gym' | 'infirmary' | 'lab' | 'server' | 'security' | 'armory'
  | 'cells' | 'archive' | 'janitor' | 'mechanical' | 'electrical' | 'storage' | 'loadingDock' | 'garage'
  | 'stairwell' | 'elevatorLobby' | 'vault' | 'penthouse' | 'workshop' | 'silo' | 'gatehouse' | 'sewer'

/** One room: the open space between its walls, floor and ceiling. */
export type Room = Rect & {
  id: number
  kind: RoomKind
  building: string
  /** Storey number within its building. 0 is ground level; basements are negative. */
  storey: number
  /** Row the occupants stand on (the room's floor). */
  floorY: number
  /** How locked-down the room is, 0 (public) to 3 (vault). Drives guards, cameras and locks. */
  security: 0 | 1 | 2 | 3
}

/** A staircase in the back of a stair lobby. People zigzag between its two landings as they climb. */
export type Stairwell = {
  id: number
  building: string
  /** x of the left-hand and right-hand landings. */
  leftX: number
  rightX: number
  /** Floor y of each stop, lowest first. Stop 0 uses the left landing, stop 1 the right, and so on. */
  stops: number[]
}

/** An elevator shaft. The car itself is run by the elevator system. */
export type ElevatorShaft = {
  id: number
  building: string
  /** Leftmost column of the open shaft, and its width in tiles. */
  x: number
  w: number
  /** Floor y of each stop, lowest first. */
  stops: number[]
  /** Which side the doors open onto. */
  doorSide: 1 | -1
}

export type GuardRole = 'patrol' | 'post' | 'sentry' | 'operator' | 'officer' | 'heavy'
export type GuardSpawn = Vec & {
  facing: 1 | -1
  role?: GuardRole
  roomId?: number
  /** Points a patrolling guard walks between, on its own floor. */
  route?: Vec[]
}

/** An indoor or underground area, so the renderer can draw a back wall instead of sky. */
export type Interior = Rect & { kind: 'room' | 'earth' }

export type FixtureKind =
  | 'ceilingPanel' | 'fluorescentTube' | 'pendant' | 'chandelier' | 'bareBulb' | 'downlight'
  | 'tableLamp' | 'floorLamp' | 'deskLamp' | 'wallSconce' | 'neon' | 'emergency'
  | 'streetLight' | 'floodlight' | 'workLight'

/** A light source and the fitting that holds it. */
export type Lamp = Vec & {
  fixture: FixtureKind
  /** Colour as 0xRRGGBB. */
  color: number
  /** How far the light reaches, in tiles, and how strong it is (1 = an ordinary room light). */
  radius: number
  strength: number
  /** Hung fittings go dark when the ceiling tile above them is destroyed. */
  hung: boolean
  /** Lamps on the same circuit go out together when its fuse box is cut. Undefined = always powered. */
  circuit?: number
  /** A failing tube that stutters. */
  flickers?: boolean
}

/** Furniture and clutter. `y` is the floor row it stands on (or, for wall and ceiling items, the row of its top edge). */
export type Prop = Vec & { kind: PropKind; flip?: boolean; roomId?: number }

/** Supplies lying around the site. `y` is the floor row it sits on. */
export type PickupSpawn = Vec & { kind: 'medkit' | 'ammo' }

export type DeviceKind = 'camera' | 'computer' | 'fusebox' | 'alarmButton' | 'keypad' | 'elevatorPanel' | 'radioRelay' | 'lightSwitch'

/** Something electronic the player can hack, cut or trip, and that the security force relies on. */
export type DeviceSpawn = Vec & {
  kind: DeviceKind
  roomId?: number
  facing?: 1 | -1
  /** The lighting circuit a fuse box or light switch controls. */
  circuit?: number
  /** For keypads: the door tile this unlocks. For elevator panels: the shaft id. */
  target?: Vec | number
}

export type TimeOfDay = 'night' | 'day'

export type Level = {
  name: string
  timeOfDay: TimeOfDay
  grid: Grid
  /** Row of the street surface: the first solid row at ground level. */
  groundY: number
  playerStart: Vec
  extraction: Rect
  loot: Vec
  guards: GuardSpawn[]
  interiors: Interior[]
  rooms: Room[]
  stairwells: Stairwell[]
  elevators: ElevatorShaft[]
  lamps: Lamp[]
  props: Prop[]
  pickups: PickupSpawn[]
  devices: DeviceSpawn[]
}

export const LIGHT = {
  warm: 0xffd9a8,
  lamp: 0xffb46b,
  office: 0xf2f1e6,
  sterile: 0xd7e6ff,
  sodium: 0xff9a3c,
  green: 0x9fe6ad,
  red: 0xff3b30,
  cyan: 0x3fd0ff,
  magenta: 0xff2d95,
} as const

export function roomAt(rooms: readonly Room[], x: number, y: number): Room | undefined {
  return rooms.find((room) => x >= room.x && x < room.x + room.w && y >= room.y && y <= room.y + room.h)
}
