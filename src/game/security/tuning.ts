/**
 * Every number that shapes how the security force behaves, in one place so it can be tuned.
 * Distances are in tiles (about 1.1 m), times in seconds. Starting values follow
 * docs/research/ai-and-systems.md (sections 1.2-1.6 and Part 4); all of them are suggestions.
 */

/** Vision. The central cone sees properly; the wide peripheral zone only catches movement. */
export const VISION = {
  centralHalfAngle: (30 * Math.PI) / 180,
  centralRange: 12,
  /** Searching and fighting guards look further and wider (torch out, weapon up). */
  alertRange: 18,
  alertHalfAngle: (60 * Math.PI) / 180,
  peripheralHalfAngle: (80 * Math.PI) / 180,
  peripheralRange: 5,
  /** Right behind a guard: only someone moving this close is felt. */
  rearRange: 1.4,
  /** In the dark, a guard only makes out someone this close (further with a torch out). */
  darkRange: 2.5,
  torchDarkRange: 5,
  /** Light bands from lightLevelAt: at or above `lit` is full light, below `dim` is dark. */
  lit: 0.5,
  dim: 0.15,
} as const

/** The awareness meter (guard.awareness, shown on the HUD) runs from 0 to 1. */
export const AWARENESS = {
  /** Seconds to fill the meter from empty when the player stands in full light in the central cone, at middle distance. */
  fillSeconds: 1.6,
  /** At this fill a guard stops and looks ("Huh?"). At 1 he has positively identified the player. */
  noticeAt: 0.3,
  /** The peripheral zone alone can never fill the meter past this: the guard must turn and look. */
  peripheralCap: 0.6,
  peripheralRate: 0.35,
  /** How fast the meter drains when nothing is seen (per second). */
  decay: 0.12,
  crouchFactor: 0.55,
  stillFactor: 0.7,
  runFactor: 1.4,
  dimFactor: 0.35,
  darkCloseFactor: 0.3,
} as const

/** How long each state lasts or waits before the next thing happens. */
export const TIMING = {
  /** Paused and facing the disturbance, before walking over. The grace period. */
  noticePause: 1.1,
  /** Looking around once at the spot. */
  lookMin: 4,
  lookMax: 7,
  /** Give up walking to something after this long. */
  investigateGiveUp: 25,
  /** Whole search, then stand down. */
  searchSeconds: 50,
  searchDwell: 2.5,
  /** Heightened patrol after a fight or search. */
  cautionSeconds: 90,
  /** From the "Contact!" bark to the first shot, so the bark always lands first. */
  drawSeconds: 1.0,
  /** No sight of the player for this long and a fighting guard goes to search the last known position. */
  lostContact: 8,
} as const

/** Patrol rhythm: predictable in structure, varied in timing. */
export const PATROL = {
  walkSpeed: 2.4,
  hurrySpeed: 4.2,
  runSpeed: 6,
  dwellMin: 2,
  dwellMax: 6,
  /** Chance per waypoint of an occasional variation: a pause halfway, or a check of the nearest stairwell. */
  pauseOdds: 0.15,
  stairCheckOdds: 0.04,
  postTurnMin: 4,
  postTurnMax: 9,
  defaultRange: 9,
} as const

/** Radio, shouting, check-ins and the control room. */
export const COMMS = {
  /** Making a report over the radio: long enough to interrupt by killing or stunning the caller. */
  radioSeconds: 3,
  /** Quick updates once everybody is already on the net (alert level 3+). */
  radioUpdateSeconds: 1.5,
  /** A colleague reported contact this recently: no need to call it in again. */
  freshReport: 6,
  shoutRadius: 12,
  checkInMin: 60,
  checkInMax: 90,
  /** A missed check-in is polled after this long before a pair is sent. */
  pollSeconds: 10,
  /** All relays in a building down for this long, and the control room notices. */
  commsFaultSeconds: 25,
  /** A dark circuit nobody saw go out shows on the control room's panel after this long, and someone is sent. */
  powerFaultSeconds: 30,
  logLines: 8,
} as const

