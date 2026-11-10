import { burst } from './effects'
import { hurtGuard, type Guard } from './guards'
import { igniteAt } from './hazards/hazards'
import type { Input } from './input'
import { clearShaftDoorway } from './gaps/aside'
import { bodyControl } from './movement/control'
import { currentHoles } from './gaps/state'
import { heldUpByHoles } from './gaps/walk'
import { emitNoise } from './noise'
import { propBox, propById } from './hazards/props'
import { looseProps, rekeyIfMoved, shiftProp } from './physprops/state'
import { boxHitsSolid, GRAVITY } from './physics'
import type { Player } from './player'
import type { Projectile } from './projectiles'
import { elevatorsRecalled, isLockedDown } from './security/levels'
import type { ElevatorShaft } from './site'
import { playSound } from './sounds'
import { setTile, TILE_DEFS, tileAt, type TileKind } from './tiles'
import type { Body, Rect, Vec } from './types'
import { castRay } from './vision'
import type { World } from './world'

type Person = Player | Guard

/**
 * An elevator car. `y` is the floor row its passengers stand on (fractional while it travels).
 * The car is only made of tiles while it stands still: a row of reinforced tiles across the shaft.
 * While it travels, the people inside are carried by holding them to `y`.
 */
export type ElevatorCar = {
  shaft: number
  y: number
  /** The stop it is heading for, or (while parked) a stop someone has called it to. */
  targetStop: number | null
  doorsOpen: boolean
  /** Held in place by a hacked terminal: ignores calls and its buttons. */
  locked: boolean
  /** The stop it is parked at; null while travelling or stalled between floors. */
  stop: number | null
  moving: boolean
  /** Freed by a hacked terminal from the security lockdown. */
  released: boolean
  /** On a trip ordered by a hacked terminal, which overrides the lockdown. */
  forced: boolean
  /** Seconds left that a car summoned by a terminal waits before the lockdown can take it back. */
  dwell: number
  /** Everyone travelling inside. */
  riders: Person[]
  /** The tiles the car floor replaced, so they can be put back when it leaves. */
  floorTiles: (Vec & { kind: TileKind })[]
  /** Shaft door tiles opened at the current stop, closed again on departure. */
  doorTiles: Vec[]
  /** The cable is cut: the car falls, then lies wrecked at the bottom and never runs again. */
  cut?: boolean
  /** Speed of the fall, tiles per second, once the cable is cut. */
  fallSpeed?: number
  /** Bullets that have hit the winding gear at the head of the shaft. */
  cableHits?: number
  /** Ids of loose furniture standing on the car floor while it travels, carried along like the riders. */
  cargo?: number[]
}

/** Tiles per second. */
const CAR_SPEED = 5
/** Open rows above the car floor: anyone in here when it leaves goes along. */
const CAB_HEIGHT = 5
/** Rows of the doorway in the shaft wall at each stop. */
export const DOOR_HEIGHT = 3
/** How long a terminal-summoned car waits at its stop before a lockdown can recall it. */
const SUMMON_DWELL = 10
/** How far outside a shaft door the call button can be reached. */
const CALL_REACH = 2
const PUSH_DAMAGE_PER_SECOND = 15
const CRUSH_DAMAGE = 1000
const EPSILON = 0.001

export function createElevators(shafts: readonly ElevatorShaft[]): ElevatorCar[] {
  return shafts.map((shaft) => ({
    shaft: shaft.id, y: shaft.stops[0], targetStop: null, doorsOpen: false, locked: false,
    stop: 0, moving: false, released: false, forced: false, dwell: 0, riders: [], floorTiles: [], doorTiles: [],
  }))
}

export function shaftOf(world: World, car: ElevatorCar): ElevatorShaft {
  return world.elevators.find((shaft) => shaft.id === car.shaft)!
}

/** Column of the shaft wall the doors are set in. */
export function doorColumn(shaft: ElevatorShaft): number {
  return shaft.doorSide === 1 ? shaft.x + shaft.w : shaft.x - 1
}

