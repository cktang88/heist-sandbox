import { layerSheet, type LayerName, type LayerSpec, type Sheet } from './frame'
import { createRng, hash3, type Rng } from './random'

/**
 * The city behind the level, laid out once from a seed and shared by the painter (silhouettes, windows,
 * signs) and the light list (out-of-focus discs). Pure data: no canvas, no three.js.
 */

export type Tier = { x0: number; x1: number; top: number }
export type RoofKind = 'spire' | 'antenna' | 'tank' | 'crane' | 'billboard' | 'chimney' | 'dish'
/** Something on a roof: `x` is its left edge, `base` the roof it stands on. */
export type Roof = { kind: RoofKind; x: number; width: number; height: number; base: number }
export type FacadeKind = 'grid' | 'bands' | 'curtain'
export type SignKind = 'vertical' | 'board' | 'screen' | 'logo'
export type Sign = { kind: SignKind; x0: number; x1: number; y0: number; y1: number; colour: number; seed: number }
export type Rect = { x0: number; x1: number; y0: number; y1: number }

export type Building = {
  id: number
  /** 0 = back row (taller, hazier), 1 = front row. */
  row: number
  x0: number
  x1: number
  /** Stacked from the base up, each narrower than the one below (setbacks). */
  tiers: Tier[]
  roofs: Roof[]
  facade: FacadeKind
  /** Storey height and window spacing in tiles; window size as a share of the cell. */
  floor: number
  column: number
  windowWide: number
  windowTall: number
  /** 0 = all cold fluorescent, 1 = all warm tungsten. */
  warmth: number
  /** Multiplies the mood's share of lit windows. */
  litBias: number
  /** A block of windows left dark (an empty floor plate, a closed hotel wing). */
  dark: Rect | null
  /** Under construction above this height: no lights, a crane on top. */
  builtTo: number
  /** Small variation of the wall colour (-1..1). */
  shade: number
  signs: Sign[]
}

export type Layer = { spec: LayerSpec; sheet: Sheet; ground: number; buildings: Building[]; rail: number | null }

type Row = { width: [number, number]; height: [number, number]; gap: number }
/** `spread` < 2 gives more tall towers (heights are drawn as random^spread). */
type Plan = { rows: Row[]; floor: number; column: [number, number]; centres: number; rail: boolean; spread: number }

const PLANS: Record<LayerName, Plan> = {
  far: {
    rows: [{ width: [16, 40], height: [90, 345], gap: 0.3 }, { width: [14, 34], height: [30, 120], gap: 0.2 }, { width: [7, 16], height: [6, 18], gap: 0 }],
    floor: 3.8, column: [1.7, 2.6], centres: 3, rail: false, spread: 1.25,
  },
  mid: {
    rows: [{ width: [14, 32], height: [60, 172], gap: 0.35 }, { width: [11, 26], height: [22, 80], gap: 0.15 }, { width: [6, 13], height: [4, 12], gap: 0 }],
    floor: 3.3, column: [1.5, 2.2], centres: 2, rail: true, spread: 1.5,
  },
  near: {
    rows: [{ width: [10, 24], height: [28, 68], gap: 0.25 }, { width: [8, 20], height: [11, 34], gap: 0.12 }],
    floor: 3, column: [1.4, 2], centres: 1, rail: false, spread: 1.8,
  },
}

export function buildingTop(building: Building): number {
  return Math.max(...building.tiers.map((tier) => tier.top))
}

/** Districts where the tall towers bunch, so the skyline has a shape instead of even noise. */
function downtown(rng: Rng, sheet: Sheet, count: number): (x: number) => number {
  const width = sheet.right - sheet.left
  const centres = Array.from({ length: count }, () => ({ x: sheet.left + width * rng.range(0.15, 0.85), reach: width * rng.range(0.08, 0.16) }))
  return (x) => Math.max(0.45, ...centres.map((c) => Math.exp(-(((x - c.x) / c.reach) ** 2))))
}

