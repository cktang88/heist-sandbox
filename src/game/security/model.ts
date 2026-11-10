import type { Ragdoll } from '../ragdoll'
import type { GuardRole, GuardSpawn } from '../site'
import type { OnStairs } from '../stairs'
import type { Body, Vec } from '../types'
import type { SecurityEvent } from './events'
import { PATROL } from './tuning'

/**
 * The coarse state renderers colour guards by. `mode` holds the detailed behaviour;
 * `state` is derived from it every frame (see `stateForMode`).
 */
export type GuardState = 'patrol' | 'suspicious' | 'alert' | 'dead'

/**
 * What a guard is doing, as the player should read it:
 * calm (post or route), noticed (paused, looking), investigating (walking to a disturbance),
 * searching (sweeping around a last known position), combat, caution (heightened patrol afterwards),
 * toAlarm (radio is dead, running for an alarm button), dead.
 */
export type GuardMode = 'calm' | 'noticed' | 'investigating' | 'searching' | 'combat' | 'caution' | 'toAlarm' | 'dead'

/** Something a guard wants to look at. One at a time; newer of equal priority wins. */
export type InterestKind = 'glimpse' | 'noise' | 'gunfire' | 'body' | 'lightsOut' | 'order' | 'shout'
/** `at` is a feet position; `reached` once the guard got there and started looking; `body` is the guard index of a body. */
export type Interest = { at: Vec; kind: InterestKind; priority: number; reached: boolean; body?: number }

/** A report being spoken into the radio. Killing or stunning the guard before `seconds` runs out stops it. */
export type RadioCall = { event: SecurityEvent; seconds: number }

/** Where to look next while searching, and for how long. Points are feet positions. */
export type SearchPlan = { points: Vec[]; index: number; dwell: number; endsAt: number }

export type CombatRole = 'assault' | 'suppress' | 'flank' | 'hold' | 'fallback'

export type Guard = Body & {
  hp: number
  maxHp: number
  facing: 1 | -1
  state: GuardState
  mode: GuardMode
  /** Seconds since the mode last changed. */
  modeSeconds: number
  /** 0 = has no idea, 1 = has positively spotted the player. Shown on the HUD. */
  awareness: number
  /** Where the guard is heading or aiming. In combat this is the player's last known position, never the true one. */
  target: Vec | null
  /** Feet position of the guard's post, or the middle of his route. */
  home: Vec
  homeX: number
  /** Waypoints (feet positions) a patrol walks, and where it is along them. */
  route: Vec[]
  routeIndex: number
  /** Seconds left standing at a waypoint, looking around. */
  wait: number
  /** Ordered to hold this spot (a stair landing, a doubled post) while the site is on alert. */
  station: Vec | null
  /** A short side trip off the route (a look into the stairwell), then back. */
  detour: Vec | null
  /** The mode the guard last announced with a bark, so every change is said out loud once. */
  announced: GuardMode
  wasBlind: boolean
  /** Seconds until the guard next looks around for bodies and other evidence. */
  evidenceTimer: number
  interest: Interest | null
  /** Where this guard last saw the player (or was told he is), and when. Personal knowledge. */
  lastKnown: Vec | null
  lastKnownAt: number
  seesPlayer: boolean
  radio: RadioCall | null
  /** A report the radio could not send, to deliver by alarm button. */
  pendingReport: SecurityEvent | null
  search: SearchPlan | null
  /** Index of the guard this one is paired with and follows while searching. */
  follow: number | null
  combatRole: CombatRole
  /** The spot he is taking cover at (or holding), and whether it hides him standing. */
  cover: (Vec & { high: boolean }) | null
  replan: number
  /** Counts down from the "Contact!" bark to the first shot. */
  drawSeconds: number
  flashCooldown: number
  /** Counts down from the "Flash out!" bark to the throw. */
  flashWindup: number
  shootCooldown: number
  /** Seconds spent in combat, and seconds since the player was last seen in it. */
  alertSeconds: number
  lostSeconds: number
  /** Clock time of the next radio check-in, and whether a missed one has been reported. */
  checkInAt: number
  missing: boolean
  stunSeconds: number
  barkCooldown: number
  /** Seconds until perception runs again (calm guards far away think less often). */
  thinkTimer: number
  /** Bodies (guard indices) this guard has already seen. */
  bodiesSeen: number[]
  /** Holding low cover. */
  crouching: boolean
  /** Recoil shove, 0..1, straight after firing. */
  kick: number
  /** Seconds left of the white flash shown when hit. */
  hitFlash: number
  deadSeconds: number
  /** The limp body, once the guard is down. */
  ragdoll: Ragdoll | null
  climbing: boolean
  /** Set while climbing a staircase. */
  stairs: OnStairs | null
  role: GuardRole
  roomId: number | null
  /** How far from home a patrol walks. */
  patrolRange: number
  /** Seconds of flash blindness and deafness left. */
  blindSeconds: number
  deafSeconds: number
  /** Armoured responders arrive when the alarm rings. They take more to bring down. */
  armored: boolean
}

