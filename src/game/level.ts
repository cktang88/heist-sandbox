import { createRng, randomInt, type Rng } from './rng'
import { createGrid, fillTiles, setTile, type Grid } from './tiles'
import type { Rect, Vec } from './types'

export const WORLD_WIDTH = 150
export const WORLD_HEIGHT = 72
/** First solid row. Anything standing on the surface has its feet at this y. */
export const GROUND = 40
const STOREY = 6

export type GuardSpawn = Vec & { facing: 1 | -1 }
/** An indoor or underground area, so the renderer can draw a back wall instead of sky. */
export type Interior = Rect & { kind: 'room' | 'earth' }
/** A light fitting. Hung lamps go dark when the ceiling tile above them is destroyed. */
export type Lamp = Vec & { radius: number; color: 'warm' | 'cold' | 'green'; hung: boolean }
export type Level = { grid: Grid; playerStart: Vec; extraction: Rect; loot: Vec; guards: GuardSpawn[]; interiors: Interior[]; lamps: Lamp[] }

const BUILDING = { left: 70, right: 118 }
const BASEMENT = { left: 74, right: 94, top: 43, bottom: 47 }
const VAULT = { left: 96, right: 110, top: 43, bottom: 47 }
const BASEMENT_LADDER_X = 77
const SEWER = { left: 16, right: 100, top: 54, bottom: 57 }

/**
 * One heist site: a guarded building with a vault in the basement, plus a
 * sewer running underneath. Three ways in: roof, front door, or underground.
 */
export function createLevel(seed: number): Level {
  const rng = createRng(seed)
  const grid = createGrid(WORLD_WIDTH, WORLD_HEIGHT)
  const storeys = randomInt(rng, 3, 5)
  const guards: GuardSpawn[] = []
  const lamps: Lamp[] = []

  fillTiles(grid, 0, GROUND, WORLD_WIDTH - 1, WORLD_HEIGHT - 3, 'dirt')
  fillTiles(grid, 0, WORLD_HEIGHT - 2, WORLD_WIDTH - 1, WORLD_HEIGHT - 1, 'bedrock')

  buildTower(grid, rng, storeys, guards, lamps)
  buildBasement(grid)
  buildSewer(grid)

  guards.push({ x: 64, y: GROUND, facing: -1 })
  guards.push({ x: 84, y: BASEMENT.bottom + 1, facing: 1 })
  guards.push({ x: 100, y: VAULT.bottom + 1, facing: -1 })
  guards.push({ x: 60, y: SEWER.bottom + 1, facing: -1 })

  const roof = GROUND - storeys * STOREY
  return {
    grid,
    guards,
    lamps: [...lamps, ...fixedLamps()],
    interiors: [
      { kind: 'room', x: BUILDING.left, y: roof, w: BUILDING.right - BUILDING.left + 1, h: GROUND - roof },
      { kind: 'earth', x: 0, y: GROUND, w: WORLD_WIDTH, h: WORLD_HEIGHT - GROUND },
    ],
    playerStart: { x: 46, y: 1 },
    extraction: { x: 3, y: GROUND - 4, w: 8, h: 4 },
    loot: { x: 104, y: VAULT.bottom + 1 },
  }
}