function tiersFor(rng: Rng, x0: number, x1: number, ground: number, height: number): Tier[] {
  const tiers: Tier[] = []
  let [left, right, base] = [x0, x1, ground]
  const steps = height > 40 && rng.chance(0.65) ? 1 + Math.floor(rng.range(0, 3)) : 0
  for (let step = 0; step < steps; step += 1) {
    const top = base + (ground + height - base) * rng.range(0.35, 0.7)
    tiers.push({ x0: left, x1: right, top })
    const width = right - left
    const cutLeft = width * rng.range(0.06, 0.22)
    const cutRight = rng.chance(0.7) ? width * rng.range(0.06, 0.22) : 0
    if (width - cutLeft - cutRight < 5) break
    left += cutLeft
    right -= cutRight
    base = top
  }
  tiers.push({ x0: left, x1: right, top: ground + height })
  return tiers
}

function roofsFor(rng: Rng, top: Tier, name: LayerName, height: number, building: Pick<Building, 'builtTo'>): Roof[] {
  const roofs: Roof[] = []
  const width = top.x1 - top.x0
  const at = (share: number, size: number) => top.x0 + (width - size) * share
  if (building.builtTo < top.top) {
    roofs.push({ kind: 'crane', x: at(rng.range(0.1, 0.6), 1), width: rng.range(14, 24) * (rng.chance(0.5) ? 1 : -1), height: rng.range(12, 22), base: building.builtTo })
    return roofs
  }
  if (height > 150 && rng.chance(0.4)) roofs.push({ kind: 'spire', x: at(0.5, 1.2), width: 1.2, height: rng.range(25, 60), base: top.top })
  else if (height > 60 && rng.chance(0.55)) {
    const masts = 1 + Math.floor(rng.range(0, 2.4))
    for (let mast = 0; mast < masts; mast += 1) roofs.push({ kind: 'antenna', x: at(rng.next(), 0.4), width: 0.4, height: rng.range(6, height > 150 ? 30 : 16), base: top.top })
  }
  if (name !== 'far' && height < 90 && rng.chance(0.4)) roofs.push({ kind: 'tank', x: at(rng.next(), 3), width: rng.range(2.4, 4), height: rng.range(3, 5), base: top.top })
  if (name !== 'far' && height < 100 && rng.chance(0.22)) roofs.push({ kind: 'billboard', x: at(rng.next(), Math.min(width, 16)), width: Math.min(width * 0.9, rng.range(9, 18)), height: rng.range(5, 8), base: top.top + rng.range(1.5, 3) })
  if (height < 45 && rng.chance(0.18)) roofs.push({ kind: 'chimney', x: at(rng.next(), 1.6), width: 1.6, height: rng.range(6, 12), base: top.top })
  if (rng.chance(0.15)) roofs.push({ kind: 'dish', x: at(rng.next(), 2), width: 2, height: 2, base: top.top })
  return roofs
}

