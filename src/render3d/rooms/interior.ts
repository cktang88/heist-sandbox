import type { RoomKind } from '../../game/site'
import { isSolidAt, type Grid } from '../../game/tiles'
import { BACK, FRONT } from '../levelMesh'
import { GLYPH_ASPECT, glyphCell, SCUFF_CELL, STAIN_CELL, viewCell, type View } from './art'
import { tintOf, WHITE, type QuadBatch, type Tint } from './batch'
import type { ChunkedFinishes } from './chunks'
import type { Finish, Glazing, Surface } from './finishes'
import { windowLayout, type WallRect } from './glazing'
import { pickBy, roll } from './hash'
import type { FinishKit } from './kit'

/** Layers of an applied finish, back to front. All stay within 2 cm of the wall so wall-mounted props sit in front. */
const Z_WALL = BACK + 0.006
const Z_DETAIL = BACK + 0.009
const Z_FRAME = BACK + 0.011
const Z_GLASS = BACK + 0.013
const Z_TRIM = BACK + 0.016
/** Floor finishes sit just on the slab, so feet neither sink into it nor float above it. */
const FLOOR_LIFT = 0.012
const CEILING_DROP = 0.01

export type FinishContext = { scene: ChunkedFinishes; kit: FinishKit; grid: Grid }

/** The open space of a room, in tiles. `floorRow` is the slab underfoot and `ceilingRow` the slab overhead. */
export type Space = { id: number; kind: RoomKind | 'corridor'; x: number; w: number; floorRow: number; h: number; storey: number; windows: boolean }

type Place = Space & { left: number; right: number; floor: number; ceiling: number; centre: [number, number]; ctx: FinishContext }

/** Applies a room's wall, window, floor and ceiling finishes. */
export function finishSpace(ctx: FinishContext, space: Space, finish: Finish): void {
  const place: Place = {
    ...space, ctx, left: space.x, right: space.x + space.w, floor: -space.floorRow, ceiling: -space.floorRow + space.h,
    centre: [space.x + space.w / 2, space.floorRow - space.h / 2],
  }
  const logo = finish.extras.includes('logo') ? logoZone(place) : undefined
  walls(place, finish)
  if (space.windows) windows(place, finish, pickBy(finish.glazing, space.id, 3), logo)
  wear(place, finish.wall.grime)
  floor(place, finish)
  ceiling(place, finish)
  for (const extra of finish.extras) {
    if (extra === 'conduit') conduit(place)
    if (extra === 'cableTray') cableTray(place)
    if (extra === 'logo' && logo) logoWall(place, logo)
    if (extra === 'stencil') stencil(place)
    if (extra === 'shutter') shutter(place)
    if (extra === 'mirror') mirror(place)
  }
}

function batchFor(place: Place, material: Parameters<ChunkedFinishes['batch']>[2]): QuadBatch {
  return place.ctx.scene.batch(place.centre[0], place.centre[1], material)
}

function tintFor(surface: Surface, place: Place, salt: number): Tint {
  return tintOf(pickBy(surface.tints, place.id, salt))
}

/** Shifts the photo per room so neighbouring rooms do not show the same stain in the same place. */
function shiftFor(place: Place, salt: number): [number, number] {
  return [roll(place.id, salt), roll(place.id, salt + 1)]
}

function walls(place: Place, finish: Finish): void {
  const { kit } = place.ctx
  const wall = finish.wall
  let from = 0
  wall.bands.forEach((band, index) => {
    const to = band.upTo === undefined || index === wall.bands.length - 1 ? place.h : Math.min(band.upTo, place.h)
    if (to <= from) return
    batchFor(place, kit.photo(band.surface.photo)).facing(place.left, place.floor + from, place.right, place.floor + to, Z_WALL, band.surface.scale, tintFor(band.surface, place, 10 + index), shiftFor(place, 20 + index))
    from = to
  })
  const trims = batchFor(place, kit.trim)
  if (wall.joints) {
    const dark = tintOf(0x1a1a1a)
    for (let x = place.left + wall.joints; x < place.right - 0.3; x += wall.joints) trims.facing(x - 0.015, place.floor, x + 0.015, place.ceiling, Z_DETAIL, 1, dark)
    for (let y = wall.joints; y < place.h - 0.3; y += wall.joints) trims.facing(place.left, place.floor + y - 0.015, place.right, place.floor + y + 0.015, Z_DETAIL, 1, dark)
  }
  if (wall.hazard) batchFor(place, kit.hazard).facing(place.left, place.floor, place.right, place.floor + 0.38, Z_DETAIL, 0.9, WHITE)
  if (wall.rail !== undefined && wall.bands[0].upTo !== undefined) {
    const y = place.floor + wall.bands[0].upTo
    trims.facing(place.left, y - 0.04, place.right, y + 0.04, Z_TRIM, 1, tintOf(wall.rail))
  }
  if (wall.skirting !== undefined) {
    trims.facing(place.left, place.floor, place.right, place.floor + 0.14, Z_TRIM, 1, tintOf(wall.skirting))
    trims.level(place.left, place.right, place.floor + 0.14, BACK, Z_TRIM, true, 1, tintOf(wall.skirting))
  }
}

