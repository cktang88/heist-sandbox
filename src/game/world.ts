import type { Charge } from './charges'
import type { FallingTile } from './collapse'
import type { Drone } from './drone'
import type { Effects } from './effects'
import type { Guard } from './guards'
import { createComplex } from './complex/complex'
import { createLevel } from './level'
import { createProps, type PropState } from './cover'
import type { Terminal } from './devices/devices'
import { createElevators, type ElevatorCar } from './elevators'
import { createHazards, type HazardState } from './hazards/hazards'
import { createSecurity, type SecurityState } from './security/dispatch'
import type { DeviceSpawn, ElevatorShaft, Interior, Lamp, Room, Stairwell, TimeOfDay } from './site'
import { mirrorLevel } from './mirror'
import { createPlayer, type Player } from './player'
import type { Projectile } from './projectiles'
import { createRng, type Rng } from './rng'
import type { Grid } from './tiles'
import type { SoundEvent } from './sounds'
import { createTime, type TimeState } from './time'
import type { Body, Rect } from './types'
import { createGuard } from './guards'
import type { Frag } from './frag/frag'
import type { Rope } from './rope/rope'
import { createFallingProps, type FallingPropsState } from './vehicles/fallingProps'

export type Loot = Body & { taken: boolean }
export type Pickup = Body & { kind: 'medkit' | 'ammo'; taken: boolean }
/** A device in play. `disabled` means cut, broken or switched off; `hacked` means the player controls it. */
export type Device = DeviceSpawn & { id: number; disabled: boolean; hacked: boolean }
/** Which site to build: the full complex, or the small single building used for quick games and tests. */
export type SiteKind = 'complex' | 'outpost'
export type RunStats = { kills: number; tilesDestroyed: number; timesSpotted: number }

/** Everything about one heist in progress. Systems read and change this; rendering only reads it. */
export type World = {
  grid: Grid
  player: Player
  guards: Guard[]
  projectiles: Projectile[]
  charges: Charge[]
  falling: FallingTile[]
  /** Set when a tile is removed, so the next step checks whether anything lost its support. */
  structureChanged: boolean
  drone: Drone | null
  effects: Effects
  /** Sounds waiting to be played. Whoever plays them empties the list. */
  sounds: SoundEvent[]
  loot: Loot
  pickups: Pickup[]
  extraction: Rect
  name: string
  timeOfDay: TimeOfDay
  /** Row of the street surface. */
  groundY: number
  interiors: Interior[]
  rooms: Room[]
  stairwells: Stairwell[]
  elevators: ElevatorShaft[]
  devices: Device[]
  lamps: Lamp[]
  props: PropState[]
  hazards: HazardState
  security: SecurityState
  elevatorCars: ElevatorCar[]
  /** Thrown frag grenades. */
  frags: Frag[]
  /** Climbing ropes the player has tied off. */
  ropes: Rope[]
  /** Floor props dropping through a destroyed floor. */
  fallingProps: FallingPropsState
  /** Lighting circuits whose fuse box has been cut. */
  deadCircuits: Set<number>
  /** The hacking menu that is open, if any. */
  terminal: Terminal | null
  /** A hint for the action available right now, e.g. "E: pick lock". */
  prompt: string | null
  time: TimeState
  alarm: boolean
  shake: number
  clock: number
  stats: RunStats
  status: 'playing' | 'won' | 'dead'
  rng: Rng
}

export function createWorld(seed: number, kind: SiteKind = 'outpost'): World {
  // Even seeds are flipped, so the van and the building swap sides.
  const built = kind === 'complex' ? createComplex(seed) : createLevel(seed)
  const level = seed % 2 === 0 ? mirrorLevel(built) : built
  return {
    grid: level.grid,
    player: createPlayer(level.playerStart),
    guards: level.guards.map((spawn) => createGuard(spawn)),
    projectiles: [],
    charges: [],
    falling: [],
    structureChanged: false,
    drone: null,
    effects: { particles: [], flashes: [] },
    sounds: [],
    loot: { x: level.loot.x, y: level.loot.y - 0.8, w: 0.8, h: 0.8, vx: 0, vy: 0, onGround: false, taken: false },
    pickups: level.pickups.map((spawn) => ({ x: spawn.x + 0.15, y: spawn.y - 0.6, w: 0.7, h: 0.6, vx: 0, vy: 0, onGround: false, kind: spawn.kind, taken: false })),
    extraction: level.extraction,
    name: level.name,
    timeOfDay: level.timeOfDay,
    groundY: level.groundY,
    interiors: level.interiors,
    rooms: level.rooms,
    stairwells: level.stairwells,
    elevators: level.elevators,
    devices: level.devices.map((device, id) => ({ ...device, id, disabled: false, hacked: false })),
    lamps: level.lamps,
    props: createProps(level.props),
    hazards: createHazards(),
    security: createSecurity(),
    elevatorCars: createElevators(level.elevators),
    frags: [],
    ropes: [],
    fallingProps: createFallingProps(),
    deadCircuits: new Set(),
    terminal: null,
    prompt: null,
    time: createTime(),
    alarm: false,
    shake: 0,
    clock: 0,
    stats: { kills: 0, tilesDestroyed: 0, timesSpotted: 0 },
    status: 'playing',
    rng: createRng(seed ^ 0x9e3779b9),
  }
}
