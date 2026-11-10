import { BufferGeometry, SphereGeometry } from 'three'
import type { Look } from './looks'
import { Kit, type Finish, type Ring } from './shapes'

/** Skull and face in profile: brow, nose and cheek forward, then the jaw and chin tucking under. */
const SKULL: Ring[] = [
  { y: 0.115, front: 0.02, back: 0.025, side: 0.02 },
  { y: 0.1, front: 0.055, back: 0.07, side: 0.06 },
  { y: 0.06, front: 0.08, back: 0.095, side: 0.08 },
  { y: 0.015, front: 0.09, back: 0.097, side: 0.082 },
  { y: -0.03, front: 0.097, back: 0.088, side: 0.078 },
  { y: -0.065, front: 0.088, back: 0.07, side: 0.068, x: 0.005 },
  { y: -0.095, front: 0.078, back: 0.035, side: 0.052, x: 0.012 },
  { y: -0.115, front: 0.045, back: 0.02, side: 0.03, x: 0.02 },
]

const EYE: Finish = { color: 0x1a1310, rough: 0.3 }
const GLOSS_BLACK: Finish = { color: 0x0b0b0c, rough: 0.28 }
const GUNMETAL: Finish = { color: 0x1b1d1f, rough: 0.42, metal: 0.6 }
const SMOKED_VISOR: Finish = { color: 0x0a0d11, rough: 0.06, metal: 0.7 }

/** The upper part of a sphere, for helmet shells. */
function dome(cut: number): BufferGeometry {
  return new SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI * cut)
}

function face(kit: Kit, look: Look, ears: boolean): void {
  kit.shape(look.face, SKULL, {}, 14)
    .ball(look.face, [0.02, 0.03, 0.017], { x: 0.098, y: -0.02 }, 6)
    .tube(look.face === look.skin ? look.skin : look.top, 0.05, 0.056, 0.16, { y: -0.13, x: -0.012 }, 10)
  if (look.face === look.skin) {
    for (const z of [-0.036, 0.036]) kit.box(EYE, [0.012, 0.012, 0.022], { x: 0.088, y: 0.012, z })
    kit.box({ color: look.hair.color, rough: 0.9 }, [0.012, 0.008, 0.03], { x: 0.088, y: 0.03, z: 0.036 })
  }
  if (ears) for (const z of [-0.084, 0.084]) kit.ball(look.skin, [0.017, 0.03, 0.012], { x: -0.008, y: -0.01, z }, 6)
}

/** High-cut helmet with side rails and three-lens night-vision goggles whose lenses glow. */
function nvgHelmet(kit: Kit, look: Look): void {
  kit.add(dome(0.56), look.hat, { y: 0.02, x: -0.005, rz: 0.22, sx: 0.12, sy: 0.112, sz: 0.104 })
  for (const z of [-0.1, 0.1]) kit.box(GUNMETAL, [0.1, 0.016, 0.012], { x: -0.012, y: 0.012, z, rz: 0.2 })
  kit.box(GUNMETAL, [0.035, 0.03, 0.05], { x: 0.105, y: 0.07 })
    .box(GUNMETAL, [0.045, 0.04, 0.085], { x: 0.122, y: 0.032 })
    .box(look.hat, [0.045, 0.035, 0.065], { x: -0.112, y: 0.05 })
    .tube(GUNMETAL, 0.036, 0.036, 0.022, { y: -0.012, z: 0.092, rx: Math.PI / 2 }, 10)
  const lenses: [number, number][] = [[0.048, 0], [0.014, 0.032], [0.014, -0.032]]
  for (const [y, z] of lenses) {
    kit.rod(GUNMETAL, 0.0145, 0.12, 0.178, y, z, 8)
      .ball(look.accent, [0.006, 0.012, 0.012], { x: 0.18, y, z }, 8)
  }
}

function guardCap(kit: Kit, look: Look): void {
  kit.ball(look.hair, [0.095, 0.06, 0.084], { x: -0.03, y: 0.0 })
    .shape(look.hat, [
      { y: 0.135, front: 0.085, back: 0.095, side: 0.088 },
      { y: 0.09, front: 0.1, back: 0.108, side: 0.098 },
      { y: 0.045, front: 0.102, back: 0.108, side: 0.1 },
    ], {}, 14)
    .box(GLOSS_BLACK, [0.075, 0.01, 0.15], { x: 0.13, y: 0.05, rz: -0.18 })
    .box(look.accent, [0.008, 0.025, 0.022], { x: 0.104, y: 0.095 })
}

