import type { Vec } from '../types'
import type { World } from '../world'
import type { AlertLevel, SecurityEvent } from './events'
import { COMMS, RESPONSE } from './tuning'
import { broadcastContact, sendPair } from './orders'
import { floorBelow, floorName, unitName } from './places'
import { deployResponders } from './response'
import { assignStations } from './stations'

/**
 * The control room's side of a report: update the shared picture (last known position, alert level),
 * write it in the log, and send people. Levels step up on events and down on timers (see dispatch.ts).
 */

const QUIET_LOG = 30
const LEVEL_NAMES = ['all clear', 'stay sharp', 'possible intruder, posts doubled', 'intruder confirmed, response team deploying', 'lockdown, lock it all down']

/** Adds a line to the radio log, unless it would only repeat the line before it. */
export function log(world: World, line: string): void {
  const entries = world.security.log
  if (entries.at(-1)?.endsWith(` ${line}`)) return
  const minutes = Math.floor(world.clock / 60)
  const seconds = Math.floor(world.clock % 60).toString().padStart(2, '0')
  entries.push(`${minutes}:${seconds} ${line}`)
  if (entries.length > COMMS.logLines) entries.shift()
}

/** Raises the site level (never lowers it). Level 3 and up keeps the old `world.alarm` flag on. */
export function raiseLevel(world: World, to: AlertLevel): void {
  const security = world.security
  security.levelSince = world.clock
  if (to <= security.level) return
  security.level = to
  security.peak = Math.max(security.peak, to) as AlertLevel
  log(world, `Control: All units, ${LEVEL_NAMES[to]}.`)
  if (to >= 3) {
    world.alarm = true
    if (!Number.isFinite(security.confirmedAt)) security.confirmedAt = world.clock
    if (security.lastKnown) broadcastContact(world, floorBelow(world, security.lastKnown))
    deployResponders(world)
  }
  if (to >= 2) assignStations(world)
}

function contact(world: World, at: Vec): void {
  const security = world.security
  security.lastKnown = { ...at }
  security.lastContactAt = world.clock
  security.focus = floorBelow(world, at)
}