/** The stop on the street storey, where a lockdown sends every car. */
export function groundStop(world: World, shaft: ElevatorShaft): number {
  let best = 0
  shaft.stops.forEach((y, index) => {
    if (Math.abs(y - world.groundY) < Math.abs(shaft.stops[best] - world.groundY)) best = index
  })
  return best
}

/**
 * What the security dispatcher wants from a car: nothing, a recall to the ground stop, or a freeze.
 * The meaning of each alert level comes from security/levels.ts, the one place it is decided.
 */
function dispatcherOrder(world: World, car: ElevatorCar, shaft: ElevatorShaft): 'freeze' | number | null {
  if (car.released) return null
  if (isLockedDown(world)) return 'freeze'
  if (elevatorsRecalled(world)) return groundStop(world, shaft)
  return null
}

/** True when a call from a button would be ignored: held by a hacked terminal, or by the security lockdown. */
export function elevatorRefuses(world: World, car: ElevatorCar): boolean {
  return car.cut === true || car.locked || dispatcherOrder(world, car, shaftOf(world, car)) !== null
}

/**
 * Sends a car to a stop. Buttons are refused during a lockdown; a hacked terminal (`forced`) is not.
 * Returns whether the car is coming.
 */
export function callElevator(world: World, car: ElevatorCar, stop: number, forced = false): boolean {
  const shaft = shaftOf(world, car)
  if (stop < 0 || stop >= shaft.stops.length || car.cut) return false
  if (!forced && elevatorRefuses(world, car)) return false
  if (forced) car.forced = true
  if (!car.moving && car.stop === stop) {
    if (!car.doorsOpen) openDoors(world, car, shaft)
    if (forced) car.dwell = SUMMON_DWELL
    car.forced = false
    return true
  }
  car.targetStop = stop
  return true
}

/** Hacked terminal: freeze a building's cars where they stand. */
export function holdElevators(world: World, building: string): void {
  for (const car of carsOf(world, building)) car.locked = true
}

/** Hacked terminal: free a building's cars from both a hold and the security lockdown. */
export function releaseElevators(world: World, building: string): void {
  for (const car of carsOf(world, building)) {
    car.locked = false
    car.released = true
  }
}

export function carsOf(world: World, building: string): ElevatorCar[] {
  return world.elevatorCars.filter((car) => shaftOf(world, car).building === building)
}

function insideShaft(shaft: ElevatorShaft, body: Body): boolean {
  const centerX = body.x + body.w / 2
  return centerX >= shaft.x && centerX < shaft.x + shaft.w
}

/** The parked car the player is standing in, if any. */
export function carUnderPlayer(world: World): ElevatorCar | null {
  const player = world.player
  return world.elevatorCars.find((car) => !car.moving && insideShaft(shaftOf(world, car), player)
    && Math.abs(player.y + player.h - car.y) < 0.3) ?? null
}

/** The shaft door the player is standing at, if any, and which stop it belongs to. */
export function shaftDoorAt(world: World, body: Body): { car: ElevatorCar; stop: number } | null {
  const centerX = body.x + body.w / 2
  const feet = body.y + body.h
  for (const car of world.elevatorCars) {
    const shaft = shaftOf(world, car)
    if (insideShaft(shaft, body)) continue
    const outside = (centerX - (doorColumn(shaft) + 0.5)) * shaft.doorSide
    if (outside < -0.5 || outside > CALL_REACH) continue
    const stop = shaft.stops.findIndex((y) => Math.abs(y - feet) < 0.4)
    if (stop >= 0) return { car, stop }
  }
  return null
}

/** Moves every car: answers calls and its buttons, obeys the dispatcher, carries riders and pushes whatever is underneath. */
export function stepElevators(world: World, input: Input, dt: number): void {
  const keys = bodyControl(world, input)
  for (const car of world.elevatorCars) {
    const shaft = shaftOf(world, car)
    if (car.cut) {
      if (car.moving) freeFall(world, car, shaft, dt)
      continue
    }
    if (!car.moving && car.floorTiles.length === 0) placeFloor(world, car, shaft)
    car.dwell = Math.max(0, car.dwell - dt)
    if (car.moving) travel(world, car, shaft, keys, dt)
    else stayOrLeave(world, car, shaft, keys)
  }
}