function officerCap(kit: Kit, look: Look): void {
  kit.ball(look.hair, [0.095, 0.055, 0.084], { x: -0.03, y: 0.0 })
    .shape(look.hat, [
      { y: 0.168, front: 0.105, back: 0.135, side: 0.12 },
      { y: 0.148, front: 0.112, back: 0.136, side: 0.125 },
      { y: 0.1, front: 0.09, back: 0.1, side: 0.096 },
      { y: 0.05, front: 0.102, back: 0.106, side: 0.1 },
    ], {}, 14)
    .shape(look.accent, [{ y: 0.085, front: 0.106, back: 0.11, side: 0.104 }, { y: 0.06, front: 0.106, back: 0.11, side: 0.104 }], {}, 14)
    .box(GLOSS_BLACK, [0.08, 0.01, 0.16], { x: 0.13, y: 0.055, rz: -0.25 })
    .box(look.accent, [0.01, 0.035, 0.035], { x: 0.112, y: 0.12 })
}

/** A floppy wide brim with loose strips hanging off it breaks up the head's outline. */
function boonie(kit: Kit, look: Look): void {
  kit.shape(look.hat, [
    { y: 0.145, front: 0.075, back: 0.085, side: 0.08 },
    { y: 0.12, front: 0.095, back: 0.1, side: 0.095 },
    { y: 0.055, front: 0.104, back: 0.108, side: 0.102 },
  ], {}, 14)
    .tube(look.hat, 0.17, 0.18, 0.014, { y: 0.055, rz: -0.08 }, 16)
  const strips: [number, number, number, number][] = [[0.17, -0.02, 0.2, 0.4], [-0.16, 0.06, -0.3, 0.7], [0.05, 0.16, 0.1, 0.2], [-0.08, -0.15, -0.2, 0.9], [-0.17, -0.06, 0.25, 0.5]]
  strips.forEach(([x, z, tilt, shade], index) => {
    const finish = index % 2 === 0 ? look.pouch : look.legs
    kit.box(finish, [0.025, 0.065 + shade * 0.04, 0.008], { x, y: 0.02, z, rz: tilt, ry: index })
  })
}

function headset(kit: Kit, look: Look): void {
  kit.ball(look.hair, [0.1, 0.075, 0.088], { x: -0.012, y: 0.045 })
  for (const z of [-0.093, 0.093]) kit.tube(look.hat, 0.036, 0.036, 0.03, { y: -0.005, z, rx: Math.PI / 2 }, 12)
  kit.box(look.hat, [0.022, 0.012, 0.19], { y: 0.122 })
    .box(look.hat, [0.022, 0.1, 0.012], { y: 0.07, z: 0.094, rx: 0.15 })
    .box(look.hat, [0.022, 0.1, 0.012], { y: 0.07, z: -0.094, rx: -0.15 })
    .box(look.hat, [0.1, 0.008, 0.008], { x: 0.05, y: -0.045, z: 0.096, rz: -0.38 })
    .ball(look.hat, [0.012, 0.012, 0.012], { x: 0.1, y: -0.064, z: 0.09 }, 6)
    .ball(look.accent, [0.006, 0.006, 0.006], { x: 0.01, y: 0.005, z: 0.11 }, 6)
}

/** Full helmet with a smoked visor, a neck flap and orange side stripes. */
function visorHelmet(kit: Kit, look: Look): void {
  kit.ball(look.hat, [0.13, 0.128, 0.12], { y: 0.03, x: -0.008 }, 14)
    .ball(SMOKED_VISOR, [0.062, 0.088, 0.108], { x: 0.078, y: -0.005 }, 14)
    .box(look.top, [0.05, 0.07, 0.19], { x: -0.1, y: -0.085 })
  for (const z of [-0.12, 0.12]) kit.box(look.accent, [0.17, 0.026, 0.01], { x: -0.03, y: 0.06, z })
}

export function buildHead(look: Look): BufferGeometry {
  const kit = new Kit()
  const bareEars = look.headgear === 'cap' || look.headgear === 'peaked' || look.headgear === 'boonie'
  face(kit, look, bareEars)
  switch (look.headgear) {
    case 'nvg': nvgHelmet(kit, look); break
    case 'cap': guardCap(kit, look); break
    case 'peaked': officerCap(kit, look); break
    case 'boonie': boonie(kit, look); break
    case 'headset': headset(kit, look); break
    case 'visor': visorHelmet(kit, look); break
  }
  return kit.build()
}
