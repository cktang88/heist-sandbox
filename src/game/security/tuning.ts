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
  stairCheckOdds: 0.08,
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