function stayOrLeave(world: World, car: ElevatorCar, shaft: ElevatorShaft, input: Input): void {
  const order = dispatcherOrder(world, car, shaft)
  if (car.forced && car.targetStop !== null) return depart(world, car, shaft, car.targetStop)
  if (order === 'freeze') return
  if (order !== null) {
    if (car.stop !== order && car.dwell === 0) depart(world, car, shaft, order)
    return
  }
  if (car.locked) return
  if (car.stop === null) return depart(world, car, shaft, nearestStop(shaft, car.y))
  if (car.targetStop !== null) {
    const target = car.targetStop
    car.targetStop = null
    if (target !== car.stop) return depart(world, car, shaft, target)
    if (!car.doorsOpen) openDoors(world, car, shaft)
    return
  }
  const direction = (input.up ? 1 : 0) - (input.down ? 1 : 0)
  const next = car.stop + direction
  if (direction !== 0 && next >= 0 && next < shaft.stops.length && carUnderPlayer(world) === car) depart(world, car, shaft, next)
}

function nearestStop(shaft: ElevatorShaft, y: number): number {
  let best = 0
  shaft.stops.forEach((stopY, index) => {
    if (Math.abs(stopY - y) < Math.abs(shaft.stops[best] - y)) best = index
  })
  return best
}

function people(world: World): Person[] {
  return [world.player, ...world.guards.filter((guard) => guard.state !== 'dead')]
}

function depart(world: World, car: ElevatorCar, shaft: ElevatorShaft, target: number): void {
  car.riders = people(world).filter((body) => insideShaft(shaft, body) && body.y + body.h > car.y - CAB_HEIGHT && body.y + body.h < car.y + 0.3)
  car.cargo = cargoOn(world, car, shaft)
  closeDoors(world, car, shaft)
  removeFloor(world, car)
  car.moving = true
  car.stop = null
  car.targetStop = target
  playSound(world, 'elevator', carCenter(shaft, car.y))
}

function travel(world: World, car: ElevatorCar, shaft: ElevatorShaft, input: Input, dt: number): void {
  const order = dispatcherOrder(world, car, shaft)
  if (!car.forced && order === 'freeze') return stall(world, car, shaft)
  if (!car.forced && typeof order === 'number') car.targetStop = order
  const goal = shaft.stops[car.targetStop!]
  const before = car.y
  const step = CAR_SPEED * dt
  car.y = Math.abs(goal - car.y) <= step ? goal : car.y + Math.sign(goal - car.y) * step
  sweep(world, car, shaft, before, dt)
  carryRiders(car, shaft)
  carryCargo(world, car)
  if (car.y !== goal) return
  if (keepGoing(world, car, shaft, input)) return
  arrive(world, car, shaft)
}

/** Holding W or S while riding carries on past each stop instead of stopping. */
function keepGoing(world: World, car: ElevatorCar, shaft: ElevatorShaft, input: Input): boolean {
  if (car.forced || car.locked || dispatcherOrder(world, car, shaft) !== null || !car.riders.includes(world.player)) return false
  const direction = (input.up ? 1 : 0) - (input.down ? 1 : 0)
  const next = car.targetStop! + direction
  if (direction === 0 || next < 0 || next >= shaft.stops.length) return false
  car.targetStop = next
  return true
}

function arrive(world: World, car: ElevatorCar, shaft: ElevatorShaft): void {
  if (car.forced) car.dwell = SUMMON_DWELL
  car.moving = false
  car.forced = false
  car.stop = car.targetStop
  car.targetStop = null
  placeFloor(world, car, shaft)
  releaseRiders(car)
  car.cargo = []
  openDoors(world, car, shaft)
  playSound(world, 'elevatorDing', carCenter(shaft, car.y))
}

/** Lockdown mid-trip: the car stops dead between floors. Its riders stand on it and can climb out by the ladder. */
function stall(world: World, car: ElevatorCar, shaft: ElevatorShaft): void {
  car.y = Math.round(car.y)
  carryRiders(car, shaft)
  carryCargo(world, car)
  car.cargo = []
  car.moving = false
  car.targetStop = null
  const stop = shaft.stops.indexOf(car.y)
  car.stop = stop >= 0 ? stop : null
  placeFloor(world, car, shaft)
  releaseRiders(car)
}

