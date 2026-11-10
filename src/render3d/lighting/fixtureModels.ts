import { Euler, Vector3, type BufferGeometry } from 'three'
import type { FixtureKind } from '../../game/site'
import { FIXTURE_SPECS } from './fixtureSpecs'
import { Parts, tint, type Tint } from './parts'

/**
 * One model per kind of fitting, built around the lamp's point (the bulb) with y up.
 * `body` is the unlit housing; `glow` holds the parts that shine in the lamp's colour (tinted per vertex: a bulb is
 * full white, a fabric shade only lets part of the light through). A `stem` is a cord, chain or pole whose length
 * depends on where the lamp is: it is one unit long, fixed at height `at` on the fitting, and gets stretched to reach
 * the ceiling above or the ground below.
 */
export type FixtureModel = {
  body: BufferGeometry
  glow: BufferGeometry
  stem?: { geometry: BufferGeometry; toward: 'ceiling' | 'ground'; at: number }
}

const DARK = tint(0x1b1e24)
const STEEL = tint(0x7d858f)
const PAINT = tint(0xd4d6d0)
const BRASS = tint(0xa07a3e)
const BLACK = tint(0x0b0c0e)
const CERAMIC = tint(0x8a7a66)
const BOARD = tint(0x121417)
/** Full light, for bulbs and tubes. */
const BULB: Tint = [1, 1, 1]
/** Light seen through cloth or frosting: warm and much dimmer than the bulb. */
const FABRIC: Tint = [0.62, 0.5, 0.36]
const FROSTED: Tint = [0.55, 0.55, 0.55]

/** The stem grows from y = 0 (its fixing on the fitting) along +y or -y for one unit. */
function stem(radius: number, color: Tint, z: number, toward: 'ceiling' | 'ground'): BufferGeometry {
  const sign = toward === 'ceiling' ? 1 : -1
  return new Parts().cylinder(0, sign * 0.5, z, radius, radius, 1, color).build()
}

function ceilingPanel(z: number): FixtureModel {
  return {
    body: new Parts().box(0, 0.165, z, 1.4, 0.07, 1.0, PAINT).box(0, 0.13, z, 1.44, 0.015, 1.04, STEEL).build(),
    glow: new Parts().box(0, 0.12, z, 1.3, 0.02, 0.9, FROSTED).build(),
  }
}

function fluorescentTube(z: number): FixtureModel {
  const across = new Euler(0, 0, Math.PI / 2)
  const body = new Parts().box(0, 0.175, z, 1.6, 0.05, 0.22, PAINT)
  for (const side of [-1, 1]) body.box(side * 0.79, 0.12, z, 0.04, 0.09, 0.2, DARK)
  const glow = new Parts()
  for (const lane of [-0.055, 0.055]) glow.cylinder(0, 0.1, z + lane, 0.03, 0.03, 1.52, BULB, false, across)
  return { body: body.build(), glow: glow.build() }
}

function downlight(z: number): FixtureModel {
  return {
    body: new Parts().cylinder(0, 0.18, z, 0.21, 0.21, 0.04, PAINT).cylinder(0, 0.155, z, 0.17, 0.19, 0.03, STEEL, true).build(),
    glow: new Parts().cylinder(0, 0.15, z, 0.15, 0.15, 0.012, BULB).build(),
  }
}

function pendant(z: number): FixtureModel {
  return {
    body: new Parts().cylinder(0, 0.05, z, 0.07, 0.3, 0.3, tint(0x24382f), true).cylinder(0, 0.215, z, 0.03, 0.03, 0.04, BRASS).build(),
    glow: new Parts().sphere(0, -0.05, z, 0.075, BULB, 1.2).cylinder(0, -0.095, z, 0.28, 0.28, 0.008, [0.3, 0.27, 0.22]).build(),
    stem: { geometry: stem(0.012, BLACK, z, 'ceiling'), toward: 'ceiling', at: 0.23 },
  }
}