function viewFor(place: Place, glazing: Glazing, finish: Finish, pane: number): View {
  if (glazing === 'louvre') return 'louvre'
  if (glazing === 'high') {
    if (place.kind === 'cells') return 'barred'
    if (place.kind === 'restroom' || place.kind === 'lockers' || place.kind === 'kitchen') return 'frosted'
  }
  // Neighbouring panes of one window usually share a state; a few are set differently, as people leave them.
  const group = Math.floor(pane / 3)
  if (roll(place.id * 64 + group, 7) < finish.blinds) return roll(place.id * 64 + pane, 8) < 0.55 ? 'blindsHalf' : 'blindsDown'
  const outside = roll(place.id * 64 + group, 9)
  return outside < 0.04 ? 'neon' : outside < 0.5 ? 'clear' : 'clearFar'
}

function windows(place: Place, finish: Finish, glazing: Glazing, keepClear?: [number, number]): void {
  const { kit } = place.ctx
  const layout = windowLayout(glazing, place.w, place.h, keepClear)
  const frame = batchFor(place, kit.metal)
  const trims = batchFor(place, kit.trim)
  const frameTint = tintOf(pickBy([0x2b2f35, 0x3a3e44, 0x8a8e90, 0x24221f], place.id, 4))
  const sill = tintOf(pickBy([0xb8b4aa, 0x8a8680, 0x5a5650], place.id, 5))
  const at = (rect: WallRect, grow: number): [number, number, number, number] =>
    [place.left + rect.x0 - grow, place.floor + rect.y0 - grow, place.left + rect.x1 + grow, place.floor + rect.y1 + grow]
  for (const rect of layout.frames) {
    const [x0, y0, x1, y1] = at(rect, 0.06)
    frame.facing(x0, y0, x1, y1, Z_FRAME, 1, frameTint)
    if (glazing !== 'curtain') trims.facing(x0 - 0.08, y0 - 0.1, x1 + 0.08, y0, Z_TRIM, 1, sill)
  }
  const glass = batchFor(place, kit.view)
  layout.panes.forEach((rect, index) => {
    const [x0, y0, x1, y1] = at(rect, 0)
    glass.facingCell(x0, y0, x1, y1, Z_GLASS, viewCell(viewFor(place, glazing, finish, index)), WHITE)
  })
}

/** Scuffs along the foot of the wall and water stains running down from the ceiling. */
function wear(place: Place, grime: number): void {
  if (grime < 0.15) return
  const batch = batchFor(place, place.ctx.kit.grime)
  const top = place.floor + 0.3 + grime * 0.9
  const [u0, v0, u1, v1] = SCUFF_CELL
  for (let x = place.left; x < place.right; x += 3) {
    batch.facingCell(x, place.floor, Math.min(place.right, x + 3), top, Z_DETAIL, [u0, v0, u0 + (u1 - u0) * (Math.min(place.right, x + 3) - x) / 3, v1], WHITE)
  }
  const stains = Math.floor(grime * place.w / 7 + roll(place.id, 30))
  for (let stain = 0; stain < stains; stain += 1) {
    const width = 1 + roll(place.id * 8 + stain, 31) * 0.9
    const x = place.left + roll(place.id * 8 + stain, 32) * Math.max(0, place.w - width)
    const length = 1.4 + roll(place.id * 8 + stain, 33) * 1.8
    batch.facingCell(x, place.ceiling - length, x + width, place.ceiling, Z_DETAIL, STAIN_CELL, WHITE)
  }
}