/** Loose furniture standing on the car floor, its middle over the shaft. */
function cargoOn(world: World, car: ElevatorCar, shaft: ElevatorShaft): number[] {
  return looseProps(world).filter(({ prop, loose }) => {
    const box = propBox(prop)
    const middle = box.x + box.w / 2
    return !loose.flying && middle >= shaft.x && middle < shaft.x + shaft.w && Math.abs(box.y + box.h - car.y) < 0.3
  }).map(({ prop }) => prop.id)
}

/** Keeps the furniture on the car standing on its floor as it moves. */
function carryCargo(world: World, car: ElevatorCar): void {
  for (const id of car.cargo ?? []) {
    const prop = propById(world, id)
    const loose = world.physProps.loose.get(id)
    if (!prop || prop.broken || !loose) continue
    const box = propBox(prop)
    shiftProp(prop, 0, car.y - (box.y + box.h))
    loose.vx = 0
    loose.vy = 0
    rekeyIfMoved(world, prop, loose, false)
  }
}

function carryRiders(car: ElevatorCar, shaft: ElevatorShaft): void {
  car.riders = car.riders.filter((body) => !('state' in body) || body.state !== 'dead')
  for (const body of car.riders) {
    body.y = car.y - body.h - EPSILON
    body.x = Math.max(shaft.x + EPSILON, Math.min(shaft.x + shaft.w - body.w - EPSILON, body.x))
    body.vy = 0
    body.onGround = true
    body.stairs = null
    if ('state' in body) body.climbing = false
    else Object.assign(body, { onLadder: false, chute: false })
  }
}

function releaseRiders(car: ElevatorCar): void {
  for (const body of car.riders) body.onGround = true
  car.riders = []
}

/**
 * Deals with everyone in the shaft the car is moving through: going down it shoves them ahead
 * (and crushes them against the pit); going up it scoops them onto its floor.
 */
function sweep(world: World, car: ElevatorCar, shaft: ElevatorShaft, before: number, dt: number): void {
  for (const body of people(world)) {
    if (car.riders.includes(body) || !insideShaft(shaft, body) || walksPastShaft(world, shaft, body)) continue
    const feet = body.y + body.h
    if (car.y < before) {
      if (feet >= car.y && feet <= before + 0.05) car.riders.push(body)
      continue
    }
    if (feet <= before || body.y >= car.y + 1) continue
    body.y = car.y + 1 + EPSILON
    body.vy = Math.max(body.vy, CAR_SPEED)
    hurt(world, body, boxHitsSolid(world.grid, body) ? CRUSH_DAMAGE : PUSH_DAMAGE_PER_SECOND * dt, carCenter(shaft, car.y))
  }
}

/** Feet this far below a stop are still someone walking past, sunk a little before the gaps step puts them back. */
const LANE_SINK = 0.9

/**
 * Someone on the corridor in front of the shaft at one of its stops, walking past it where the car is not: a car going
 * by passes behind them. They last stood on that storey's floor, have not dropped below it, and the shaft under
 * them is open (see gaps/walk.ts). The bottom of the shaft is solid ground, so whoever stands there is in the pit.
 */
function walksPastShaft(world: World, shaft: ElevatorShaft, body: Person): boolean {
  const stood = world.gaps.stoodAt.get(body)
  if (stood === undefined) return false
  const feet = body.y + body.h
  const stop = shaft.stops.find((y) => Math.abs(stood - y) < 0.5 && feet > y - 0.5 && feet < y + LANE_SINK)
  return stop !== undefined && heldUpByHoles(currentHoles(world), body, stop)
}

function hurt(world: World, body: Person, damage: number, from: Vec): void {
  if ('state' in body) hurtGuard(world, body, damage, from, 'hazard')
  else body.hp -= damage
}

function carCenter(shaft: ElevatorShaft, y: number): Vec {
  return { x: shaft.x + shaft.w / 2, y: y - 2 }
}

/**
 * Lays the car floor across the shaft. It touches the reinforced shaft walls on both sides,
 * so the collapse system always finds it supported.
 */
