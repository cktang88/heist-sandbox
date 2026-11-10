import type { BufferGeometry } from 'three'
import type { ToolId } from '../../game/toolDefs'
import { HOLDS } from '../../render/human/pose'
import { Kit, type Finish } from './shapes'

/**
 * Held tools, each one merged geometry. The origin is the centre of the gripping hand, +x points down
 * the barrel and +y is the top of the gun. The fore-end of every long gun sits exactly where the pose
 * puts the support hand (`HOLDS[tool].support`).
 */
const BLACK: Finish = { color: 0x111214, rough: 0.55 }
const POLYMER: Finish = { color: 0x1c1e20, rough: 0.7 }
const STEEL: Finish = { color: 0x24272a, rough: 0.32, metal: 0.9 }
const BRIGHT_STEEL: Finish = { color: 0x9a9c9e, rough: 0.25, metal: 1 }
const TAN: Finish = { color: 0x7c6a4c, rough: 0.8 }
const OLIVE: Finish = { color: 0x4b5235, rough: 0.75 }
const GLASS: Finish = { color: 0x0c1418, rough: 0.05, metal: 0.4 }

/** Height of the bore above the grip hand for rifle-style guns. */
const BORE = 0.065
/** How far down the barrel the support hand holds the fore-end. */
const foreEnd = (tool: ToolId) => HOLDS[tool].support.x

function pistol(): Kit {
  return new Kit()
    .box(STEEL, [0.17, 0.034, 0.028], { x: 0.05, y: 0.05 })
    .box(POLYMER, [0.13, 0.024, 0.026], { x: 0.035, y: 0.026 })
    .box(POLYMER, [0.04, 0.1, 0.03], { x: -0.012, y: -0.005, rz: 0.28 })
    .box(BLACK, [0.04, 0.008, 0.02], { x: 0.03, y: 0.002 })
    .rod(STEEL, 0.006, 0.13, 0.15, 0.05)
    .rod(BLACK, 0.017, 0.14, 0.29, 0.05, 0, 10)
    .box(BLACK, [0.012, 0.01, 0.006], { x: 0.125, y: 0.071 })
}

/** Short suppressed carbine: collapsible stock, curved magazine, railed handguard and a red-dot sight. */
function rifle(): Kit {
  const along = foreEnd('rifle')
  return new Kit()
    .box(POLYMER, [0.22, 0.05, 0.03], { x: -0.19, y: BORE - 0.012, rz: 0.05 })
    .box(POLYMER, [0.035, 0.08, 0.034], { x: -0.3, y: BORE - 0.02 })
    .rod(STEEL, 0.012, -0.09, 0.0, BORE, 0, 8)
    .box(STEEL, [0.2, 0.05, 0.034], { x: 0.06, y: BORE })
    .box(POLYMER, [0.034, 0.085, 0.03], { x: -0.005, y: 0.0, rz: 0.3 })
    .box(BLACK, [0.032, 0.11, 0.024], { x: 0.105, y: -0.02, rz: -0.25 })
    .box(BLACK, [0.2, 0.046, 0.04], { x: along + 0.02, y: BORE })
    .box(STEEL, [0.2, 0.01, 0.022], { x: along + 0.02, y: BORE + 0.028 })
    .rod(STEEL, 0.009, along + 0.12, along + 0.2, BORE, 0, 8)
    .rod(BLACK, 0.019, along + 0.18, along + 0.34, BORE, 0, 10)
    .box(BLACK, [0.06, 0.035, 0.03], { x: 0.07, y: BORE + 0.048 })
    .box(GLASS, [0.008, 0.024, 0.022], { x: 0.104, y: BORE + 0.05 })
}

