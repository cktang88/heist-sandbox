import { setupIntel } from './intel/intel'
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
import { prepareWorld } from './prepare'
import { createPlayer, type Player } from './player'
import type { Projectile } from './projectiles'
import { createRng, type Rng } from './rng'
import type { Grid } from './tiles'
import type { SoundEvent } from './sounds'
import { createTime, type TimeState } from './time'
import type { Body, Rect, Vec } from './types'
import { createGuard } from './guards'
import type { Frag } from './frag/frag'
import type { Rope } from './rope/rope'
import { createGrapple, type GrappleState } from './grapple/state'
import { createFallingProps, type FallingPropsState } from './vehicles/fallingProps'
import { createPhysProps, type PhysPropsState } from './physprops/state'
import { createMelee, type MeleeState } from './melee/state'
import { createIntel, type IntelState } from './intel/types'
import { createGaps, type GapState } from './gaps/state'
import { createDirector, type DirectorState } from './director/state'
import { createChronicle, type ChronicleState } from './chronicle/types'
import { createStealth, type StealthState } from './stealth/state'
import { createPeople } from './people/people'
import type { PeopleState } from './people/types'
import { createSystems, type SystemsState } from './systems/state'

export type Loot = Body & { taken: boolean }
export type Pickup = Body & { kind: 'medkit' | 'ammo'; taken: boolean }
/** A device in play. `disabled` means cut, broken or switched off; `hacked` means the player controls it. */
export type Device = DeviceSpawn & { id: number; disabled: boolean; hacked: boolean }
/** Which site to build: the full complex, or the small single building used for quick games and tests. */
export type SiteKind = 'complex' | 'outpost'
/** `knockouts`: guards put out without killing; `bodiesFound`: bodies (dead or out cold) guards discovered; `alarms`: times the site went to level 3. */
export type RunStats = { kills: number; tilesDestroyed: number; timesSpotted: number; knockouts: number; bodiesFound: number; alarms: number }

/** Everything about one heist in progress. Systems read and change this; rendering only reads it. */
export type World = {
  /** Chosen surface for the opening parachute entry; absent until a drop is planned. */
  dropPoint?: Vec
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
  /** Furniture the player has disturbed (dragged, tipped, thrown, falling). */
  physProps: PhysPropsState
  /** Close combat: blows, the human shield, guards knocked flying. */
  melee: MeleeState
  hazards: HazardState
  security: SecurityState
  elevatorCars: ElevatorCar[]
  /** Thrown frag grenades. */
  frags: Frag[]
  /** Climbing ropes the player has tied off. */
  ropes: Rope[]
  /** The grappling hook: in the launcher, flying, bitten with the player on its line, or left hanging. */
  grapple: GrappleState
  /** Floor props dropping through a destroyed floor. */
  fallingProps: FallingPropsState
  /** Holes in floor slabs that people can walk past, drop through or climb up through. */
  gaps: GapState
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
  /** Where the case really is, and what the player has learned about it. */
  intel: IntelState
  /** Tonight's conditions and the events sprung during the heist (off until the game turns it on). */
  director: DirectorState
  /** The notable moments of the heist so far, for the story told at the end. */
  chronicle: ChronicleState
  /** The quiet toolkit: bodies carried and hidden, chokes, hiding places, disguises, lifted radios and keycards. */
  stealth: StealthState
  /** Who the guards are: names, ranks, traits, bonds and what happened to them tonight (people/). */
  people?: PeopleState
  /** Couplings between systems: water, live wires, falling fittings, traps and faults (systems/). */
  systems: SystemsState
}

export function createWorld(seed: number, kind: SiteKind = 'outpost'): World {
  // Even seeds are flipped, so the van and the building swap sides.
  const built = kind === 'complex' ? createComplex(seed) : createLevel(seed)
  const level = seed % 2 === 0 ? mirrorLevel(built) : built
  const world: World = {
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
    physProps: createPhysProps(),
    melee: createMelee(),
    hazards: createHazards(),
    security: createSecurity(),
    elevatorCars: createElevators(level.elevators),
    frags: [],
    ropes: [],
    grapple: createGrapple(),
    fallingProps: createFallingProps(),
    gaps: createGaps(level),
    deadCircuits: new Set(),
    terminal: null,
    prompt: null,
    time: createTime(),
    alarm: false,
    shake: 0,
    clock: 0,
    stats: { kills: 0, tilesDestroyed: 0, timesSpotted: 0, knockouts: 0, bodiesFound: 0, alarms: 0 },
    status: 'playing',
    rng: createRng(seed ^ 0x9e3779b9),
    intel: createIntel(),
    director: createDirector(seed, kind),
    chronicle: createChronicle(),
    stealth: createStealth(),
    systems: createSystems(seed),
  }
  setupIntel(world)
  prepareWorld(world)
  world.people = createPeople(world, seed)
  return world
}