/** Site alert levels: how long each holds without new contact before stepping down. */
export const LEVELS = {
  decaySeconds: [Infinity, 120, 180, 90, 240] as readonly number[],
  /** Level 3 held this long with fresh contact turns into lockdown. */
  lockdownAfter: 120,
  /** At most this many guards are pulled off patrol to hold stairs and posts. */
  maxStations: 10,
  respondersAtLevel3: 3,
} as const

/** Hearing: a sound of radius R is heard where R minus muffling exceeds the distance. */
export const HEARING = {
  /** Loudness lost per solid tile the sound passes through, by what it is made of. */
  wallMuffle: 4,
  doorMuffle: 3,
  glassMuffle: 1.5,
  heavyMuffle: 7,
  /** At or above this radius a sound is a gunshot or blast: solid evidence. */
  loud: 20,
  /** Below this a sound only makes a guard turn and look. */
  faint: 5,
} as const

export const COMBAT = {
  /** Only this many guards fire aimed shots at once; the rest suppress, move or hold. */
  attackTokens: 2,
  coverSearch: 9,
  /** Flee to cover below this share of health. */
  fallbackHealth: 0.35,
  aimedCooldownMin: 0.55,
  aimedCooldownMax: 1.0,
  suppressCooldown: 1.6,
  suppressSpread: 0.25,
  keepDistance: 5,
  /** The player hiding in one covered spot this long gets a flashbang from a heavy. */
  campSeconds: 6,
  flashWindup: 1.1,
  flashCooldown: 18,
  flashRange: 14,
  replanSeconds: 1.4,
} as const

export const CAMERAS = {
  range: 13,
  halfAngle: (22 * Math.PI) / 180,
  sweep: (35 * Math.PI) / 180,
  /** Downward tilt of the centre of the sweep. */
  tilt: (25 * Math.PI) / 180,
  periodSeconds: 9,
  /** Faster sweeps once the site is on edge. */
  alertPeriodSeconds: 5,
  /** Light needed for the feed to show a person. */
  minLight: 0.3,
  confirmSeconds: 0.8,
  reportCooldown: 10,
} as const

/** Level of detail: calm guards far from the player think less often. */
export const LOD = {
  nearX: 40,
  nearY: 14,
  midThink: 0.25,
  farThink: 1,
} as const

export const BARKS = {
  life: 2.4,
  cooldown: 1.2,
  maxShown: 24,
  /** Routine radio chatter is only shown near the player. */
  chatterRange: 30,
} as const

/**
 * Experience tiers. `nerve` is where a guard's nerve sits when nothing is wrong; `spread` scales his aim,
 * `draw` the time from "Contact!" to his first shot, `search` how long he looks at each spot and how many rooms he checks.
 */
export const TIERS = {
  rookie: { nerve: 0.6, spread: 1.6, draw: 1.25, search: 0.7 },
  regular: { nerve: 0.78, spread: 1, draw: 1, search: 1 },
  veteran: { nerve: 0.92, spread: 0.65, draw: 0.8, search: 1.35 },
} as const

/**
 * Nerve, 0..1: the tier's base, plus what the guard's situation gives or takes, minus the fright (`shock`)
 * left by what happened to him. Below `shaken` he will not walk into danger alone and fires blind from cover;
 * below `breaking` he falls back and calls for help; below `broken` he panics, hides or gives up.
 */