function signsFor(rng: Rng, building: Building, name: LayerName, ground: number, height: number): Sign[] {
  const signs: Sign[] = []
  const base = building.tiers[0]
  const width = base.x1 - base.x0
  const colour = () => Math.floor(rng.range(0, 8))
  const seed = () => Math.floor(rng.range(0, 1e6))
  const tall = { near: [7, 16, 1.6, 2.4], mid: [14, 36, 2.6, 4.2], far: [30, 64, 4.5, 7] }[name]
  const verticalOdds = { near: 0.45, mid: 0.3, far: 0.14 }[name]
  if (height > tall[0] + 8 && rng.chance(verticalOdds)) {
    const h = Math.min(rng.range(tall[0], tall[1]), height - 6)
    const w = rng.range(tall[2], tall[3])
    const x0 = rng.chance(0.5) ? base.x0 + rng.range(0.3, 1.5) : base.x1 - w - rng.range(0.3, 1.5)
    const y0 = ground + rng.range(name === 'near' ? 6 : 10, Math.max(name === 'near' ? 7 : 11, height - h - 4))
    signs.push({ kind: 'vertical', x0, x1: x0 + w, y0, y1: y0 + h, colour: colour(), seed: seed() })
  }
  if (name === 'near' && rng.chance(0.55)) {
    const w = width * rng.range(0.4, 0.8)
    const x0 = base.x0 + (width - w) * rng.next()
    const y0 = ground + rng.range(3.4, 5.5)
    signs.push({ kind: 'board', x0, x1: x0 + w, y0, y1: y0 + rng.range(1.6, 2.6), colour: colour(), seed: seed() })
  }
  if (name === 'mid' && height > 40 && rng.chance(0.1)) {
    const w = Math.min(width * 0.7, rng.range(10, 18))
    const x0 = base.x0 + (width - w) * rng.next()
    const y0 = ground + rng.range(12, height * 0.6)
    signs.push({ kind: 'screen', x0, x1: x0 + w, y0, y1: y0 + w * rng.range(0.45, 0.6), colour: colour(), seed: seed() })
  }
  if (name === 'far' && height > 160 && rng.chance(0.3)) {
    const top = building.tiers[building.tiers.length - 1]
    const w = Math.min(top.x1 - top.x0 - 2, rng.range(10, 16))
    const x0 = (top.x0 + top.x1 - w) / 2
    signs.push({ kind: 'logo', x0, x1: x0 + w, y0: top.top - w - 6, y1: top.top - 6, colour: colour(), seed: seed() })
  }
  for (const roof of building.roofs) {
    if (roof.kind === 'billboard') signs.push({ kind: 'screen', x0: roof.x, x1: roof.x + roof.width, y0: roof.base, y1: roof.base + roof.height, colour: colour(), seed: seed() })
  }
  return signs
}

function building(rng: Rng, id: number, row: number, x0: number, width: number, height: number, name: LayerName, plan: Plan, ground: number): Building {
  const tiers = tiersFor(rng, x0, x0 + width, ground, height)
  const facade: FacadeKind = height > 80 && rng.chance(0.35) ? 'curtain' : rng.chance(0.25) ? 'bands' : 'grid'
  const builtTo = row === 0 && height > 70 && rng.chance(0.07) ? ground + height * rng.range(0.6, 0.85) : Infinity
  const top = tiers[tiers.length - 1]
  const result: Building = {
    id,
    row,
    x0,
    x1: x0 + width,
    tiers,
    roofs: [],
    facade,
    floor: plan.floor * rng.range(0.9, 1.15),
    column: rng.range(plan.column[0], plan.column[1]),
    windowWide: facade === 'bands' ? 1 : rng.range(0.45, 0.7),
    windowTall: rng.range(0.42, 0.62),
    warmth: rng.chance(0.55) ? rng.range(0.65, 1) : rng.range(0, 0.35),
    litBias: rng.range(0.5, 1.5),
    dark: rng.chance(0.45) ? darkBlock(rng, x0, width, ground, height) : null,
    builtTo,
    shade: rng.range(-1, 1),
    signs: [],
  }
  if (builtTo !== Infinity) result.tiers = tiers.map((tier) => ({ ...tier, top: Math.min(tier.top, builtTo) }))
  result.roofs = roofsFor(rng, { ...top, top: Math.min(top.top, builtTo) }, name, height, result)
  result.signs = signsFor(rng, result, name, ground, Math.min(height, builtTo - ground))
  return result
}

function darkBlock(rng: Rng, x0: number, width: number, ground: number, height: number): Rect {
  const y0 = ground + height * rng.range(0.1, 0.7)
  const x = x0 + width * rng.range(0, 0.5)
  return { x0: x, x1: x + width * rng.range(0.3, 0.7), y0, y1: y0 + height * rng.range(0.1, 0.35) }
}

