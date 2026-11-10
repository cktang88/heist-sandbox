import type { Ragdoll } from '../ragdoll'
import type { GuardRole, GuardSpawn } from '../site'
import type { OnStairs } from '../stairs'
import type { Body, Vec } from '../types'
import type { SecurityEvent, Tamper } from './events'
import { PATROL, TIERS } from './tuning'

/**
 * The coarse state renderers colour guards by. `mode` holds the detailed behaviour;
 * `state` is derived from it every frame (see `stateForMode`).
 */
export type GuardState = 'patrol' | 'suspicious' | 'alert' | 'dead'

/**
 * What a guard is doing, as the player should read it:
 * calm (post or route), noticed (paused, looking), investigating (walking to a disturbance),
 * searching (sweeping around a last known position), combat, caution (heightened patrol afterwards),
 * toAlarm (radio is dead, running for an alarm button), panic (nerve gone: fleeing to a security room, or cowering there),
 * surrendered (weapon dropped, hands up), dead.
 */
export type GuardMode = 'calm' | 'noticed' | 'investigating' | 'searching' | 'combat' | 'caution' | 'toAlarm' | 'panic' | 'surrendered' | 'dead'

/** Experience: how steady a guard's nerve is, how fast and straight he shoots and how carefully he searches. See TIERS in tuning.ts. */
export type Tier = 'rookie' | 'regular' | 'veteran'

/** How a flashed guard copes: a steady one fires wild down the line he faced, a shaken one stumbles about, a frightened one covers his face. */
export type BlindReaction = 'wild' | 'stumble' | 'cover'

/** Something a guard wants to look at. One at a time; newer of equal priority wins. */
export type InterestKind = 'glimpse' | 'noise' | 'gunfire' | 'body' | 'lightsOut' | 'fire' | 'order' | 'shout' | 'tamper' | 'smoke'
/**
 * `at` is a feet position; `reached` once the guard got there and started looking; `body` is the guard index of a body;
 * `circuit` is the dead lighting circuit a 'lightsOut' interest is about, which he switches back on when he gets there;
 * `canister` marks smoke that came from a grenade (he saw it pouring), which means somebody threw it;
 * `tamper` says whether a 'tamper' interest is a door left open, a lock picked or a rope (which he cuts when he gets to its knot).
 */
export type Interest = { at: Vec; kind: InterestKind; priority: number; reached: boolean; body?: number; circuit?: number; tamper?: Tamper; canister?: boolean }

/** A report being spoken into the radio. Killing or stunning the guard before `seconds` runs out stops it. */
export type RadioCall = { event: SecurityEvent; seconds: number }

/** Where to look next while searching, and for how long. Points are feet positions. */
export type SearchPlan = { points: Vec[]; index: number; dwell: number; endsAt: number }

/** `stack`: one of a shield team moving as a column behind the man with the shield (see shieldTeam.ts). */
export type CombatRole = 'assault' | 'suppress' | 'flank' | 'hold' | 'fallback' | 'stack'

/**
 * A place to fight from that the shooter's rounds cannot reach (`hidden`; false means only somewhere out of the way, the best
 * he could find), whether he must kneel there, and `peek`: where he stands up (or steps out) to fire back, if anywhere.
 * `from` is the shooter's position it was chosen against. `spent`: he got there and it still leaves him in the open, so
 * sheltering has nothing more to offer and his squad role takes over again. `waits` counts the seconds he has sat in it unable to fire.
 */
export type Shelter = Vec & { hidden: boolean; crouch: boolean; peek: Vec | null; from: Vec; spent: boolean; waits: number }

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
  tier: Tier
  /** 0 (broken) to 1 (steady). The tier's base, plus or minus his situation, minus `shock`. See nerve.ts. */
  nerve: number
  /** Fright from what has happened to him (shots, wounds, deaths, blasts). Fades slowly. */
  shock: number
  /** 0..1 from bullets cracking past: he ducks and aims worse. Fades in a couple of seconds. */
  suppression: number
  nerveTimer: number
  /** Clock time a bullet last cracked past him, so one burst is not counted many times over. */
  nearMissAt: number
  /** Rounds left in the magazine, and seconds left of a reload. */
  rounds: number
  reloadSeconds: number
  /** Seconds left of a dive away from a grenade. */
  diveSeconds: number
  /** Seconds left waiting at the edge of a room before going in, and the room he has already steeled himself for. */
  hesitateSeconds: number
  hesitatedRoom: number | null
  /** Seconds spent waiting for a partner before walking into something dangerous. */
  partnerWait: number
  /** Clock time he last radioed for backup. */
  backupAt: number
  /** Firing blind from cover at the last known position, without looking. */
  blindFiring: boolean
  /** Covering-and-moving: set while he is the one moving; `boundSince` says who started first. */
  bounding: boolean
  boundSince: number
  /** A colleague (guard index) hauling this wounded guard out of the line of fire, and for how much longer. */
  draggedBy: number | null
  dragSeconds: number
  blindReaction: BlindReaction | null
  /** Where he dropped his weapon when he gave up; null while he holds it. */
  droppedWeapon: Vec | null
  /** Seconds a surrendered guard has gone unwatched; long enough and he goes for his weapon. */
  unwatchedSeconds: number
  /** Tied up by the player: out of the game for good, but alive. */
  restrained: boolean
  /** Which way his weapon points, as a unit vector (y down): straight up at a hole in the ceiling is (0, -1). For renderers. */
  aim: Vec
  /** Clock time he last heard the intruder's gun with a clear idea where it was, and last had rounds come his way (or saw a colleague hit). */
  heardAt: number
  underFireAt: number
  /** Where he is sheltering from fire, and whether he is up and firing from it right now (`peeking`, for renderers). */
  shelter: Shelter | null
  peeking: boolean
  /** Counts down the current duck or peek. */
  peekSeconds: number
  /** Carries a ballistic shield: rounds from in front stop on it (see shieldTeam.ts). For renderers. */
  shield: boolean
  /** In a shield team's column: the guard index of the man with the shield he follows (his own index for the shield man), and his place in it (0 is the shield). */
  stackLeader: number | null
  stackSlot: number
  /** Clock time he last threw a grenade to clear a spot before going through it. */
  clearedAt: number
  /**
   * The hole in the floor (column, slab row) he is about to drop through, when he has done softening up the room below,
   * and whether he did it with a flashbang (otherwise he fires down until then).
   */
  dropPrep: { x: number; y: number; readyAt: number; flashed: boolean } | null
  /** What he decided to do about the furniture-blocked door he last walked into (blockedDoors.ts). */
  doorPlan: DoorPlan | null
  /** A barricaded door (tile) a colleague has called him, a heavy, to breach. */
  breachAt: Vec | null
  /** Since when a colleague has stood in his line of fire at the man he can see (Infinity while his line is clear). */
  lineBlockedSince: number
  /** Knocked out cold (choked, darted, punched out): limp on the floor as a ragdoll until `stunSeconds` runs out. */
  out: boolean
  /** Stuffed into a hiding place (the prop id) by the player: nobody sees him until someone opens it. */
  hiddenIn: number | null
  /** Caught off guard by the intruder at arm's length: frozen for `seconds` before he shouts, radios or fights (startle.ts). */
  startle: Startle | null
}

