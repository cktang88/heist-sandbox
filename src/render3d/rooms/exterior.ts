import type { Material } from 'three'
import type { Room, TimeOfDay } from '../../game/site'
import { isSolidAt, tileAt, type Grid } from '../../game/tiles'
import { BACK, FRONT } from '../levelMesh'
import { tintOf, WHITE, type QuadBatch, type Tint } from './batch'
import type { Building } from './buildings'
import type { ChunkedFinishes } from './chunks'
import { pickBy, roll } from './hash'
import { letters } from './interior'
import type { FinishKit } from './kit'
import type { PhotoSpec } from './photoMaterials'

export type ExteriorContext = { scene: ChunkedFinishes; kit: FinishKit; grid: Grid; time: TimeOfDay; company: string }

const STOREY = 6
const CLADDING: Record<string, { photo: PhotoSpec; scale: number; tint: number }> = {
  tower: { photo: { set: 'old/concrete', rough: 0.85 }, scale: 3, tint: 0x9a9ea4 },
  depot: { photo: { set: 'red_brick_03', rough: 0.85 }, scale: 2.6, tint: 0xd0c0b8 },
  quarters: { photo: { set: 'painted_brick', rough: 0.8 }, scale: 2.2, tint: 0x9aa098 },
}
const SIGNS: Record<string, string> = { depot: 'DEPOT 3', quarters: 'QUARTERS B' }

/** Everything that makes a building read as a building from outside. */
export function dressBuilding(ctx: ExteriorContext, building: Building): void {
  for (const side of [-1, 1] as const) {
    endWall(ctx, building, side)
    pipesAndUnits(ctx, building, side)
    doorway(ctx, building, side)
  }
  roofEdge(ctx, building)
  if (building.storeys <= 8) fireEscape(ctx, building)
  if (building.name === 'tower') {
    bladeSign(ctx, building)
    roofSign(ctx, building)
  }
}

/** The column just outside an end wall, and the x of that wall's outer face. */
function faceOf(building: Building, side: -1 | 1): { column: number; face: number } {
  return side === -1 ? { column: building.left, face: building.left } : { column: building.right, face: building.right + 1 }
}

function windowTint(ctx: ExteriorContext, seed: number): Tint {
  const r = roll(seed, 1)
  if (ctx.time === 'day') return r < 0.5 ? tintOf(0x2b3340) : tintOf(0x4a5868)
  if (r < 0.35) return tintOf(0x0c1018)
  return r < 0.8 ? [2.2, 1.45, 0.75] : [1.3, 1.7, 2.2]
}

/**
 * The outer face of an end wall: cladding over the solid frame, and lit (or dark) glass where the wall has windows.
 * The camera sees these faces at an angle when it is beside a building.
 */
function endWall(ctx: ExteriorContext, building: Building, side: -1 | 1): void {
  const { scene, kit, grid } = ctx
  const { column, face } = faceOf(building, side)
  const x = face + side * 0.004
  const cladding = CLADDING[building.name] ?? CLADDING.tower
  const material = kit.photo(cladding.photo)
  const tint = tintOf(cladding.tint)
  for (let row = building.roofRow - 1; row < building.groundRow; row += 1) {
    const kind = tileAt(grid, column, row)
    const at: [number, number] = [column, row]
    if (kind === 'air' || kind === 'door' || kind === 'ladder') continue
    if (kind === 'glass') {
      const batch = scene.batch(column, row, kit.glow)
      const mark = batch.mark
      batch.side(x, -row - 1, -row, BACK + 0.15, FRONT - 0.1, side === 1, 1, windowTint(ctx, column * 1000 + Math.floor(row / STOREY)))
      scene.restOn(column, row, kit.glow, mark, [at])
      continue
    }
    const batch = scene.batch(column, row, material)
    const mark = batch.mark
    batch.side(x, -row - 1, -row, BACK, FRONT, side === 1, cladding.scale, tint)
    if (kind !== 'reinforced') scene.restOn(column, row, material, mark, [at])
  }
}