export const NERVE = {
  /** Situation is re-read this often (seconds); events add shock the moment they happen. */
  updateEvery: 0.25,
  shaken: 0.45,
  breaking: 0.28,
  broken: 0.12,
  /** Back above this, a panicking guard pulls himself together. */
  recovered: 0.35,
  /** Shock fades by this much per second, faster with colleagues around. */
  shockFade: 0.012,
  /** Situation: each colleague near (up to three), an officer or veteran near, sitting in cover. */
  perColleague: 0.05,
  officer: 0.1,
  inCover: 0.08,
  /** Situation: alone in a fight, standing in the dark, fire close by, and the share of his health lost. */
  alone: 0.12,
  dark: 0.08,
  fire: 0.12,
  wounds: 0.4,
  suppressed: 0.3,
  colleagueReach: 10,
  /** Shock from events. */
  nearMiss: 0.025,
  hit: 0.12,
  colleagueKilled: 0.22,
  colleagueKilledClose: 0.12,
  blast: 0.4,
  blastReach: 12,
  flashed: 0.15,
  grenade: 0.1,
  rocket: 0.2,
  body: 0.06,
} as const

/** Near misses, ducking, blind fire, reloading and the other things a sensible person does under fire. */
export const UNDER_FIRE = {
  /** A bullet passing this close counts as a near miss. */
  nearMissRange: 1.4,
  /** Rockets are seen and feared further off. */
  rocketRange: 7,
  suppressionPerMiss: 0.22,
  suppressionFade: 0.45,
  /** Pinned: he keeps his head down and does not fire aimed shots. */
  duckAbove: 0.55,
  /** Spread grows by this share of suppression. */
  suppressionSpread: 2,
  blindSpread: 0.28,
  blindCooldownMin: 0.35,
  blindCooldownMax: 0.8,
  /** Blind fire goes at a last known position no older than this. */
  blindFreshSeconds: 5,
  reloadSeconds: 2.2,
  /** A live grenade or charge this close makes him dive. */
  diveRange: 3.6,
  diveSeconds: 0.55,
  diveSpeed: 9,
  /** Hauling a wounded colleague: only if he is this close and badly hurt. */
  dragReach: 3,
  dragHealth: 0.4,
  dragSeconds: 2.5,
  /** No backup call more often than this, per guard. */
  backupEvery: 20,
  /** Alone means no fighting colleague this close. */
  aloneReach: 14,
} as const

/** Low nerve: hesitating at rooms, waiting for a partner, panic and surrender. */
export const FEAR = {
  /** A colleague died in a room this recently: a shaken guard stops at its edge first. */
  deathMemory: 45,
  hesitateMin: 2,
  hesitateMax: 4,
  /** How close to a room's edge he stops. */
  hesitateReach: 3,
  partnerWaitMax: 15,
  /** The player this close (and seen) when nerve breaks: he gives up rather than run. */
  surrenderRange: 7,
  /** Unwatched this long, a surrendered guard picks his weapon back up. */
  rearmSeconds: 9,
  /** The player counts as watching a surrendered guard from this close with a clear view. */
  watchRange: 12,
  /** Fleeing guards head for a security room no further than this. */
  refugeReach: 60,
} as const

/** How many guards answer each kind of trouble on their own, so one noise never pulls in the whole site. */
export const RESPONSE = {
  noise: 1,
  gunfire: 4,
  blast: 6,
  /** Responses to the same spot (this close, this recently) count together. */
  sameSpot: 10,
  forgetSeconds: 15,
  /** At or above this radius a sound is an explosion (blasts are 45), not a flashbang (40) or a shot. */
  blastRadius: 42,
  /** After an explosion is reported the site locks down this long later, once the elevators have been recalled. */
  lockdownDelay: 20,
} as const

/** Things out of place that guards notice on their rounds. */
export const DISCOVERY = {
  /** How far ahead a guard notices an open door or a picked lock on his floor. */
  doorSight: 7,
  /** A dead camera feed shows as a fault in the security room after this long. */
  cameraFaultSeconds: 25,
  /** A parachute in the sky is seen this far off. */
  chuteSight: 28,
  /** Smoke this thick ahead of him is noticed. */
  smokeSeen: 0.25,
  smokeSight: 9,
} as const
