/** The stealth toolkit's numbers in one place, so they can be balanced without hunting through the rules. */

export const TAKEDOWN = {
  reach: 1.6,
  /** Seconds a silent choke from behind takes; a heavy's thick neck takes longer. */
  chokeSeconds: 2.5,
  heavyChokeSeconds: 3.5,
  /** From the front, or on a man who knows you are there: a noisy wrestle. */
  struggleSeconds: 3.5,
  struggleNoise: 6,
  struggleNoiseEvery: 0.8,
  /** The snap of a quick kill carries a little. */
  killNoise: 3,
  /** Seconds a choked man stays out (a few minutes), and a punched-out one. */
  chokeOutSeconds: 180,
  punchOutSeconds: 120,
  dartOutSeconds: 150,
}

export const CARRY = {
  reach: 1.4,
  speed: 3.6,
  /** Throwing a body: how hard it leaves the shoulder. */
  throwSpeed: 7,
  throwLift: 4,
  /** A body killed by a blade bleeds this many drops while carried, one per this many tiles. */
  bloodDrops: 8,
  dropEvery: 1.4,
}

export const HIDE = {
  /** A guard who watched the player get in comes to open it; this close he does. */
  openReach: 1.5,
  /** How many hiding places a searching guard opens per stop, by tier. */
  checks: { rookie: 1, regular: 2, veteran: 4 },
  searchRadius: 6,
}

export const STARTLE = {
  /** The startled beat, seconds, by tier; officers are quicker still, and a man already hunting has almost none. */
  seconds: { rookie: 3.6, regular: 3, veteran: 1.8 },
  officer: 1.6,
  hunting: 0.3,
  /** Only a guard who meets the player this close is startled; further away the normal detection rules apply. */
  range: 2.6,
  /** A colleague this close with a clear view sees it too, and there is no window. */
  witnessRange: 9,
}

export const RADIO = {
  answerSeconds: 6,
  /** Bluffs control swallows before it sends someone anyway. */
  bluffs: 2,
  takeSeconds: 1,
}

export const DISGUISE = {
  takeSeconds: 2,
  /** Closer than this a guard looks at the face and sees through it after a moment. */
  close: 2.5,
  closeFactor: 0.6,
  /** Further off, how much a guard's eye catches: nothing when calm, a little when on edge, more once a stripped body was found. */
  calmFactor: 0,
  edgeFactor: 0.15,
  knownFactor: 0.4,
  knownSeconds: 240,
}

export const KEYCARD = { liftSeconds: 1, takeSeconds: 0.6 }

export const DART = { range: 18, dropSeconds: 3, fallNoise: 3 }

export const LURE = {
  whistleNoise: 5,
  cooldown: 1.5,
  /** Lures in one area within this long add up; on the second the guard brings a partner, on the fourth they search. */
  memory: 90,
  area: 10,
  pairAfter: 2,
  searchAfter: 4,
}

export const NOISEMAKER = { noise: 7, every: 4, switchReach: 1.5, maxUses: 2 }

export const SABOTAGE = { delay: 20, rigSeconds: 2 }

export const CAMERA_LOOP = { seconds: 90 }
