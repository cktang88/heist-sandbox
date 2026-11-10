import type { World } from '../world'
import { expireBarks } from './barks'
import { shotAt } from './brain'
import { indexDoors, noteBurningDoors, noticeShotLamps, watchCameraFeeds } from './discoveries'
import { watchIncomingFire } from './nerve'
import { stepCameras } from './cameras'
import { noticeDeadCircuits, stepCheckIns, watchRelays } from './checkins'
import type { AlertLevel } from './events'
import { log, raiseLevel } from './report'
import { organiseSquad } from './squad'
import { forgetSpentFrags } from './guardFrags'
import { indexPanes } from './intrusions'
import { rememberOrigins } from './oddities'
import { considerShieldTeam } from './shieldTeam'
import { confirmMissingCase } from './caseCheck'
import { assignStations } from './stations'
import { FEAR, LEVELS, RESPONSE } from './tuning'

/**
 * The security force as an organisation: the control room (dispatcher) that holds the one shared picture
 * of the intruder, the site alert level, check-ins, cameras and the squad layer over fighting guards.
 * Guards only know what they saw, heard or were told; the control room only knows what was reported.
 */
export type { AlertLevel, Bark, SecurityEvent, SecurityState } from './events'
export { createSecurity } from './events'
export { reportEvent } from './report'
export { cameraView, type CameraView } from './cameras'
export { elevatorsRecalled, isLockedDown } from './levels'

const SLOW_CHECKS_PER_SECOND = 2
const RESTATION_SECONDS = 20
const LOCKDOWN_CONTACT = 30

export function stepSecurity(world: World, dt: number): void {
  const security = world.security
  indexDoors(world)
  indexPanes(world)
  rememberOrigins(world)
  expireBarks(world, dt)
  forgetSpentFrags(world)
  // Something else (a tripped sensor, an old code path) rang the alarm: that is a confirmed intruder.
  if (world.alarm && security.level < 3) raiseLevel(world, 3)
  stepLevel(world)
  if (security.level >= 3) world.alarm = true

  stepCheckIns(world)
  if (Math.floor(world.clock * SLOW_CHECKS_PER_SECOND) !== Math.floor((world.clock - dt) * SLOW_CHECKS_PER_SECOND)) {
    watchRelays(world)
    noticeDeadCircuits(world)
    watchCameraFeeds(world)
    noticeShotLamps(world)
    noteBurningDoors(world)
    forgetOldTrouble(world)
    considerShieldTeam(world)
    confirmMissingCase(world)
  }
  watchIncomingFire(world, dt, shotAt)
  stepCameras(world, dt)
  organiseSquad(world, dt)
  if (security.level >= 2 && world.clock - security.stationsAt > RESTATION_SECONDS) assignStations(world)
}

/** Steps up to lockdown when an alert drags on, and down one level at a time after a quiet spell, never back to normal once raised. */
function stepLevel(world: World): void {
  const security = world.security
  const recentContact = world.clock - security.lastContactAt < LOCKDOWN_CONTACT
  const dragging = security.level === 3 && world.clock - security.confirmedAt > LEVELS.lockdownAfter
  const bombed = security.level === 3 && world.clock >= security.lockdownAt
  if (bombed || (security.level === 3 && recentContact && (dragging || world.player.hasLoot))) {
    security.lockdownAt = Infinity
    raiseLevel(world, 4)
    return
  }
  if (world.clock - security.levelSince <= LEVELS.decaySeconds[security.level]) return
  if (security.level <= levelFloor(security.peak)) return
  security.level = (security.level - 1) as AlertLevel
  security.levelSince = world.clock
  log(world, `Control: Stepping down to level ${security.level}. Stay sharp.`)
  if (security.level < 3) {
    world.alarm = false
    security.confirmedAt = -Infinity
    security.responseSent = false
    security.lockdownAt = Infinity
  }
  if (security.level < 2) assignStations(world)
}

/** Responses and deaths are only worth remembering for a while. */
function forgetOldTrouble(world: World): void {
  const security = world.security
  security.responses = security.responses.filter((response) => world.clock - response.clock < RESPONSE.forgetSeconds)
  security.deaths = security.deaths.filter((death) => world.clock - death.clock < FEAR.deathMemory)
}

/** What the guards will not forget: once anything happened the site stays uneasy, and after a confirmed intruder, suspicious. */
export function levelFloor(peak: AlertLevel): AlertLevel {
  if (peak >= 3) return 2
  return peak >= 1 ? 1 : 0
}