/** A downpipe from the roof, and air-conditioning units hung outside some windows. */
function pipesAndUnits(ctx: ExteriorContext, building: Building, side: -1 | 1): void {
  const { scene, kit } = ctx
  const { face } = faceOf(building, side)
  const top = -(building.roofRow - 1)
  const ground = -building.groundRow
  const pipeX = face + side * 0.13
  for (let y = ground; y < top; y += STOREY) {
    const metal = scene.batch(face, -y, kit.metal)
    metal.pipeAlongY(y, Math.min(top, y + STOREY), pipeX, BACK + 0.35, 0.075, tintOf(0x5a5e60))
    metal.box(Math.min(face, pipeX) - 0.05, y + 3, BACK + 0.25, Math.max(face, pipeX) + 0.05, y + 3.1, BACK + 0.45, 1, tintOf(0x3a3c3e))
  }
  for (let storey = 1; storey < building.storeys; storey += 1) {
    if (roll(face * 100 + storey, 2) > 0.4) continue
    const floor = -(building.groundRow - storey * STOREY)
    const z = -1.9 + roll(face * 100 + storey, 3) * 0.8
    const [x0, x1] = side === -1 ? [face - 0.75, face] : [face, face + 0.75]
    const metal = scene.batch(face, -floor, kit.metal)
    metal.box(x0, floor + 1.1, z, x1, floor + 1.75, z + 0.7, 1, tintOf(0xb8bcb8))
    scene.batch(face, -floor, kit.trim).facing(x0 + 0.06, floor + 1.18, x1 - 0.06, floor + 1.67, z + 0.701, 1, tintOf(0x2a2c2e))
    metal.box(Math.min(x0, x1) + 0.1, floor + 1.0, z + 0.1, Math.max(x0, x1) - 0.1, floor + 1.1, z + 0.6, 1, tintOf(0x4a4c4e))
  }
}

/** A canopy, wall lights and a name sign over each street door. */
function doorway(ctx: ExteriorContext, building: Building, side: -1 | 1): void {
  const { scene, kit, grid } = ctx
  const { column, face } = faceOf(building, side)
  if (tileAt(grid, column, building.groundRow - 1) !== 'door') return
  const ground = -building.groundRow
  const out = (distance: number) => face + side * distance
  const [near, far] = [out(0), out(2.6)]
  const metal = scene.batch(column, building.groundRow, kit.metal)
  metal.box(Math.min(near, far), ground + 3.55, BACK + 0.1, Math.max(near, far), ground + 3.75, FRONT - 0.05, 1, tintOf(0x2a2e32))
  const glow = scene.batch(column, building.groundRow, kit.glow)
  const lamp: Tint = ctx.time === 'night' ? [2.6, 2.0, 1.3] : [1.2, 1.1, 0.95]
  for (const z of [-1.6, -0.4]) glow.level(Math.min(out(0.4), out(1.4)), Math.max(out(0.4), out(1.4)), ground + 3.54, z - 0.1, z + 0.1, false, 1, lamp)
  const label = SIGNS[building.name]
  if (!label) return
  const height = 0.6
  const width = label.length * height * 0.62 + 0.6
  const [x0, x1] = side === -1 ? [face - width - 0.2, face - 0.2] : [face + 0.2, face + width + 0.2]
  const y = ground + 4.1
  scene.batch(column, building.groundRow, kit.trim).facing(x0, y, x1, y + height + 0.3, -1.3, 1, tintOf(0x15171a))
  letters(scene.batch(column, building.groundRow, kit.neon), label, x0 + 0.3, y + 0.15, height, ctx.time === 'night' ? [2.4, 1.6, 0.6] : [1, 0.85, 0.5], -1.28)
}