/** Lays out one layer of the city. The same seed and level always give the same buildings. */
export function layOutLayer(spec: LayerSpec, levelWidth: number, ground: number, seed: number): Layer {
  const sheet = layerSheet(spec, levelWidth, ground)
  const plan = PLANS[spec.name]
  const rng = createRng(seed * 7919 + spec.z * 31)
  const busy = downtown(rng, sheet, plan.centres)
  const buildings: Building[] = []
  plan.rows.forEach((row, rowIndex) => {
    let x = sheet.left - rng.range(0, row.width[1])
    while (x < sheet.right) {
      const width = rng.range(row.width[0], row.width[1])
      const pull = rowIndex === 0 ? busy(x + width / 2) : 1
      const [low, high] = row.height
      const height = Math.min(spec.rise - 4, low + (high - low) * rng.next() ** plan.spread * pull)
      buildings.push(building(rng, buildings.length, rowIndex, x, width, height, spec.name, plan, ground))
      x += width + (rng.chance(row.gap) ? rng.range(2, 9) : rng.range(-3, 0.3))
    }
  })
  return { spec, sheet, ground, buildings, rail: plan.rail ? ground + rng.range(18, 26) : null }
}

/** One window: its rectangle and indices. */
export type WindowCell = { x: number; y: number; w: number; h: number; floor: number; column: number }

/** Calls `visit` for every window of a building, tier by tier, skipping the ground-floor shopfronts. */
export function forEachWindow(building: Building, ground: number, visit: (cell: WindowCell) => void): void {
  let base = ground + building.floor * 0.6
  for (const tier of building.tiers) {
    const columns = Math.floor((tier.x1 - tier.x0 - 0.6) / building.column)
    const inset = (tier.x1 - tier.x0 - columns * building.column) / 2
    const w = building.column * building.windowWide
    const h = building.floor * building.windowTall
    for (let floor = Math.ceil((base - ground) / building.floor); ground + (floor + 1) * building.floor < tier.top - 0.4; floor += 1) {
      const y = ground + floor * building.floor + (building.floor - h) / 2
      for (let index = 0; index < columns; index += 1) {
        const x = tier.x0 + inset + index * building.column + (building.column - w) / 2
        visit({ x, y, w, h, floor, column: Math.round((x - building.x0) / building.column) })
      }
    }
    base = tier.top
  }
}

/**
 * How brightly a window is lit (0 = dark), from the mood's share of lit windows. Offices light whole floors,
 * flats light in clusters, some floors are dark, and blocks of rooms stand empty.
 */
export function windowLight(building: Building, cell: WindowCell, odds: number): number {
  if (cell.y > building.builtTo - 2) return 0
  const dark = building.dark
  if (dark && cell.x > dark.x0 && cell.x < dark.x1 && cell.y > dark.y0 && cell.y < dark.y1) return 0
  const share = Math.min(0.95, odds * building.litBias)
  const floorRoll = hash3(building.id, cell.floor, 101)
  const own = hash3(building.id * 977 + cell.column, cell.floor, 103)
  if (building.facade === 'curtain' || building.facade === 'bands') {
    // Open-plan floors are lit or not as a whole, with the odd desk lamp left on.
    if (floorRoll < share * 0.9) return 0.65 + 0.35 * own
    return own < 0.04 ? 0.5 : 0
  }
  if (floorRoll > 1 - share * 0.3) return own < 0.9 ? 0.6 + 0.4 * own : 0
  if (floorRoll < 0.18) return own < share * 0.15 ? 0.7 : 0
  const cluster = hash3(building.id, cell.floor * 53 + Math.floor(cell.column / 3), 107)
  return cluster < share && own < 0.85 ? 0.45 + 0.55 * hash3(cell.column, cell.floor, building.id) : 0
}

/** Warm or cold, chosen per building with a few odd ones out. */
export function windowIsWarm(building: Building, cell: WindowCell): boolean {
  return hash3(building.id, cell.floor * 131 + cell.column, 109) < building.warmth
}