function shotgun(): Kit {
  const along = foreEnd('shotgun')
  return new Kit()
    .box(POLYMER, [0.27, 0.055, 0.032], { x: -0.17, y: BORE - 0.03, rz: 0.1 })
    .box(BLACK, [0.03, 0.09, 0.034], { x: -0.3, y: BORE - 0.045, rz: 0.1 })
    .box(STEEL, [0.18, 0.06, 0.034], { x: 0.05, y: BORE })
    .rod(STEEL, 0.014, 0.14, 0.68, BORE + 0.012, 0, 10)
    .rod(STEEL, 0.012, 0.14, 0.6, BORE - 0.02, 0, 10)
    .box(POLYMER, [0.13, 0.042, 0.04], { x: along, y: BORE - 0.02 })
    .box(BLACK, [0.008, 0.012, 0.006], { x: 0.66, y: BORE + 0.03 })
    .box(POLYMER, [0.034, 0.08, 0.03], { x: -0.01, y: 0.0, rz: 0.35 })
}

/** Bolt rifle with a long barrel, a big scope, a cheek riser and a folded bipod. */
function sniper(): Kit {
  const along = foreEnd('sniper')
  return new Kit()
    .box(OLIVE, [0.3, 0.06, 0.034], { x: -0.2, y: BORE - 0.02, rz: 0.06 })
    .box(OLIVE, [0.14, 0.03, 0.03], { x: -0.17, y: BORE + 0.022 })
    .box(BLACK, [0.03, 0.09, 0.034], { x: -0.36, y: BORE - 0.035, rz: 0.06 })
    .box(OLIVE, [0.034, 0.08, 0.03], { x: -0.01, y: 0.0, rz: 0.3 })
    .box(STEEL, [0.22, 0.05, 0.034], { x: 0.07, y: BORE })
    .box(OLIVE, [0.26, 0.04, 0.04], { x: along + 0.01, y: BORE - 0.012 })
    .rod(STEEL, 0.011, 0.18, 0.86, BORE, 0, 8)
    .rod(BLACK, 0.017, 0.82, 0.93, BORE, 0, 8)
    .rod(BLACK, 0.022, -0.02, 0.24, BORE + 0.07, 0, 12)
    .rod(BLACK, 0.03, 0.2, 0.27, BORE + 0.07, 0, 12)
    .rod(BLACK, 0.027, -0.05, 0.0, BORE + 0.07, 0, 12)
    .box(GLASS, [0.004, 0.044, 0.044], { x: 0.272, y: BORE + 0.07 })
    .box(BLACK, [0.02, 0.04, 0.03], { x: 0.11, y: BORE + 0.04 })
    .box(STEEL, [0.012, 0.012, 0.03], { x: 0.07, y: BORE + 0.02, z: 0.03 })
    .box(BLACK, [0.2, 0.012, 0.012], { x: along + 0.17, y: BORE - 0.04, z: 0.012 })
    .box(BLACK, [0.2, 0.012, 0.012], { x: along + 0.17, y: BORE - 0.04, z: -0.012 })
}

/** Shoulder-fired tube resting over the shoulder, with the warhead showing at the front. */
function rocket(): Kit {
  const tube = 0.13
  return new Kit()
    .rod(OLIVE, 0.052, -0.46, 0.5, tube, 0, 14)
    .rod(BLACK, 0.062, -0.5, -0.4, tube, 0, 14)
    .rod(BLACK, 0.058, 0.44, 0.5, tube, 0, 14)
    .tube(OLIVE, 0, 0.05, 0.16, { x: 0.58, y: tube, rz: -Math.PI / 2 }, 12)
    .box(POLYMER, [0.034, 0.09, 0.03], { x: 0.0, y: 0.03, rz: 0.2 })
    .box(POLYMER, [0.032, 0.1, 0.03], { x: HOLDS.rocket.support.x, y: 0.04 })
    .box(BLACK, [0.07, 0.05, 0.03], { x: 0.06, y: tube + 0.07 })
    .box(GLASS, [0.006, 0.03, 0.026], { x: 0.098, y: tube + 0.072 })
    .box(STEEL, [0.012, 0.03, 0.03], { x: 0.38, y: tube + 0.065 })
}