/** A coping along the top of the walls, a railing along the back of the roof, and red lights on the corners. */
function roofEdge(ctx: ExteriorContext, building: Building): void {
  const { scene, kit } = ctx
  const roof = -building.roofRow
  const top = roof + 1
  for (const column of [building.left, building.right]) {
    scene.batch(column, building.roofRow, kit.metal).box(column - 0.06, top, BACK - 0.02, column + 1.06, top + 0.12, FRONT + 0.02, 1, tintOf(0x6a6e72))
  }
  for (let x = building.left + 1; x < building.right; x += 8) {
    const to = Math.min(building.right, x + 8)
    const metal = scene.batch(x, building.roofRow, kit.metal)
    const rail = tintOf(0x4a4e52)
    metal.box(x, top + 0.02, BACK + 0.1, to, top + 0.07, BACK + 0.16, 1, rail)
    metal.box(x, top - 0.45, BACK + 0.1, to, top - 0.41, BACK + 0.16, 1, rail)
    for (let post = x; post < to; post += 2) metal.box(post, roof, BACK + 0.1, post + 0.06, top + 0.02, BACK + 0.16, 1, rail)
  }
  const red: Tint = [3, 0.25, 0.15]
  for (const column of [building.left, building.right]) {
    scene.batch(column, building.roofRow, kit.glow).box(column + 0.35, top + 0.12, -1.2, column + 0.65, top + 0.35, -0.9, 1, red)
  }
}

/** Steel landings and stairs zigzagging up the outside of a low building's end wall. */
function fireEscape(ctx: ExteriorContext, building: Building): void {
  const { scene, kit } = ctx
  const side: -1 | 1 = roll(building.left, 4) < 0.5 ? -1 : 1
  const { face } = faceOf(building, side)
  const out = (distance: number) => face + side * distance
  const steel = tintOf(0x26282c)
  for (let storey = 1; storey < building.storeys; storey += 1) {
    const floor = -(building.groundRow - storey * STOREY)
    const metal = scene.batch(face, -floor, kit.metal)
    const [x0, x1] = [Math.min(out(0), out(2.2)), Math.max(out(0), out(2.2))]
    metal.box(x0, floor - 0.12, -2.3, x1, floor, -1.3, 1, steel)
    metal.box(x0, floor + 1, -1.36, x1, floor + 1.06, -1.3, 1, steel)
    for (let post = 0; post <= 2.2; post += 0.55) metal.box(Math.min(out(post), out(post + 0.05)), floor, -1.36, Math.max(out(post), out(post + 0.05)), floor + 1, -1.3, 1, steel)
    if (storey === building.storeys - 1) continue
    // A steep flight up to the next landing, alternating direction each storey.
    const rising = storey % 2 === 0
    for (let step = 0; step < 12; step += 1) {
      const along = rising ? 0.1 + step * 0.17 : 2.1 - step * 0.17
      const y = floor + (step + 1) * (STOREY / 13)
      metal.box(Math.min(out(along), out(along + 0.22)), y - 0.06, -2.2, Math.max(out(along), out(along + 0.22)), y, -1.6, 1, steel)
    }
  }
}

/** A tall sign standing out from the tower's end wall, facing the street, with the company name down it. */
function bladeSign(ctx: ExteriorContext, building: Building): void {
  const { scene, kit } = ctx
  const side: -1 | 1 = -1
  const { face } = faceOf(building, side)
  const top = -(building.groundRow - 9 * STOREY)
  const bottom = -(building.groundRow - 2 * STOREY) + 1
  const [x0, x1] = [face - 3.2, face - 0.5]
  const row = -Math.round((top + bottom) / 2)
  scene.batch(face, row, kit.trim).facing(x0, bottom, x1, top, -1.05, 1, tintOf(0x101216))
  scene.batch(face, row, kit.metal).box(x1, bottom + 2, -1.2, face, bottom + 2.2, -0.95, 1, tintOf(0x3a3e42))
  scene.batch(face, row, kit.metal).box(x1, top - 2.2, -1.2, face, top - 2, -0.95, 1, tintOf(0x3a3e42))
  const neon: Tint = ctx.time === 'night' ? [0.6, 2.4, 2.8] : [0.5, 0.8, 0.9]
  const height = (top - bottom - 1) / ctx.company.length
  const letterBatch = scene.batch(face, row, kit.neon)
  for (let index = 0; index < ctx.company.length; index += 1) {
    letters(letterBatch, ctx.company[index], (x0 + x1) / 2 - height * 0.36, top - 0.5 - (index + 1) * height, height * 0.95, neon, -1.03)
  }
  const edge: Tint = ctx.time === 'night' ? [2.8, 0.4, 1.6] : [0.7, 0.3, 0.45]
  const glow = scene.batch(face, row, kit.glow)
  glow.facing(x0, bottom, x0 + 0.08, top, -1.04, 1, edge)
  glow.facing(x1 - 0.08, bottom, x1, top, -1.04, 1, edge)
}