/** One strip of floor finish per tile column, each resting on its own slab tile. */
function floor(place: Place, finish: Finish): void {
  const { scene, kit, grid } = place.ctx
  const surface = finish.floor.surface
  const material = kit.photo(surface.photo)
  const batch = batchFor(place, material)
  const tint = tintFor(surface, place, 40)
  const shift = shiftFor(place, 41)
  const y = place.floor + FLOOR_LIFT
  const lines = batchFor(place, kit.paint)
  const lineTint = tintOf(pickBy([0xd8c040, 0xe8e8e0], place.id, 42), 0.9)
  for (let column = place.left; column < place.right; column += 1) {
    if (!isSolidAt(grid, column, place.floorRow)) continue
    const mark = batch.mark
    batch.level(column, column + 1, y, BACK, FRONT, true, surface.scale, tint, shift)
    scene.restOn(place.centre[0], place.centre[1], material, mark, [[column, place.floorRow]])
    const lineMark = lines.mark
    const local = column - place.left
    if (finish.floor.lines === 'bays' && local % 4 === 2) lines.level(column + 0.45, column + 0.57, y + 0.004, BACK + 0.3, -0.35, true, 1, lineTint)
    if (finish.floor.lines === 'walkway') {
      for (const z of [-1.15, 0.3]) lines.level(column, column + 1, y + 0.004, z - 0.06, z + 0.06, true, 1, lineTint)
    }
    scene.restOn(place.centre[0], place.centre[1], kit.paint, lineMark, [[column, place.floorRow]])
  }
}

const SERVICE_PIECE = 4

function ceiling(place: Place, finish: Finish): void {
  const { scene, kit, grid } = place.ctx
  const surface = finish.ceiling.surface
  const material = kit.photo(surface.photo)
  const batch = batchFor(place, material)
  const tint = tintFor(surface, place, 50)
  const shift = shiftFor(place, 51)
  const row = place.floorRow - place.h - 1
  const y = place.ceiling - CEILING_DROP
  for (let column = place.left; column < place.right; column += 1) {
    if (!isSolidAt(grid, column, row)) continue
    const mark = batch.mark
    batch.level(column, column + 1, y, BACK, FRONT, false, surface.scale, tint, shift)
    scene.restOn(place.centre[0], place.centre[1], material, mark, [[column, row]])
  }
  // Services hang in short runs, so a hole blown in the slab takes only the run above it.
  const metal = batchFor(place, kit.metal)
  for (let from = place.left; from < place.right; from += SERVICE_PIECE) {
    const to = Math.min(place.right, from + SERVICE_PIECE)
    const tiles: [number, number][] = []
    for (let column = from; column < to; column += 1) tiles.push([column, row])
    const mark = metal.mark
    services(metal, finish.ceiling.services, from, to, y)
    scene.restOn(place.centre[0], place.centre[1], kit.metal, mark, tiles)
  }
  if (finish.ceiling.cove) {
    const warm: [number, number, number] = [2.4, 1.7, 1.0]
    batchFor(place, kit.glow).facing(place.left + 0.2, y - 0.1, place.right - 0.2, y - 0.04, Z_TRIM, 1, warm)
  }
}

function services(metal: QuadBatch, kind: Finish['ceiling']['services'], from: number, to: number, y: number): void {
  if (kind === 'pipes') {
    metal.pipeAlongX(from, to, y - 0.32, -2.05, 0.1, tintOf(0x7a8288))
    metal.pipeAlongX(from, to, y - 0.2, -1.72, 0.055, tintOf(0xa83a2a))
    metal.box(from + 0.5, y - 0.45, -2.12, from + 0.56, y, -1.98, 1, tintOf(0x3a3e42))
  } else if (kind === 'trays') {
    metal.box(from, y - 0.44, -2.15, to, y - 0.4, -1.45, 1, tintOf(0x8a9098))
    metal.box(from, y - 0.4, -2.05, to, y - 0.32, -1.55, 1, tintOf(0x1c2024))
    metal.box(from + 1, y - 0.4, -1.82, from + 1.05, y, -1.78, 1, tintOf(0x5a6068))
  } else if (kind === 'ducts') {
    metal.box(from, y - 0.72, -2.3, to, y - 0.18, -1.45, 1.2, tintOf(0xb0b8bc))
    metal.box(from + 0.02, y - 0.75, -2.32, from + 0.1, y - 0.15, -1.43, 1, tintOf(0x7a8084))
  }
}

function conduit(place: Place): void {
  const metal = batchFor(place, place.ctx.kit.metal)
  const x = roll(place.id, 60) < 0.5 ? place.left + 0.6 : place.right - 0.75
  const grey = tintOf(0x8a8e92)
  metal.facing(x, place.floor + 1.3, x + 0.07, place.ceiling, Z_TRIM, 1, grey)
  metal.facing(x - 0.08, place.floor + 1.05, x + 0.15, place.floor + 1.35, Z_TRIM, 1, tintOf(0xc8c8c0))
}