/** Tells the control room something happened. Guards, cameras and alarm buttons all report through this. */
export function reportEvent(world: World, event: SecurityEvent): void {
  const security = world.security
  switch (event.kind) {
    case 'sighting': {
      // Running updates during a fight only make the log when the intruder changes floor or after a lull.
      const before = security.lastKnown
      const update = before !== null && world.clock - security.lastContactAt < QUIET_LOG && floorName(world, before) === floorName(world, event.at)
      contact(world, event.at)
      if (!update) log(world, `${unitName(event.by)}: Contact, ${floorName(world, event.at)}.`)
      raiseLevel(world, 3)
      return
    }
    case 'camera': {
      contact(world, event.at)
      log(world, `Control: Movement on camera ${event.device + 1}, ${floorName(world, event.at)}.`)
      const before = security.level
      raiseLevel(world, before >= 2 ? 3 : 2)
      if (before < 2) sendPair(world, floorBelow(world, event.at))
      return
    }
    case 'noise':
      security.focus = floorBelow(world, event.at)
      log(world, event.loud ? `Control: Shots fired on ${floorName(world, event.at)}.` : `Control: Noise reported on ${floorName(world, event.at)}.`)
      raiseLevel(world, event.loud ? (Math.min(3, Math.max(2, security.level + 1)) as AlertLevel) : 1)
      return
    case 'body': {
      security.focus = floorBelow(world, event.at)
      const body = nearestBody(world, event.at)
      if (body !== null) security.reportedBodies.add(body)
      log(world, `${unitName(event.by)}: Man down on ${floorName(world, event.at)}.`)
      if (body !== null && world.guards[body].missing) log(world, `Control: That's ${unitName(body)}. Intruder on site.`)
      raiseLevel(world, 2)
      sendPair(world, floorBelow(world, event.at))
      return
    }
    case 'missedCheckIn': {
      const guard = world.guards[event.guard]
      log(world, `Control: ${unitName(event.guard)} is not answering. Sending a pair.`)
      security.focus = guard.home
      raiseLevel(world, 1)
      sendPair(world, guard.home)
      return
    }
    case 'alarmButton':
      contact(world, event.at)
      log(world, `Control: Alarm button on ${floorName(world, event.at)}!`)
      raiseLevel(world, 3)
      return
    case 'commsDown':
      security.focus = floorBelow(world, event.at)
      log(world, `Control: Lost the radio relay on ${floorName(world, event.at)}. Sending someone.`)
      raiseLevel(world, 1)
      sendPair(world, floorBelow(world, event.at))
      return
    case 'fault':
      security.focus = floorBelow(world, event.at)
      if (event.what === 'camera') {
        log(world, `Control: Lost a camera feed on ${floorName(world, event.at)}. Sending someone.`)
        sendPair(world, floorBelow(world, event.at))
      } else {
        log(world, `Control: Power fault on ${floorName(world, event.at)}. Noted.`)
      }
      raiseLevel(world, 1)
      return
    case 'backup':
      security.focus = floorBelow(world, event.at)
      log(world, `${unitName(event.by)}: Need backup on ${floorName(world, event.at)}!`)
      raiseLevel(world, Math.max(2, security.level) as AlertLevel)
      sendPair(world, floorBelow(world, event.at))
      return
    case 'explosion':
      // A bomb is the intruder's work: where it went off is the best idea of where he is.
      contact(world, event.at)
      log(world, `Control: Explosion on ${floorName(world, event.at)}! All units!`)
      raiseLevel(world, 3)
      security.lockdownAt = Math.min(security.lockdownAt, world.clock + RESPONSE.lockdownDelay)
      return
    case 'tamper':
      security.focus = floorBelow(world, event.at)
      log(world, event.what === 'lock' ? `Control: Copy, forced lock on ${floorName(world, event.at)}.` : `Control: Copy, open door on ${floorName(world, event.at)}.`)
      raiseLevel(world, event.what === 'lock' ? 2 : 1)
      return
    case 'vault':
      security.focus = floorBelow(world, event.at)
      log(world, `${unitName(event.by)}: The vault's been hit!`)
      raiseLevel(world, 3)
      security.lockdownAt = Math.min(security.lockdownAt, world.clock + RESPONSE.lockdownDelay)
      return
    case 'parachute':
      contact(world, event.at)
      log(world, `Control: Parachute reported over ${floorName(world, event.at)}.`)
      raiseLevel(world, Math.max(2, security.level) as AlertLevel)
      sendPair(world, floorBelow(world, event.at))
      return
    case 'fire':
      reportFire(world, event.at, event.alarm)
      return
  }
}

/**
 * A fire is trouble but not a sighting: it says nothing about where an intruder is, so it never moves the
 * last known position or confirms anyone. The fire alarm makes the site suspect sabotage (level 2, which
 * also recalls the elevators as a real fire alarm would) and sends a pair; a guard's own report only puts
 * the site on edge, since he is already looking at it.
 */
function reportFire(world: World, at: Vec, alarm: boolean): void {
  const security = world.security
  security.focus = floorBelow(world, at)
  log(world, alarm ? `Control: Fire alarm on ${floorName(world, at)}. Send someone.` : `Control: Fire on ${floorName(world, at)}, copy.`)
  raiseLevel(world, alarm ? 2 : 1)
  if (alarm) sendPair(world, floorBelow(world, at))
}

function nearestBody(world: World, at: Vec): number | null {
  let best: number | null = null
  let bestGap = 4
  world.guards.forEach((guard, index) => {
    if (guard.mode !== 'dead' || !guard.ragdoll) return
    const hip = guard.ragdoll.points[2]
    const gap = Math.hypot(hip.x - at.x, hip.y - at.y)
    if (gap < bestGap) {
      best = index
      bestGap = gap
    }
  })
  return best
}
