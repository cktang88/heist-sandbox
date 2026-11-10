import { playSound } from '../sounds'
import type { World } from '../world'
import { bark, nearPlayer, pickLine } from './barks'
import { radioWorks } from './comms'
import { eyeOf, feetOf, isActive, setMode } from './model'
import { deviceBuilding, deviceFeet, roomOf, unitName } from './places'
import { log, reportEvent } from './report'
import { COMMS } from './tuning'

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
    if (guard.checkInAt === Infinity && !guard.missing) guard.checkInAt = world.clock + FIRST_CHECK_IN + ((index * STAGGER) % COMMS.checkInMax)
    if (world.clock < guard.checkInAt) return
    if (isActive(guard) && radioWorks(world, feetOf(guard))) {
      guard.checkInAt = nextCheckIn(world)
      if (nearPlayer(world, guard)) {
        bark(world, guard, `${unitName(index)}, ${pickLine(world.rng, 'checkIn').toLowerCase()}`)
        playSound(world, 'radio', eyeOf(guard))
      }
      return
    }
    guard.checkInAt = Infinity
    guard.missing = true
    security.polls.push({ guard: index, at: world.clock + COMMS.pollSeconds })
    log(world, `Control: ${unitName(index)}, check in.`)
  })

  security.polls = security.polls.filter((poll) => {
    if (world.clock < poll.at) return true
    const guard = world.guards[poll.guard]
    if (isActive(guard) && radioWorks(world, feetOf(guard))) {
      log(world, `${unitName(poll.guard)}: Sorry, Control. All quiet.`)
      guard.missing = false
      guard.checkInAt = nextCheckIn(world)
    } else {
      reportEvent(world, { kind: 'missedCheckIn', guard: poll.guard })
    }
    return false
  })
}

function nextCheckIn(world: World): number {
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

/** Guards in a room whose lights have just died notice, and go to look at the fuse box. */
export function noticeDeadCircuits(world: World): void {
  const security = world.security
  for (const circuit of world.deadCircuits) {
    if (security.circuitsNoticed.has(circuit)) continue
    const rooms = new Set(world.lamps.filter((lamp) => lamp.circuit === circuit).map((lamp) => roomOf(world, { x: lamp.x, y: lamp.y + 1 })))
    rooms.delete(undefined)
    const witness = world.guards.find((guard) => isActive(guard) && (guard.mode === 'calm' || guard.mode === 'caution') && rooms.has(roomOf(world, feetOf(guard))))
    if (!witness) continue
    security.circuitsNoticed.add(circuit)
    const fusebox = world.devices.find((device) => device.kind === 'fusebox' && device.circuit === circuit)
    witness.interest = { at: fusebox ? deviceFeet(world, fusebox) : feetOf(witness), kind: 'lightsOut', priority: 1, reached: false }
    setMode(witness, 'noticed')
  }
}