function chandelier(z: number): FixtureModel {
  const body = new Parts().cylinder(0, 0.1, z, 0.035, 0.05, 0.5, BRASS).sphere(0, -0.17, z, 0.09, BRASS, 0.8)
  const glow = new Parts()
  const tier = (count: number, radius: number, y: number, turn: number) => {
    for (let arm = 0; arm < count; arm += 1) {
      const angle = turn + (arm / count) * Math.PI * 2
      const tip = new Vector3(Math.cos(angle) * radius, y, z + Math.sin(angle) * radius * 0.8)
      body.bar(new Vector3(0, y - 0.08, z), tip, 0.014, BRASS).cylinder(tip.x, y + 0.03, tip.z, 0.035, 0.025, 0.05, BRASS)
      glow.sphere(tip.x, y + 0.1, tip.z, 0.04, BULB, 1.6)
    }
  }
  tier(6, 0.55, 0, 0.3)
  tier(4, 0.3, 0.2, 0)
  // A few crystal drops catch the light.
  for (const x of [-0.3, 0, 0.3]) glow.sphere(x, -0.12, z + 0.2, 0.025, FROSTED, 1.8)
  return { body: body.build(), glow: glow.build(), stem: { geometry: stem(0.015, BRASS, z, 'ceiling'), toward: 'ceiling', at: 0.35 } }
}

function bareBulb(z: number): FixtureModel {
  return {
    body: new Parts().cylinder(0, 0.085, z, 0.03, 0.035, 0.08, BLACK).build(),
    glow: new Parts().sphere(0, -0.01, z, 0.075, BULB, 1.25).build(),
    stem: { geometry: stem(0.01, BLACK, z, 'ceiling'), toward: 'ceiling', at: 0.125 },
  }
}

function tableLamp(z: number): FixtureModel {
  return {
    body: new Parts()
      .cylinder(0, -0.435, z, 0.12, 0.13, 0.03, DARK)
      .sphere(0, -0.31, z, 0.11, CERAMIC, 1.15)
      .cylinder(0, -0.16, z, 0.018, 0.018, 0.14, BRASS)
      .build(),
    glow: new Parts().cylinder(0, 0.03, z, 0.13, 0.22, 0.26, FABRIC, true).sphere(0, -0.02, z, 0.05, BULB).build(),
  }
}

function deskLamp(z: number): FixtureModel {
  const head = new Euler(0, 0, -0.5)
  return {
    body: new Parts()
      .box(-0.1, -0.41, z, 0.26, 0.035, 0.18, DARK)
      .rod(-0.12, -0.4, -0.22, -0.1, z, 0.014, STEEL)
      .sphere(-0.22, -0.1, z, 0.025, DARK)
      .rod(-0.22, -0.1, -0.02, 0.06, z, 0.014, STEEL)
      .cylinder(0.02, 0.02, z, 0.03, 0.11, 0.15, tint(0x2b5d4a), true, head)
      .build(),
    glow: new Parts().cylinder(0.05, -0.04, z, 0.095, 0.095, 0.01, BULB, false, head).build(),
  }
}

function floorLamp(z: number): FixtureModel {
  return {
    body: new Parts()
      .cylinder(0, -1.78, z, 0.18, 0.2, 0.04, DARK)
      .cylinder(0, -0.95, z, 0.02, 0.02, 1.62, STEEL)
      .build(),
    glow: new Parts().cylinder(0, 0.02, z, 0.25, 0.27, 0.34, FABRIC, true).sphere(0, -0.04, z, 0.05, BULB).build(),
  }
}

function wallSconce(z: number): FixtureModel {
  return {
    body: new Parts()
      .box(0, -0.12, -2.37, 0.14, 0.28, 0.03, BRASS)
      .box(0, -0.13, (z - 2.37) / 2, 0.03, 0.03, Math.abs(z + 2.37), BRASS)
      .build(),
    glow: new Parts().cylinder(0, 0.02, z, 0.17, 0.08, 0.18, FABRIC, true).sphere(0, -0.02, z, 0.04, BULB).build(),
  }
}

function neon(z: number): FixtureModel {
  const glow = new Parts()
  const tube = 0.022
  // A framed sign with a zigzag inside: reads as lettering from across a room.
  glow.rod(-0.75, 0.3, 0.75, 0.3, z, tube, BULB).rod(-0.75, -0.3, 0.75, -0.3, z, tube, BULB)
  glow.rod(-0.75, -0.3, -0.75, 0.3, z, tube, BULB).rod(0.75, -0.3, 0.75, 0.3, z, tube, BULB)
  const zig: [number, number][] = [[-0.55, -0.15], [-0.32, 0.16], [-0.1, -0.15], [0.12, 0.16], [0.34, -0.15], [0.55, 0.16]]
  for (let index = 1; index < zig.length; index += 1) glow.rod(zig[index - 1][0], zig[index - 1][1], zig[index][0], zig[index][1], z, tube, BULB)
  return { body: new Parts().box(0, 0, -2.37, 1.75, 0.8, 0.03, BOARD).build(), glow: glow.build() }
}

