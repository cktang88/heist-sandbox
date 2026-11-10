import { playSound } from '../sounds'
import type { Vec } from '../types'
import type { World } from '../world'
import { bark, barkLine } from './barks'
import type { SecurityEvent } from './events'
import { loudnessAt } from './hearing'
import { eyeOf, feetOf, isActive, setMode, type Guard } from './model'
import { buildingAt, deviceBuilding, floorBelow, floorName } from './places'
import { reportEvent } from './report'
import { COMMS } from './tuning'

/**
 * How knowledge moves between guards. It stays with the witness until he radios it to the control room
 * (takes a few seconds and can be cut short), shouts it to colleagues in earshot (instant, but local),
 * or presses an alarm button. Radios need at least one working relay in the building.
 */

/** Radios work unless the building has relays and every one of them is out. */
export function radioWorks(world: World, at: Vec): boolean {
  const building = buildingAt(world, at)
  let relays = 0
  for (const device of world.devices) {
    if (device.kind !== 'radioRelay' || deviceBuilding(world, device) !== building) continue
    relays += 1
    if (!device.disabled) return true
  }
  return relays === 0
}

/** What the guard says into the radio. */
function callText(world: World, event: SecurityEvent): string {
  switch (event.kind) {
    case 'sighting':
      return world.security.level >= 3 ? `He's on ${floorName(world, event.at)}!` : `Control, intruder on ${floorName(world, event.at)}!`
    case 'body':
      return `Control, man down on ${floorName(world, event.at)}.`
    case 'noise':
      return event.loud ? `Control, shots fired, ${floorName(world, event.at)}.` : `Control, heard something on ${floorName(world, event.at)}.`
    case 'fault':
      return `Control, lights are out on ${floorName(world, event.at)}.`
    case 'fire':
      return `Control, fire on ${floorName(world, event.at)}!`
    default:
      return 'Control, come in.'
  }
}

/**
 * Starts radioing a report in. If the radio is dead the guard shouts instead and heads for an alarm button.
 * A guard already on the radio keeps his current call.
 */
export function startRadio(world: World, guard: Guard, event: SecurityEvent): void {
  if (guard.radio || !isActive(guard)) return
  const feet = feetOf(guard)
  if (!radioWorks(world, feet)) {
    barkLine(world, guard, 'radioDead', true)
    shout(world, guard, event)
    guard.pendingReport = event
    if (guard.mode !== 'combat' || !guard.seesPlayer) setMode(guard, 'toAlarm')
    return
  }
  const quick = world.security.level >= 3
  guard.radio = { event, seconds: quick ? COMMS.radioUpdateSeconds : COMMS.radioSeconds }
  playSound(world, 'radio', eyeOf(guard))
  bark(world, guard, callText(world, event), true)
}

/** Runs down a call in progress. It only reaches the control room if the caller lasts to the end. */
export function progressRadio(world: World, guard: Guard, dt: number): void {
  const call = guard.radio
  if (!call) return
  if (!isActive(guard) || guard.blindSeconds > 0) {
    guard.radio = null
    return
  }
  call.seconds -= dt
  if (call.seconds > 0) return
  guard.radio = null
  if (radioWorks(world, feetOf(guard))) reportEvent(world, call.event)
  else startRadio(world, guard, call.event)
}

/** Is anyone already calling this in? Saves three guards radioing the same body. */
export function alreadyCalling(world: World, kind: SecurityEvent['kind'], near: Vec): boolean {
  return world.guards.some((other) => other.radio?.event.kind === kind && 'at' in other.radio.event && Math.abs(other.radio.event.at.x - near.x) < 6 && Math.abs(other.radio.event.at.y - near.y) < 3)
}

/** Shouts what this guard knows. Colleagues who can hear it (walls muffle it) act at once; nobody else learns anything. */
export function shout(world: World, guard: Guard, event: SecurityEvent): void {
  const from = eyeOf(guard)
  playSound(world, 'shout', from)
  for (const other of world.guards) {
    if (other === guard || !isActive(other) || other.deafSeconds > 0) continue
    if (Math.abs(other.x - from.x) > COMMS.shoutRadius || Math.abs(other.y - from.y) > COMMS.shoutRadius) continue
    if (loudnessAt(world, from, eyeOf(other), COMMS.shoutRadius) <= 0) continue
    hearShout(world, other, event)
  }
}

function hearShout(world: World, guard: Guard, event: SecurityEvent): void {
  if (!('at' in event) || guard.mode === 'combat') return
  if (event.kind === 'sighting') {
    guard.lastKnown = { ...event.at }
    guard.lastKnownAt = world.clock
    guard.awareness = Math.max(guard.awareness, 0.6)
  }
  const body = event.kind === 'body'
  guard.interest = { at: floorBelow(world, event.at), kind: body ? 'body' : 'shout', priority: 7, reached: false }
  setMode(guard, 'investigating')
}