/** The beat between a lone guard walking into the intruder and doing something about it. `total` is the window he was given. */
export type Startle = { seconds: number; total: number }

/**
 * A guard's decision at a door held shut by furniture: go `around` it by other stairs (walking `waypoints` in turn),
 * `shove` it open, or, in a fight, `breach` it. `side` is the side of the door he wants to get to, on floor `floorY`.
 */
export type DoorPlan = {
  key: string
  door: Vec
  floorY: number
  side: number
  choice: 'around' | 'shove' | 'breach'
  waypoints: Vec[]
  index: number
  since: number
}

const BASE_HP = 100
const ARMORED_HP = 220

export function createGuard(spawn: GuardSpawn, armored = false): Guard {
  const route = spawn.route ?? []
  const home = route.length >= 2 ? { x: (route[0].x + route[route.length - 1].x) / 2, y: spawn.y } : { x: spawn.x + 0.5, y: spawn.y }
  const tough = armored || spawn.role === 'heavy'
  const hp = tough ? ARMORED_HP : BASE_HP
  const tier = tierFor(spawn, tough)
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
    tier, nerve: TIERS[tier].nerve, shock: 0, suppression: 0, nerveTimer: 0, nearMissAt: -Infinity,
    rounds: magazineOf(tough), reloadSeconds: 0, diveSeconds: 0, hesitateSeconds: 0, hesitatedRoom: null, partnerWait: 0, backupAt: -Infinity,
    blindFiring: false, bounding: false, boundSince: 0, draggedBy: null, dragSeconds: 0, blindReaction: null, droppedWeapon: null, unwatchedSeconds: 0, restrained: false,
    aim: { x: spawn.facing, y: 0 }, heardAt: -Infinity, underFireAt: -Infinity, shelter: null, peeking: false, peekSeconds: 0,
    shield: false, stackLeader: null, stackSlot: 0, clearedAt: -Infinity, dropPrep: null, doorPlan: null, breachAt: null, lineBlockedSince: Infinity,
    out: false, hiddenIn: null, startle: null,
  }
}

/**
 * Responders, heavies and officers are veterans; operators and sentries are steady regulars; the rest are a mix,
 * picked from the spawn position so the same site always has the same people.
 */
function tierFor(spawn: GuardSpawn, tough: boolean): Tier {
  if (tough || spawn.role === 'officer') return 'veteran'
  if (spawn.role === 'operator' || spawn.role === 'sentry') return 'regular'
  const roll = Math.abs(Math.floor(spawn.x) * 31 + Math.floor(spawn.y) * 17) % 10
  return roll < 3 ? 'rookie' : roll < 8 ? 'regular' : 'veteran'
}

/** Rifles for the armoured, pistols for everyone else. */
export function magazineOf(armored: boolean): number {
  return armored ? 30 : 15
}

export function feetOf(guard: Body): Vec {
  return { x: guard.x + guard.w / 2, y: guard.y + guard.h }
}

export function eyeOf(guard: Body): Vec {
  return { x: guard.x + guard.w / 2, y: guard.y + 0.35 }
}

/** Can this guard act right now (alive, not stunned, not given up)? */
export function isActive(guard: Guard): boolean {
  return guard.mode !== 'dead' && guard.mode !== 'surrendered' && guard.stunSeconds <= 0 && !guard.out
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
    case 'panic':
    case 'surrendered':
      return 'suspicious'
    case 'combat':
      return 'alert'
    case 'dead':
      return 'dead'
  }
}
