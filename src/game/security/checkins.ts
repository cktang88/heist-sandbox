import { playSound } from '../sounds'
import type { Device, World } from '../world'
import { bark, nearPlayer, pickLine } from './barks'
import { hasOwnRadio, radioWorks } from './comms'
import { eyeOf, feetOf, isActive, setMode, type Guard } from './model'
import { nearestFree } from './orders'
import { deviceBuilding, deviceFeet, floorName, roomOf, unitName } from './places'
import { log, reportEvent } from './report'
import { COMMS } from './tuning'
import { ringPocketRadio, unansweredCall } from '../stealth/radio'

/**
 * The routine that makes silent takedowns run on a clock: every guard checks in by radio on a staggered
 * schedule. A dead, stunned or cut-off guard misses his; the control room polls him, and if he still does
 * not answer it sends a pair to his post. Dead relays and dark rooms are noticed the same patient way.
 */

const FIRST_CHECK_IN = 20
const STAGGER = 7.3

export function stepCheckIns(world: World): void {
  const security = world.security
  world.guards.forEach((guard, index) => {
    if (knownDead(world, index)) {
      // Control already knows he is down: it does not ask a dead man to check in.
      Object.assign(guard, { checkInAt: Infinity, missing: true })
      return
    }
    if (guard.checkInAt === Infinity && !guard.missing) guard.checkInAt = world.clock + FIRST_CHECK_IN + ((index * STAGGER) % COMMS.checkInMax)
    if (world.clock < guard.checkInAt) return
    if (isActive(guard) && radioWorks(world, feetOf(guard)) && hasOwnRadio(world, guard)) {
      guard.checkInAt = nextCheckIn(world)
      if (nearPlayer(world, guard)) {
        bark(world, guard, `${unitName(index)}, ${pickLine(world.rng, 'checkIn').toLowerCase()}`)
        playSound(world, 'radio', eyeOf(guard))
      }
      return
    }
    guard.checkInAt = Infinity
    // The player has his radio: it crackles in the player's pocket, and he may answer for him (stealth/radio.ts).
    // Not once the man is up and about: he is missing to control, his radio stays quiet.
    if (world.stealth.radios.has(index) && !world.stealth.checkIn && !isActive(guard)) return ringPocketRadio(world, index)
    markMissing(world, index)
  })
  // A call to the pocket radio of a man who has since come round is dropped: he is missing, not answering.
  const call = world.stealth.checkIn
  if (call && isActive(world.guards[call.guard])) {
    world.stealth.checkIn = null
    markMissing(world, call.guard)
  }
  const unanswered = unansweredCall(world)
  if (unanswered !== null) markMissing(world, unanswered)

  security.polls = security.polls.filter((poll) => {
    if (knownDead(world, poll.guard)) return false
    if (world.clock < poll.at) return true
    const guard = world.guards[poll.guard]
    if (isActive(guard) && radioWorks(world, feetOf(guard)) && hasOwnRadio(world, guard)) {
      log(world, `${unitName(poll.guard)}: Sorry, Control. All quiet.`)
      guard.missing = false
      guard.checkInAt = nextCheckIn(world)
    } else {
      reportEvent(world, { kind: 'missedCheckIn', guard: poll.guard })
    }
    return false
  })
}

/** A dead man whose death the force knows about: seen or heard to fall, or his body found (nerve.ts keeps the unknown ones). */
export function knownDead(world: World, index: number): boolean {
  return world.guards[index].mode === 'dead' && !world.security.unseenDeaths.some((death) => death.victim === index)
}

/** He did not check in: control polls him, and if he still says nothing, sends a pair. */
function markMissing(world: World, index: number): void {
  world.guards[index].missing = true
  world.security.polls.push({ guard: index, at: world.clock + COMMS.pollSeconds })
  log(world, `Control: ${unitName(index)}, check in.`)
}

export function nextCheckIn(world: World): number {
  return world.clock + COMMS.checkInMin + world.rng() * (COMMS.checkInMax - COMMS.checkInMin)
}

/** A building whose every relay has been down for a while gets noticed: the control room sends someone. */
export function watchRelays(world: World): void {
  const security = world.security
  const down = new Map<string, { at: number; device: World['devices'][number] }>()
  const up = new Set<string>()
  for (const device of world.devices) {
    if (device.kind !== 'radioRelay') continue
    const building = deviceBuilding(world, device)
    if (!device.disabled) up.add(building)
    else if (!down.has(building)) down.set(building, { at: world.clock, device })
  }
  for (const [building, { device }] of down) {
    if (up.has(building)) {
      security.commsDownSince.delete(building)
      security.commsReported.delete(building)
      continue
    }
    const since = security.commsDownSince.get(building) ?? world.clock
    security.commsDownSince.set(building, since)
    if (world.clock - since < COMMS.commsFaultSeconds || security.commsReported.has(building)) continue
    security.commsReported.add(building)
    reportEvent(world, { kind: 'commsDown', at: deviceFeet(world, device) })
  }
}

/**
 * Dark rooms. A guard in a room whose lights have just died notices and goes to the fuse box (or light switch)
 * to put them back on. Nobody there to notice: the fault shows on the control room's panel after a while,
 * and the nearest free guard is sent to the box.
 */
export function noticeDeadCircuits(world: World): void {
  const security = world.security
  for (const circuit of security.circuitsDeadSince.keys()) {
    if (world.deadCircuits.has(circuit)) continue
    security.circuitsDeadSince.delete(circuit)
    security.circuitsNoticed.delete(circuit)
  }
  for (const circuit of world.deadCircuits) {
    if (security.circuitsNoticed.has(circuit)) continue
    const since = security.circuitsDeadSince.get(circuit) ?? world.clock
    security.circuitsDeadSince.set(circuit, since)
    const box = switchFor(world, circuit)
    const witness = witnessOf(world, circuit)
    const panel = world.clock - since >= COMMS.powerFaultSeconds
    const sent = witness ?? (panel && box ? nearestFree(world, deviceFeet(world, box), 1)[0] : undefined)
    if (!sent) continue
    security.circuitsNoticed.add(circuit)
    const at = box ? deviceFeet(world, box) : feetOf(sent)
    if (!witness) log(world, `Control: Power fault on ${floorName(world, at)}. Check the breaker.`)
    sent.interest = { at, kind: 'lightsOut', priority: 1, reached: false, circuit }
    setMode(sent, 'noticed')
  }
}

/** A calm guard standing in a room this circuit lights, if any. */
function witnessOf(world: World, circuit: number): Guard | undefined {
  const rooms = new Set(world.lamps.filter((lamp) => lamp.circuit === circuit).map((lamp) => roomOf(world, { x: lamp.x, y: lamp.y + 1 })))
  rooms.delete(undefined)
  if (rooms.size === 0) return undefined
  return world.guards.find((guard) => isActive(guard) && (guard.mode === 'calm' || guard.mode === 'caution') && rooms.has(roomOf(world, feetOf(guard))))
}

/** The fuse box that feeds a circuit, or failing that a light switch on it. */
function switchFor(world: World, circuit: number): Device | undefined {
  return world.devices.find((device) => device.kind === 'fusebox' && device.circuit === circuit)
    ?? world.devices.find((device) => device.kind === 'lightSwitch' && device.circuit === circuit)
}