function drill(): Kit {
  const housing: Finish = { color: 0xc88a24, rough: 0.5 }
  return new Kit()
    .rod(housing, 0.04, -0.08, 0.13, 0.08, 0, 12)
    .box(BLACK, [0.04, 0.1, 0.035], { x: 0.0, y: 0.0, rz: 0.15 })
    .box(housing, [0.1, 0.05, 0.06], { x: -0.01, y: -0.07 })
    .box(BLACK, [0.11, 0.025, 0.064], { x: -0.01, y: -0.105 })
    .rod(BLACK, 0.026, 0.13, 0.17, 0.08, 0, 10)
    .rod(BRIGHT_STEEL, 0.007, 0.17, 0.33, 0.08, 0, 6)
    .box(BLACK, [0.025, 0.08, 0.025], { x: HOLDS.drill.support.x, y: 0.15 })
    .box(BLACK, [0.07, 0.02, 0.025], { x: HOLDS.drill.support.x - 0.03, y: 0.185 })
}

function charge(): Kit {
  return new Kit()
    .box(TAN, [0.13, 0.07, 0.05], { x: 0.02 })
    .box(BLACK, [0.014, 0.074, 0.054], { x: -0.02 })
    .box(BLACK, [0.014, 0.074, 0.054], { x: 0.06 })
    .box(POLYMER, [0.04, 0.025, 0.03], { x: 0.02, y: 0.045 })
    .box({ color: 0xc22a22, rough: 0.6 }, [0.006, 0.006, 0.07], { x: 0.035, y: 0.06, rx: 0.4 })
    .ball({ color: 0xff3020, rough: 0.2, glow: 4 }, [0.006, 0.006, 0.006], { x: 0.01, y: 0.06 }, 6)
}

function controller(): Kit {
  const along = HOLDS.drone.support.x / 2
  return new Kit()
    .box(POLYMER, [0.17, 0.022, 0.1], { x: along })
    .box({ color: 0x36d0ff, rough: 0.1, glow: 1.8 }, [0.11, 0.004, 0.07], { x: along, y: 0.013 })
    .box(BLACK, [0.008, 0.07, 0.008], { x: along + 0.06, y: 0.04, z: 0.04, rz: -0.2 })
    .box(BLACK, [0.008, 0.07, 0.008], { x: along + 0.06, y: 0.04, z: -0.04, rz: -0.2 })
}

/** Grenades sit upright in the fist: their long axis runs along the hand. */
function grenade(body: Finish, band: Finish): Kit {
  return new Kit()
    .rod(body, 0.024, -0.02, 0.08, 0)
    .rod(band, 0.025, 0.045, 0.06, 0)
    .rod(STEEL, 0.012, 0.08, 0.1, 0, 0, 8)
    .box(STEEL, [0.07, 0.006, 0.014], { x: 0.05, y: -0.026 })
    .tube(BRIGHT_STEEL, 0.012, 0.012, 0.003, { x: 0.1, y: 0.016, rx: Math.PI / 2 }, 10)
}

const BUILDERS: Record<ToolId, () => Kit> = {
  pistol, rifle, shotgun, sniper, rocket, drill,
  c4: charge,
  drone: controller,
  smoke: () => grenade(OLIVE, { color: 0xb7b7b7, rough: 0.5 }),
  flash: () => grenade({ color: 0x2b2d2f, rough: 0.45, metal: 0.6 }, { color: 0xd7c24a, rough: 0.5 }),
}

const cache = new Map<ToolId, BufferGeometry>()

export function weaponGeometry(tool: ToolId): BufferGeometry {
  let geometry = cache.get(tool)
  if (!geometry) {
    geometry = BUILDERS[tool]().build()
    cache.set(tool, geometry)
  }
  return geometry
}