const BASE_HP = 100
const ARMORED_HP = 220

export function createGuard(spawn: GuardSpawn, armored = false): Guard {
  const route = spawn.route ?? []
  const home = route.length >= 2 ? { x: (route[0].x + route[route.length - 1].x) / 2, y: spawn.y } : { x: spawn.x + 0.5, y: spawn.y }
  const tough = armored || spawn.role === 'heavy'
  const hp = tough ? ARMORED_HP : BASE_HP
  return {
    x: spawn.x + 0.15, y: spawn.y - 1.6, w: 0.7, h: 1.6, vx: 0, vy: 0, onGround: false,
    hp, maxHp: hp, facing: spawn.facing, state: 'patrol', mode: 'calm', modeSeconds: 0, awareness: 0, target: null,
    home, homeX: home.x, route: route.map((point) => ({ x: point.x + 0.5, y: point.y })), routeIndex: 0, wait: route.length >= 2 ? 0 : PATROL.postTurnMin, station: null, detour: null, announced: 'calm', wasBlind: false, evidenceTimer: 0,
    interest: null, lastKnown: null, lastKnownAt: -Infinity, seesPlayer: false, radio: null, pendingReport: null, search: null, follow: null,
    combatRole: 'assault', cover: null, replan: 0, drawSeconds: 0, flashCooldown: 0, flashWindup: 0, shootCooldown: 0.4,
    alertSeconds: 0, lostSeconds: 0, checkInAt: Infinity, missing: false, stunSeconds: 0, barkCooldown: 0, thinkTimer: 0,
    bodiesSeen: [], crouching: false, kick: 0, hitFlash: 0, deadSeconds: 0, ragdoll: null, climbing: false, stairs: null,
    role: spawn.role ?? 'patrol', roomId: spawn.roomId ?? null,
    patrolRange: route.length >= 2 ? Math.abs(route[route.length - 1].x - route[0].x) / 2 : PATROL.defaultRange,
    blindSeconds: 0, deafSeconds: 0, armored: tough,
  }
}

export function feetOf(guard: Body): Vec {
  return { x: guard.x + guard.w / 2, y: guard.y + guard.h }
}

export function eyeOf(guard: Body): Vec {
  return { x: guard.x + guard.w / 2, y: guard.y + 0.35 }
}

/** Can this guard act right now (alive, not stunned)? */
export function isActive(guard: Guard): boolean {
  return guard.mode !== 'dead' && guard.stunSeconds <= 0
}

/** Changes mode and restarts the mode clock. Barks for the change are made by the brain, which sees it next frame. */
export function setMode(guard: Guard, mode: GuardMode): void {
  if (guard.mode === mode) return
  guard.mode = mode
  guard.modeSeconds = 0
  guard.state = stateForMode(mode)
}

export function stateForMode(mode: GuardMode): GuardState {
  switch (mode) {
    case 'calm':
    case 'caution':
      return 'patrol'
    case 'noticed':
    case 'investigating':
    case 'searching':
    case 'toAlarm':
      return 'suspicious'
    case 'combat':
      return 'alert'
    case 'dead':
      return 'dead'
  }
}