function placeFloor(world: World, car: ElevatorCar, shaft: ElevatorShaft): void {
  const row = Math.round(car.y)
  for (let x = shaft.x; x < shaft.x + shaft.w; x += 1) {
    car.floorTiles.push({ x, y: row, kind: tileAt(world.grid, x, row) })
    setTile(world.grid, x, row, 'reinforced')
  }
  world.structureChanged = true
}

function removeFloor(world: World, car: ElevatorCar): void {
  for (const tile of car.floorTiles) setTile(world.grid, tile.x, tile.y, tile.kind)
  car.floorTiles = []
  world.structureChanged = true
}

function openDoors(world: World, car: ElevatorCar, shaft: ElevatorShaft): void {
  if (car.stop === null) return
  const x = doorColumn(shaft)
  const floorY = shaft.stops[car.stop]
  for (let y = floorY - DOOR_HEIGHT; y < floorY; y += 1) {
    if (tileAt(world.grid, x, y) !== 'door') continue
    setTile(world.grid, x, y, 'air')
    car.doorTiles.push({ x, y })
  }
  car.doorsOpen = true
  world.structureChanged = true
  playSound(world, 'elevator', { x: x + 0.5, y: floorY - 1.5 })
}

/** Shuts the doors. The doorway is at the back of the corridor, so whoever stands in it is simply in front of the doors. */
function closeDoors(world: World, car: ElevatorCar, shaft: ElevatorShaft): void {
  if (car.doorTiles.length === 0) {
    car.doorsOpen = false
    return
  }
  const x = doorColumn(shaft)
  for (const tile of car.doorTiles) if (tileAt(world.grid, tile.x, tile.y) === 'air') setTile(world.grid, tile.x, tile.y, 'door')
  if (car.stop !== null) clearShaftDoorway(world.grid, shaft, shaft.stops[car.stop])
  car.doorTiles = []
  car.doorsOpen = false
  playSound(world, 'elevator', { x: x + 0.5, y: car.y - 1.5 })
}

/** Bullets into the winding gear it takes to cut the cable. */
const CABLE_HITS = 6
/** The winding gear fills the top rows of the shaft, above the top stop's doors. */
const HEAD_ROWS = 2
const MAX_FALL_SPEED = 40
/** Riders survive a short drop; past this impact speed every tile per second hurts. */
const RIDER_SAFE_SPEED = 10
const RIDER_DAMAGE_PER_SPEED = 5
const CRASH_SHAKE = 0.6
const CRASH_NOISE = 40
/** Bullets already checked against the winding gear, so each counts once. */
const judged = new WeakSet<object>()

/** The middle of the winding gear at the head of the shaft. */
export function shaftHead(shaft: ElevatorShaft): Vec {
  const top = Math.min(...shaft.stops) - CAB_HEIGHT
  return { x: shaft.x + shaft.w / 2, y: top + HEAD_ROWS / 2 }
}

/**
 * Cuts a car loose: wherever it is, it drops to the bottom of the shaft with whoever is inside and crashes there.
 * Doors that stood open stay open, onto a bare shaft with its service ladder, and the car never runs again.
 */
export function cutCable(world: World, car: ElevatorCar): void {
  if (car.cut) return
  const shaft = shaftOf(world, car)
  car.cut = true
  car.fallSpeed = 0
  car.targetStop = null
  car.doorTiles = []
  car.doorsOpen = false
  const head = shaftHead(shaft)
  burst(world.effects, world.rng, head, 16, '#ffd36b', 9)
  playSound(world, 'spark', head)
  if (car.moving || car.y >= shaft.stops[0]) return
  car.riders = people(world).filter((body) => insideShaft(shaft, body) && body.y + body.h > car.y - CAB_HEIGHT && body.y + body.h < car.y + 0.3)
  car.cargo = cargoOn(world, car, shaft)
  removeFloor(world, car)
  car.moving = true
  car.stop = null
}