function cableTray(place: Place): void {
  const metal = batchFor(place, place.ctx.kit.metal)
  const y = place.ceiling - 0.62
  metal.box(place.left, y, BACK, place.right, y + 0.05, BACK + 0.32, 1, tintOf(0x9aa0a8))
  metal.box(place.left, y + 0.05, BACK + 0.02, place.right, y + 0.14, BACK + 0.26, 1, tintOf(0x2a3a5a))
  metal.facing(place.left, y, place.right, y + 0.12, BACK + 0.32, 1, tintOf(0x9aa0a8))
}

/** The middle of the lobby's back wall is kept for the company name. */
function logoZone(place: Place): [number, number] | undefined {
  if (place.w < 12) return undefined
  const width = Math.min(10, place.w - 6)
  return [place.w / 2 - width / 2, place.w / 2 + width / 2]
}

function logoWall(place: Place, [from, to]: [number, number]): void {
  const { kit } = place.ctx
  const x0 = place.left + from
  const x1 = place.left + to
  const height = (to - from) / 4
  const y0 = place.floor + Math.min(place.h - height - 0.6, 1.8 + (place.h > 6 ? 2.5 : 0))
  batchFor(place, kit.trim).facing(x0, place.floor, x1, place.ceiling, Z_FRAME, 1, tintOf(0x1e2024))
  batchFor(place, kit.logo).facingCell(x0 + 0.4, y0, x1 - 0.4, y0 + height, Z_TRIM, [0, 0, 1, 1], [1.6, 1.9, 2.2])
}

/** Big stencilled storey numbers, the way stair cores and car parks are marked. */
function stencil(place: Place): void {
  const label = storeyLabel(place.storey, place.kind === 'garage')
  const colour = tintOf(pickBy([0xe8e4d8, 0xe0c040, 0xd85030], place.id, 70), 0.9)
  const height = place.kind === 'garage' ? 1.1 : 1.4
  const spots = place.kind === 'garage' ? Math.max(1, Math.floor(place.w / 10)) : 1
  for (let spot = 0; spot < spots; spot += 1) {
    const x = place.left + 0.8 + spot * (place.w / spots)
    letters(batchFor(place, place.ctx.kit.letters), label, x, place.floor + 2.3, height, colour)
  }
}

/** How a storey is signed: G for the street, B1 and down for basements (P1 in car parks), plain numbers above. */
export function storeyLabel(storey: number, parking: boolean): string {
  if (storey < 0) return `${parking ? 'P' : 'B'}${-storey}`
  return storey === 0 ? 'G' : String(storey)
}

/** Lays out text in block letters, left to right from (x, y) at the given letter height. */
export function letters(batch: QuadBatch, text: string, x: number, y: number, height: number, tint: Tint, z = Z_TRIM): void {
  const advance = height * GLYPH_ASPECT
  for (let index = 0; index < text.length; index += 1) {
    const cell = glyphCell(text[index])
    if (cell) batch.facingCell(x + index * advance, y, x + index * advance + advance * 1.15, y + height, z, cell, tint)
  }
}

function shutter(place: Place): void {
  const { kit } = place.ctx
  const width = Math.min(5, place.w - 2)
  const x0 = place.left + (place.w - width) / 2
  const height = Math.min(3.6, place.h - 1)
  batchFor(place, kit.photo({ set: 'corrugated_iron', rough: 0.6, metal: 0.6 })).facing(x0, place.floor, x0 + width, place.floor + height, Z_FRAME, 1.2, tintOf(0x8a9298))
  batchFor(place, kit.hazard).facing(x0 - 0.3, place.floor, x0, place.floor + height + 0.3, Z_GLASS, 0.6, WHITE)
  batchFor(place, kit.hazard).facing(x0 + width, place.floor, x0 + width + 0.3, place.floor + height + 0.3, Z_GLASS, 0.6, WHITE)
  batchFor(place, kit.metal).facing(x0 - 0.3, place.floor + height, x0 + width + 0.3, place.floor + height + 0.35, Z_TRIM, 1, tintOf(0x3a3e42))
}

function mirror(place: Place): void {
  const { kit } = place.ctx
  const [y0, y1] = place.kind === 'gym' ? [0.9, 3] : [1.7, 2.7]
  const frame = batchFor(place, kit.trim)
  const glass = batchFor(place, kit.mirror)
  for (let x = place.left + 1; x + 1.6 <= place.right - 1; x += 2.2) {
    frame.facing(x - 0.05, place.floor + y0 - 0.05, x + 1.65, place.floor + y1 + 0.05, Z_FRAME, 1, tintOf(0x9a9a98))
    glass.facing(x, place.floor + y0, x + 1.6, place.floor + y1, Z_GLASS, 1, WHITE)
  }
}