function buildTower(grid: Grid, rng: Rng, storeys: number, guards: GuardSpawn[], lamps: Lamp[]): void {
  const { left, right } = BUILDING
  const roof = GROUND - storeys * STOREY
  fillTiles(grid, left, roof, right, GROUND - 1, 'air')
  fillTiles(grid, left, GROUND, right, GROUND, 'concrete')
  fillTiles(grid, left, roof, left, GROUND - 1, 'brick')
  fillTiles(grid, right, roof, right, GROUND - 1, 'brick')

  let ladderX = randomInt(rng, left + 4, right - 4)
  let holeX = BASEMENT_LADDER_X
  for (let storey = 0; storey < storeys; storey += 1) {
    const floorY = GROUND - storey * STOREY
    const ceilingY = floorY - STOREY
    fillTiles(grid, left, ceilingY, right, ceilingY, 'concrete')

    if (storey > 0) {
      fillTiles(grid, left, floorY - 4, left, floorY - 3, 'glass')
      fillTiles(grid, right, floorY - 4, right, floorY - 3, 'glass')
    }

    // Partition walls with a door at the bottom, kept clear of the ladders.
    const wallX = pickWallX(rng, left, right, ladderX)
    fillTiles(grid, wallX, ceilingY + 1, wallX, floorY - 4, 'brick')
    fillTiles(grid, wallX, floorY - 3, wallX, floorY - 1, 'door')

    // Ladder up to the next storey. The top one ends at a locked roof hatch.
    fillTiles(grid, ladderX, ceilingY + 1, ladderX, floorY - 1, 'ladder')
    setTile(grid, ladderX, ceilingY, storey === storeys - 1 ? 'door' : 'ladder')

    for (let x = left + 6; x < right - 3; x += 11) lamps.push({ x: x + 0.5, y: ceilingY + 1.2, radius: 8, color: 'warm', hung: true })

    const blocked = [wallX, ladderX, holeX]
    guards.push({ x: pickClearX(rng, left + 3, right - 3, blocked), y: floorY, facing: rng() < 0.5 ? 1 : -1 })
    if (storey > 0 && rng() < 0.6) guards.push({ x: pickClearX(rng, left + 3, right - 3, blocked), y: floorY, facing: 1 })
    holeX = ladderX

    const nextLadder = randomInt(rng, left + 4, right - 4)
    ladderX = Math.abs(nextLadder - ladderX) < 6 ? (ladderX < (left + right) / 2 ? right - 5 : left + 5) : nextLadder
  }

  // Front door, skylight, and a guard walking the roof.
  fillTiles(grid, left, GROUND - 3, left, GROUND - 1, 'door')
  const skylight = randomInt(rng, left + 6, right - 10)
  fillTiles(grid, skylight, roof, skylight + 3, roof, 'glass')
  guards.push({ x: right - 6, y: roof, facing: -1 })
}

/** Picks a column that is not a wall, a ladder, or a hole in the floor. */
function pickClearX(rng: Rng, min: number, max: number, blocked: number[]): number {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const x = randomInt(rng, min, max)
    if (blocked.every((other) => Math.abs(other - x) > 1)) return x
  }
  return min
}

function pickWallX(rng: Rng, left: number, right: number, ladderX: number): number {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const x = randomInt(rng, left + 8, right - 8)
    if (Math.abs(x - ladderX) > 3) return x
  }
  return ladderX < (left + right) / 2 ? right - 9 : left + 9
}

/** Street lights, plus the dim fittings in the basement, vault and sewer. */
function fixedLamps(): Lamp[] {
  const lamps: Lamp[] = []
  for (const x of [8, 34, 58]) lamps.push({ x: x + 0.5, y: GROUND - 5.5, radius: 9, color: 'warm', hung: false })
  for (const x of [80, 90]) lamps.push({ x: x + 0.5, y: BASEMENT.top + 0.2, radius: 7, color: 'cold', hung: true })
  lamps.push({ x: 103.5, y: VAULT.top + 0.2, radius: 8, color: 'cold', hung: true })
  for (let x = 24; x < SEWER.right; x += 18) lamps.push({ x: x + 0.5, y: SEWER.top + 0.2, radius: 6, color: 'green', hung: true })
  return lamps
}

function buildBasement(grid: Grid): void {
  // Corridor reached by a ladder from the ground floor.
  fillTiles(grid, BASEMENT.left - 1, BASEMENT.top - 1, BASEMENT.right, BASEMENT.bottom + 1, 'concrete')
  fillTiles(grid, BASEMENT.left, BASEMENT.top, BASEMENT.right, BASEMENT.bottom, 'air')
  fillTiles(grid, BASEMENT_LADDER_X, GROUND, BASEMENT_LADDER_X, BASEMENT.bottom, 'ladder')

  // Steel vault with a locked door facing the corridor.
  fillTiles(grid, VAULT.left - 1, VAULT.top - 1, VAULT.right + 1, VAULT.bottom + 1, 'steel')
  fillTiles(grid, VAULT.left, VAULT.top, VAULT.right, VAULT.bottom, 'air')
  fillTiles(grid, VAULT.left - 1, VAULT.bottom - 2, VAULT.left - 1, VAULT.bottom, 'door')
}

function buildSewer(grid: Grid): void {
  fillTiles(grid, SEWER.left - 1, SEWER.top - 1, SEWER.right + 1, SEWER.bottom + 1, 'brick')
  fillTiles(grid, SEWER.left, SEWER.top, SEWER.right, SEWER.bottom, 'air')
  fillTiles(grid, SEWER.left, SEWER.bottom, SEWER.right, SEWER.bottom, 'water')

  // Manhole from the street, far from the building.
  fillTiles(grid, 20, GROUND, 20, SEWER.bottom - 1, 'ladder')

  // Ladder up to a locked hatch in the basement floor.
  fillTiles(grid, 88, BASEMENT.bottom + 2, 88, SEWER.bottom - 1, 'ladder')
  setTile(grid, 88, BASEMENT.bottom + 1, 'door')
}
