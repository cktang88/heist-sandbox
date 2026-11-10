import type { GuardRole } from '../../game/site'
import type { ToolId } from '../../game/toolDefs'
import type { Finish } from './shapes'

/** Which outfit a figure wears. Each reads at a glance by its head shape, bulk and colour blocking. */
export type Outfit = 'operative' | 'guard' | 'sentry' | 'officer' | 'operator' | 'responder'

export type Headgear = 'nvg' | 'cap' | 'peaked' | 'boonie' | 'headset' | 'visor'
export type Vest = 'carrier' | 'rig' | 'armour' | null

/** Everything that differs between outfits. Body parts are built from this once and shared. */
export type Look = {
  /** Width multiplier for torso and limbs: armour and padding make a figure wider. */
  bulk: number
  skin: Finish
  /** The face: bare skin, or a balaclava. */
  face: Finish
  top: Finish
  sleeves: 'long' | 'short'
  legs: Finish
  boots: Finish
  gloves: Finish | null
  belt: Finish
  vest: Vest
  vestFinish: Finish
  pouch: Finish
  strap: Finish
  headgear: Headgear
  hat: Finish
  hair: Finish
  /** One accent per role: badge gold, goggle green, warning orange. */
  accent: Finish
  kneePads: boolean
  shoulderPads: boolean
  /** Assault pack with a radio antenna, or a small radio on the shoulder. */
  pack: 'assault' | 'radio' | null
  tie: boolean
}

const cloth = (color: number, rough = 0.88): Finish => ({ color, rough })
const hard = (color: number, rough = 0.5): Finish => ({ color, rough })
const metal = (color: number, rough = 0.38): Finish => ({ color, rough, metal: 1 })

const BLACK_WEBBING = cloth(0x141516, 0.8)
const POLISHED = hard(0x0d0d0e, 0.32)

export const LOOKS: Record<Outfit, Look> = {
  // Dark, low-contrast and compact, with the goggles as the only bright point.
  operative: {
    bulk: 1, skin: cloth(0x9c7a62, 0.6), face: cloth(0x1d1f22, 0.92), top: cloth(0x2b2f34), sleeves: 'long', legs: cloth(0x272a2e),
    boots: hard(0x161616, 0.62), gloves: cloth(0x1b1c1d, 0.75), belt: BLACK_WEBBING, vest: 'carrier', vestFinish: cloth(0x3b4034, 0.92),
    pouch: cloth(0x4f4232, 0.92), strap: BLACK_WEBBING, headgear: 'nvg', hat: hard(0x34382f, 0.62), hair: cloth(0x1d1f22),
    accent: { color: 0x39ff6a, rough: 0.1, glow: 7 }, kneePads: true, shoulderPads: false, pack: 'assault', tie: false,
  },
  // A light shirt and dark trousers: the bright torso makes a guard easy to spot in a lit room.
  guard: {
    bulk: 1.04, skin: cloth(0xc49478, 0.6), face: cloth(0xc49478, 0.6), top: cloth(0x9fb5cf, 0.8), sleeves: 'short', legs: cloth(0x1f2a3e),
    boots: POLISHED, gloves: null, belt: hard(0x101010, 0.45), vest: null, vestFinish: cloth(0x1f2a3e),
    pouch: hard(0x141414, 0.5), strap: cloth(0x1f2a3e), headgear: 'cap', hat: cloth(0x1a2338, 0.75), hair: cloth(0x3a2a1e),
    accent: metal(0xd9b54a, 0.32), kneePads: false, shoulderPads: false, pack: 'radio', tie: true,
  },
  // Field kit for a watcher: olive and tan, a ragged boonie brim and a chest rig.
  sentry: {
    bulk: 1.02, skin: cloth(0xb5876a, 0.6), face: cloth(0xb5876a, 0.6), top: cloth(0x56603f), sleeves: 'long', legs: cloth(0x6a6447),
    boots: hard(0x3a2c20, 0.7), gloves: cloth(0x6d5c43, 0.85), belt: cloth(0x3d3a2a), vest: 'rig', vestFinish: cloth(0x4a4f36, 0.92),
    pouch: cloth(0x7d6a48, 0.92), strap: cloth(0x3d3a2a), headgear: 'boonie', hat: cloth(0x72694a, 0.95), hair: cloth(0x3a2a1e),
    accent: { color: 0x9fd8ff, rough: 0.1, glow: 1.5 }, kneePads: false, shoulderPads: false, pack: null, tie: false,
  },
  // Upright and clean: a dark jacket with gold buttons and epaulettes under a peaked cap.
  officer: {
    bulk: 1.02, skin: cloth(0xcfa085, 0.6), face: cloth(0xcfa085, 0.6), top: cloth(0x34443e, 0.72), sleeves: 'long', legs: cloth(0x23292a, 0.75),
    boots: POLISHED, gloves: null, belt: hard(0x0f0f0f, 0.4), vest: null, vestFinish: cloth(0x34443e),
    pouch: hard(0x141414, 0.45), strap: cloth(0x34443e), headgear: 'peaked', hat: cloth(0x27332f, 0.7), hair: cloth(0x2b2018),
    accent: metal(0xd8b450, 0.3), kneePads: false, shoulderPads: false, pack: null, tie: true,
  },
  // Camera-room staff: a pale polo, a lanyard and a headset; no long gun.
  operator: {
    bulk: 1.0, skin: cloth(0xa87a5c, 0.6), face: cloth(0xa87a5c, 0.6), top: cloth(0xb7bbc2, 0.82), sleeves: 'short', legs: cloth(0x2c2f35),
    boots: hard(0x1c1c1c, 0.55), gloves: null, belt: hard(0x161616, 0.5), vest: null, vestFinish: cloth(0x2c2f35),
    pouch: hard(0x161616, 0.5), strap: cloth(0xb8322c, 0.7), headgear: 'headset', hat: hard(0x121314, 0.45), hair: cloth(0x24180f),
    accent: { color: 0xff4436, rough: 0.2, glow: 3 }, kneePads: false, shoulderPads: false, pack: null, tie: false,
  },
  // The widest silhouette: matte black, heavy grey plates, a smoked visor and an orange stripe.
  responder: {
    bulk: 1.2, skin: cloth(0xb08066, 0.6), face: cloth(0x141618, 0.9), top: cloth(0x17191b, 0.92), sleeves: 'long', legs: cloth(0x1b1d20, 0.92),
    boots: hard(0x111111, 0.6), gloves: cloth(0x121314, 0.8), belt: BLACK_WEBBING, vest: 'armour', vestFinish: hard(0x2d3136, 0.55),
    pouch: cloth(0x1e2023, 0.9), strap: BLACK_WEBBING, headgear: 'visor', hat: hard(0x222528, 0.45), hair: cloth(0x141618),
    accent: { color: 0xe0501e, rough: 0.6, glow: 0.35 }, kneePads: true, shoulderPads: true, pack: null, tie: false,
  },
}

/** The outfit for a guard of a given role. Responders called in by the alarm wear armour whatever their post. */
export function outfitFor(role: GuardRole, armored: boolean): Outfit {
  if (armored || role === 'heavy') return 'responder'
  if (role === 'sentry' || role === 'officer' || role === 'operator') return role
  return 'guard'
}

/** What each role has in hand. Operators keep only a sidearm, holstered until something is wrong. */
export function weaponFor(role: GuardRole, armored: boolean, alert = true): ToolId | null {
  if (role === 'heavy') return 'shotgun'
  if (armored || role === 'post') return 'rifle'
  if (role === 'sentry') return 'sniper'
  if (role === 'operator' && !alert) return null
  return 'pistol'
}