function emergency(z: number): FixtureModel {
  return {
    body: new Parts().box(0, 0, (z - 2.37) / 2, 0.46, 0.17, Math.abs(z + 2.37) + 0.04, tint(0xcfd0c8)).build(),
    glow: new Parts()
      .box(0, -0.01, z + 0.025, 0.38, 0.1, 0.01, BULB)
      .sphere(-0.16, 0.12, z, 0.045, BULB)
      .sphere(0.16, 0.12, z, 0.045, BULB)
      .build(),
  }
}

function streetLight(z: number): FixtureModel {
  const pole = -1.6
  return {
    body: new Parts()
      .cylinder(0, 0.2, pole, 0.05, 0.07, 0.12, DARK)
      .box(0, 0.24, (pole + z) / 2, 0.06, 0.05, Math.abs(pole - z), DARK)
      .box(0, 0.08, z, 0.72, 0.12, 0.34, tint(0x2a2e35))
      .build(),
    glow: new Parts().box(0, 0.015, z, 0.62, 0.02, 0.26, BULB).build(),
    stem: { geometry: stem(0.07, DARK, pole, 'ground'), toward: 'ground', at: 0.2 },
  }
}

/** A lamp head tilted to face down and toward the lane, with its lens on the front face. */
function tiltedHead(body: Parts, glow: Parts, z: number, w: number, h: number, d: number, tilt: number): void {
  const turn = new Euler(tilt, 0, 0)
  body.box(0, 0, z, w, h, d, DARK, turn)
  const face = d / 2 + 0.006
  glow.box(0, -Math.sin(tilt) * face, z + Math.cos(tilt) * face, w * 0.86, h * 0.8, 0.01, BULB, turn)
}

function floodlight(z: number): FixtureModel {
  const body = new Parts().box(0, -0.26, (z - 1.25) / 2, 0.06, 0.06, Math.abs(z + 1.25), DARK).box(0, -0.2, z, 0.62, 0.04, 0.04, DARK)
  const glow = new Parts()
  tiltedHead(body, glow, z, 0.55, 0.38, 0.22, 0.6)
  return { body: body.build(), glow: glow.build(), stem: { geometry: stem(0.06, DARK, -1.25, 'ground'), toward: 'ground', at: -0.26 } }
}

function workLight(z: number): FixtureModel {
  const body = new Parts().rod(-0.18, 0.2, 0.18, 0.2, z, 0.012, BLACK)
  const glow = new Parts()
  tiltedHead(body, glow, z, 0.34, 0.3, 0.14, 0.4)
  // Mast and tripod legs, one unit tall, stretched to stand on the floor.
  const tripod = new Parts().cylinder(0, -0.4, z, 0.02, 0.02, 0.8, tint(0xc9a227))
  for (const [x, back] of [[-0.35, 0.2], [0.35, 0.2], [0, -0.3]]) tripod.bar(new Vector3(0, -0.7, z), new Vector3(x, -1, z + back), 0.012, BLACK)
  return { body: body.build(), glow: glow.build(), stem: { geometry: tripod.build(), toward: 'ground', at: -0.16 } }
}

const BUILDERS: Record<FixtureKind, (z: number) => FixtureModel> = {
  ceilingPanel, fluorescentTube, downlight, pendant, chandelier, bareBulb, tableLamp, deskLamp, floorLamp,
  wallSconce, neon, emergency, streetLight, floodlight, workLight,
}

const models = new Map<FixtureKind, FixtureModel>()

/** Built once per kind and shared by every lamp of that kind. */
export function fixtureModel(kind: FixtureKind): FixtureModel {
  let model = models.get(kind)
  if (!model) {
    model = BUILDERS[kind](FIXTURE_SPECS[kind].z)
    models.set(kind, model)
  }
  return model
}
