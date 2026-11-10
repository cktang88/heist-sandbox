import { Color, DoubleSide, Group, InstancedBufferAttribute, InstancedMesh, MeshBasicMaterial, MeshStandardMaterial, type BufferGeometry, type Material } from 'three'
import type { FixtureKind, Lamp } from '../game/site'
import { isSolidAt, type Grid } from '../game/tiles'
import type { World } from '../game/world'
import { DRAW_DISTANCE, type Frame, type LayerFactory } from './layer'
import { inAlarm, lampBrightness } from './lighting/brightness'
import { fixtureModel, type FixtureModel } from './lighting/fixtureModels'
import { FIXTURE_SPECS } from './lighting/fixtureSpecs'
import { lampGridFor } from './lighting/lampGrid'

/** Every housing shares one material, coloured per vertex; every glowing part shares another, coloured per lamp. */
const HOUSING = new MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.35 })
const GLASS = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide, fog: false })
/** What an unlit bulb or shade looks like: dull grey glass. */
const DEAD_GLASS = 0.03
/** Fittings within this margin outside the view are kept, so nothing pops in at the screen edge. */
const MARGIN = 6
/** The most fittings that can be near the view at once. */
const MAX_NEAR = 512
/** How far a cord or pole may reach before we give up looking for a ceiling or the ground, in tiles. */
const STEM_SEARCH = 12

type KindMeshes = { body: InstancedMesh; glow: InstancedMesh; stem: InstancedMesh | null; count: number }

function instanced(geometry: BufferGeometry, material: Material, capacity: number, withColor: boolean): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, capacity)
  if (withColor) mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3)
  // The layer culls by view itself, and the instances change every time the view moves.
  mesh.frustumCulled = false
  mesh.receiveShadow = !withColor
  mesh.count = 0
  return mesh
}

/** Distance from the stem's fixing point to the first solid tile above (ceiling) or below (ground), in tiles. */
function stemLength(grid: Grid, lamp: Lamp, stem: NonNullable<FixtureModel['stem']>): number {
  const fixing = lamp.y - stem.at
  const step = stem.toward === 'ceiling' ? -1 : 1
  for (let reach = 0; reach < STEM_SEARCH; reach += 1) {
    const row = Math.floor(fixing) + step * reach
    if (!isSolidAt(grid, lamp.x, row)) continue
    // A ceiling's underside is the bottom of its row; the ground's top is the top of its row.
    return Math.max(0.02, stem.toward === 'ceiling' ? fixing - (row + 1) : row - fixing)
  }
  return 0.3
}

/** Writes a translation (with an optional vertical stretch) into slot `slot` of an instance matrix buffer. */
function place(mesh: InstancedMesh, slot: number, x: number, y: number, stretch = 1): void {
  const m = mesh.instanceMatrix.array as Float32Array
  const at = slot * 16
  m.fill(0, at, at + 16)
  m[at] = 1
  m[at + 5] = stretch
  m[at + 10] = 1
  m[at + 12] = x
  m[at + 13] = y
  m[at + 15] = 1
}

/** The light fittings themselves: a model per kind of fitting whose bulbs, tubes and shades glow while lit. */
export const createFixturesLayer: LayerFactory = (world) => {
  const group = new Group()
  const lamps = world.lamps
  const grid = lampGridFor(lamps)
  const kinds = new Map<FixtureKind, KindMeshes>()
  for (const lamp of lamps) {
    const entry = kinds.get(lamp.fixture)
    if (entry) entry.count += 1
    else kinds.set(lamp.fixture, { body: null!, glow: null!, stem: null, count: 1 })
  }
  for (const [kind, entry] of kinds) {
    const model = fixtureModel(kind)
    entry.body = instanced(model.body, HOUSING, entry.count, false)
    entry.glow = instanced(model.glow, GLASS, entry.count, true)
    entry.stem = model.stem ? instanced(model.stem.geometry, HOUSING, entry.count, false) : null
    group.add(entry.body, entry.glow)
    if (entry.stem) group.add(entry.stem)
  }

  // Lamp colours in linear light, worked out once.
  const linear = new Float32Array(lamps.length * 3)
  const color = new Color()
  lamps.forEach((lamp, index) => {
    color.setHex(lamp.color)
    linear.set([color.r, color.g, color.b], index * 3)
  })
  const stems = new Float32Array(lamps.length).fill(-1)
  let stemsVersion = -1
  const near = new Int32Array(MAX_NEAR)
  const shown = new Float32Array(lamps.length).fill(-1)
  /** A cheap fingerprint of last frame's nearby set, so an unchanged view costs no rebuild. */
  let lastSet = -1
  let stale = true

  function stemOf(index: number, world: World): number {
    const stem = fixtureModel(lamps[index].fixture).stem
    if (!stem) return 0
    if (stems[index] < 0) stems[index] = stemLength(world.grid, lamps[index], stem)
    return stems[index]
  }

  function rebuild(count: number, world: World, alarm: boolean): void {
    for (const entry of kinds.values()) entry.glow.count = 0
    for (let at = 0; at < count; at += 1) {
      const index = near[at]
      const lamp = lamps[index]
      const entry = kinds.get(lamp.fixture)!
      const level = lampBrightness(world, lamp, index, alarm)
      shown[index] = level
      // A fitting shot down is drawn falling by the systems layer; it is no longer on the ceiling.
      if (world.systems.dropped.has(lamp)) continue
      const slot = entry.glow.count
      place(entry.body, slot, lamp.x, -lamp.y)
      place(entry.glow, slot, lamp.x, -lamp.y)
      if (entry.stem) place(entry.stem, slot, lamp.x, -lamp.y + fixtureModel(lamp.fixture).stem!.at, stemOf(index, world))
      const strength = level > 0 ? FIXTURE_SPECS[lamp.fixture].glow * level : 0
      const colors = entry.glow.instanceColor!.array as Float32Array
      for (let channel = 0; channel < 3; channel += 1) colors[slot * 3 + channel] = level > 0 ? linear[index * 3 + channel] * strength : DEAD_GLASS
      entry.glow.count = slot + 1
    }
    for (const entry of kinds.values()) {
      entry.body.count = entry.glow.count
      if (entry.stem) entry.stem.count = entry.glow.count
      for (const mesh of [entry.body, entry.glow, entry.stem]) {
        if (!mesh) continue
        mesh.visible = mesh.count > 0
        mesh.instanceMatrix.needsUpdate = true
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      }
    }
  }

  return {
    group,
    update(now, frame: Frame) {
      if (now.grid.version !== stemsVersion) {
        // A ceiling or the ground may have been blown away: cords and poles find their ends again when next drawn.
        stems.fill(-1)
        stemsVersion = now.grid.version
        stale = true
      }
      const halfW = DRAW_DISTANCE + MARGIN
      const halfH = DRAW_DISTANCE * 0.62 + MARGIN
      const count = grid.query(frame.view.x - halfW, frame.view.y - halfH, frame.view.x + halfW, frame.view.y + halfH, near)
      const alarm = inAlarm(now)
      // Rebuild the instance lists only when the set of nearby fittings or one of their brightnesses changed.
      let changed = false
      for (let at = 0; at < count && !changed; at += 1) changed = lampBrightness(now, lamps[near[at]], near[at], alarm) !== shown[near[at]]
      let set = count
      for (let at = 0; at < count; at += 1) set = (set * 31 + near[at]) % 1_000_000_007
      if (changed || stale || set !== lastSet) rebuild(count, now, alarm)
      lastSet = set
      stale = false
    },
  }
}