/** The company name in huge backlit letters on a steel frame on the tower roof. */
function roofSign(ctx: ExteriorContext, building: Building): void {
  const { scene, kit } = ctx
  const roof = -building.roofRow
  const centre = (building.left + building.right + 1) / 2
  const width = Math.min(44, building.right - building.left - 12)
  const height = width / 4
  const [x0, x1] = [centre - width / 2, centre + width / 2]
  const bottom = roof + 2.2
  const z = BACK + 0.4
  for (let x = x0; x <= x1; x += width / 6) {
    const metal = scene.batch(x, building.roofRow, kit.metal)
    metal.box(x - 0.12, roof, z - 0.35, x + 0.12, bottom + height * 0.9, z - 0.15, 1, tintOf(0x2a2c30))
  }
  for (const y of [bottom + height * 0.25, bottom + height * 0.7]) scene.batch(centre, building.roofRow, kit.metal).box(x0, y, z - 0.33, x1, y + 0.18, z - 0.17, 1, tintOf(0x2a2c30))
  const lit: Tint = ctx.time === 'night' ? [1.0, 1.45, 1.75] : [0.9, 0.9, 0.88]
  scene.batch(centre, building.roofRow, kit.logo).facingCell(x0, bottom, x1, bottom + height, z, [0, 0, 1, 1], lit)
}

/** Road and yard surfaces: kerb and markings on the street, painted lines in the yard, puddles and manholes. */
export function dressGround(ctx: ExteriorContext, room: Room): void {
  if (room.kind === 'street') street(ctx, room)
  if (room.kind === 'yard') yard(ctx, room)
  if (room.kind === 'rooftop') roofing(ctx, room)
  puddles(ctx, room)
  for (let column = room.x; column < room.x + room.w; column += 1) {
    if (tileAt(ctx.grid, column, room.floorY) === 'ladder') manhole(ctx, column, room.floorY)
  }
}

/** Calls `draw` once per solid ground column of the room, so each piece vanishes with the ground under it. */
function perColumn(ctx: ExteriorContext, room: Room, material: Material, draw: (batch: QuadBatch, column: number, ground: number) => void): void {
  for (let column = room.x; column < room.x + room.w; column += 1) {
    if (!isSolidAt(ctx.grid, column, room.floorY)) continue
    const batch = ctx.scene.batch(column, room.floorY, material)
    const mark = batch.mark
    draw(batch, column, -room.floorY)
    ctx.scene.restOn(column, room.floorY, material, mark, [[column, room.floorY]])
  }
}

const KERB = -1.5