/** An explosion at the head of a shaft, or inside it above the car, cuts that car's cable. */
export function blastCables(world: World, at: Vec, radius: number): void {
  for (const car of world.elevatorCars) {
    if (car.cut) continue
    const shaft = shaftOf(world, car)
    const head = shaftHead(shaft)
    const inShaftAbove = at.x >= shaft.x && at.x <= shaft.x + shaft.w && at.y >= head.y && at.y <= car.y - CAB_HEIGHT
    if (inShaftAbove || Math.hypot(at.x - head.x, at.y - head.y) <= radius + 0.5) cutCable(world, car)
  }
}

/**
 * Counts new bullets whose path runs into a shaft's winding gear before anything stops them. Called before the
 * bullets move, so even one fired point-blank into the gear is counted before it hits the ceiling.
 */
export function aimAtCables(world: World): void {
  for (const shot of world.projectiles) {
    if (shot.kind !== 'bullet' || judged.has(shot)) continue
    judged.add(shot)
    for (const car of world.elevatorCars) {
      if (car.cut || !bulletReachesHead(world, shaftOf(world, car), shot)) continue
      car.cableHits = (car.cableHits ?? 0) + 1
      if (car.cableHits >= CABLE_HITS) cutCable(world, car)
    }
  }
}

function bulletReachesHead(world: World, shaft: ElevatorShaft, shot: Projectile): boolean {
  const speed = Math.hypot(shot.vx, shot.vy)
  if (speed === 0) return false
  const direction = { x: shot.vx / speed, y: shot.vy / speed }
  const top = shaftHead(shaft).y - HEAD_ROWS / 2
  const entry = rayEntersBox(shot, direction, { x: shaft.x, y: top, w: shaft.w, h: HEAD_ROWS })
  if (entry === null || entry > speed * shot.life) return false
  return castRay(world.grid, shot, direction, entry, (kind) => TILE_DEFS[kind].stopsShots) === null
}

/** How far along a ray it first enters a box, or null if it never does. */
function rayEntersBox(from: Vec, direction: Vec, box: Rect): number | null {
  let enter = 0
  let leave = Number.POSITIVE_INFINITY
  for (const [start, step, low, high] of [[from.x, direction.x, box.x, box.x + box.w], [from.y, direction.y, box.y, box.y + box.h]]) {
    if (step === 0) {
      if (start < low || start > high) return null
      continue
    }
    const t0 = (low - start) / step
    const t1 = (high - start) / step
    enter = Math.max(enter, Math.min(t0, t1))
    leave = Math.min(leave, Math.max(t0, t1))
  }
  return enter <= leave ? enter : null
}

/** A cut car drops, shoving anyone under it down the shaft, until it hits the bottom. */
function freeFall(world: World, car: ElevatorCar, shaft: ElevatorShaft, dt: number): void {
  const bottom = shaft.stops[0]
  const before = car.y
  car.fallSpeed = Math.min(MAX_FALL_SPEED, (car.fallSpeed ?? 0) + GRAVITY * dt)
  car.y = Math.min(bottom, car.y + car.fallSpeed * dt)
  sweep(world, car, shaft, before, dt)
  carryRiders(car, shaft)
  carryCargo(world, car)
  if (car.y === bottom) crash(world, car, shaft)
}

/** The car smashes into the bottom of the shaft: riders are hurt by the speed, the whole block hears and feels it. */
function crash(world: World, car: ElevatorCar, shaft: ElevatorShaft): void {
  const speed = car.fallSpeed ?? 0
  const at = carCenter(shaft, car.y)
  for (const body of car.riders) hurt(world, body, Math.max(0, speed - RIDER_SAFE_SPEED) * RIDER_DAMAGE_PER_SPEED, at)
  car.moving = false
  car.stop = 0
  placeFloor(world, car, shaft)
  releaseRiders(car)
  car.cargo = []
  world.shake = Math.min(1, world.shake + CRASH_SHAKE)
  burst(world.effects, world.rng, { x: at.x, y: car.y - 0.5 }, 24, '#ffd36b', 10)
  burst(world.effects, world.rng, { x: at.x, y: car.y - 0.5 }, 18, '#55504a', 8)
  emitNoise(world, at, CRASH_NOISE)
  playSound(world, 'collapse', at)
  playSound(world, 'impact', at)
  igniteAt(world, { x: at.x, y: car.y - 0.5 }, 0.4)
}