function street(ctx: ExteriorContext, room: Room): void {
  const { kit } = ctx
  const pavement = kit.photo({ set: 'cracked_concrete', rough: 0.85 })
  perColumn(ctx, room, pavement, (batch, column, ground) => {
    batch.level(column, column + 1, ground + 0.15, BACK, KERB, true, 3, tintOf(0xa8a8a0))
    batch.facing(column, ground, column + 1, ground + 0.15, KERB, 3, tintOf(0x8a8a86))
  })
  const white = tintOf(0xe0e0d8, 0.85)
  const yellow = tintOf(0xd8b030, 0.85)
  perColumn(ctx, room, kit.paint, (batch, column, ground) => {
    const y = ground + 0.006
    for (const z of [KERB + 0.15, KERB + 0.28]) batch.level(column, column + 1, y, z - 0.05, z + 0.05, true, 1, yellow)
    if (column % 4 < 2) batch.level(column, column + 1, y, -0.12, 0.02, true, 1, white)
    // A zebra crossing a few steps from the gate.
    if (roll(room.x, 5) < 0.6 && column >= room.x + 5 && column < room.x + 10) batch.level(column + 0.1, column + 0.55, y, KERB + 0.4, FRONT - 0.1, true, 1, white)
  })
}

function yard(ctx: ExteriorContext, room: Room): void {
  const { kit } = ctx
  const apron = kit.photo({ set: 'concrete_floor_worn_001', rough: 0.85 })
  perColumn(ctx, room, apron, (batch, column, ground) => batch.level(column, column + 1, ground + 0.008, BACK, FRONT, true, 4, tintOf(0xb0aca4)))
  const yellow = tintOf(0xd8b030, 0.85)
  perColumn(ctx, room, kit.paint, (batch, column, ground) => {
    const y = ground + 0.014
    batch.level(column, column + 1, y, -1.95, -1.85, true, 1, yellow)
    if ((column - room.x) % 3 === 1) batch.level(column + 0.45, column + 0.55, y, BACK + 0.1, -1.95, true, 1, yellow)
  })
}

function roofing(ctx: ExteriorContext, room: Room): void {
  const membrane = ctx.kit.photo({ set: 'asphalt_02', rough: 0.75 })
  perColumn(ctx, room, membrane, (batch, column, ground) => batch.level(column, column + 1, ground + 0.01, BACK, FRONT, true, 3, tintOf(0x5a5c60)))
}

function puddles(ctx: ExteriorContext, room: Room): void {
  const count = Math.floor(room.w / 7)
  for (let index = 0; index < count; index += 1) {
    const seed = room.id * 50 + index
    const width = 1.2 + roll(seed, 10) * 2.6
    const x = room.x + roll(seed, 11) * Math.max(0, room.w - width)
    const depth = 0.6 + roll(seed, 12) * 1.1
    const z = BACK + 0.2 + roll(seed, 13) * (FRONT - BACK - depth - 0.3)
    const tiles: [number, number][] = []
    for (let column = Math.floor(x); column < Math.ceil(x + width); column += 1) tiles.push([column, room.floorY])
    if (!tiles.every(([column, row]) => isSolidAt(ctx.grid, column, row))) continue
    const lift = room.kind === 'street' && z + depth < KERB ? 0.17 : 0.02
    const batch = ctx.scene.batch(x, room.floorY, ctx.kit.puddle)
    const mark = batch.mark
    batch.quad([[x, -room.floorY + lift, z + depth], [x + width, -room.floorY + lift, z + depth], [x + width, -room.floorY + lift, z], [x, -room.floorY + lift, z]], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], WHITE)
    ctx.scene.restOn(x, room.floorY, ctx.kit.puddle, mark, tiles)
  }
}

/** A steel rim round a manhole shaft and its lid slid aside onto the road. */
function manhole(ctx: ExteriorContext, column: number, row: number): void {
  const metal = ctx.scene.batch(column, row, ctx.kit.metal)
  const ground = -row
  const iron = tintOf(0x2a2826)
  metal.box(column - 0.1, ground, -1.25, column + 0.02, ground + 0.04, -0.15, 1, iron)
  metal.box(column + 0.98, ground, -1.25, column + 1.1, ground + 0.04, -0.15, 1, iron)
  const slid = pickBy([1.15, -1.05], column, 6)
  metal.box(column + slid, ground, -1.15, column + slid + 0.9, ground + 0.05, -0.25, 1, tintOf(0x3a3632))
}
