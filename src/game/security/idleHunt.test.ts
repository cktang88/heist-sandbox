import { describe, expect, it } from 'vitest'
import { canWalkAcross } from '../gaps/gaps'
import { fillTiles } from '../tiles'
import type { Vec } from '../types'
import { createWorld, type World } from '../world'
import { enterCombat } from './combat'
import { perturb, PERTURBATIONS, scriptedFight } from './fightScript'
import { floorHoleSpot, outsideWindowSpot, roofSpot, sewerHatchSpot, stairDoorSpot, stairLandingSpot } from './fightSpots'
import { addGuard } from './testArena'

/**
 * The idle hunt (fightScript.ts) on more spots and seeds than complexFights.test.ts: the sewer manhole, firing down
 * through a hole blown in a tower floor, hanging on the grappling line outside a window, and the stairwell and roof
 * spots on other seeds. Nobody who knows about the fight may stand about.
 */

type Hunt = { name: string; seed: number; place: (world: World) => Vec }

/** The yard manhole, with a guard on the ground above it already fighting the man below. */
function sewer(world: World): Vec {
  const spot = sewerHatchSpot(world)
  const guard = addGuard(world, spot.x + 3, -1, 'patrol', world.groundY)
  guard.hp = guard.maxHp = 1e5
  enterCombat(world, guard, { x: spot.x, y: spot.y - 1 })
  return spot
}

function floorHole(world: World): Vec {
  const { spot, hole } = floorHoleSpot(world)
  // The slab map is taken before the blast, as in a real heist.
  canWalkAcross(world, hole.x0, hole.y)
  fillTiles(world.grid, hole.x0, hole.y, hole.x1, hole.y, 'air')
  return spot
}

/** Hanging on the grappling line outside a west window, the hook in the wall well above it. */
function grappleLine(world: World): Vec {
  const spot = outsideWindowSpot(world)
  const wall = Math.round(spot.x + 1.4)
  Object.assign(world.grapple, { phase: 'attached', hanging: true, anchor: { x: wall, y: spot.y - 10 }, hook: { x: wall + 0.5, y: spot.y - 9.5 }, length: 9 })
  return spot
}

function roof(world: World): Vec {
  const { spot, skylight } = roofSpot(world)
  fillTiles(world.grid, skylight.x0, skylight.y, skylight.x1, skylight.y, 'air')
  return spot
}

const HUNTS: Hunt[] = [
  { name: 'in the sewer under the yard manhole', seed: 1, place: sewer },
  { name: 'firing down through a hole in a tower floor', seed: 1, place: floorHole },
  { name: 'on the grappling line outside a window', seed: 1, place: grappleLine },
  { name: 'from a stair landing', seed: 2, place: stairLandingSpot },
  { name: 'through a stairwell door', seed: 2, place: stairDoorSpot },
  { name: 'firing down through a hole in a tower floor', seed: 2, place: floorHole },
  // (Seed 3's top executive room has nobody within reach of the roof, so there is no fight to watch there.)
  { name: 'from the roof beside a skylight', seed: 4, place: roof },
  { name: 'in the sewer under the yard manhole', seed: 3, place: sewer },
]

/** A whole fight on the big site can take a minute on a busy machine. */
const FIGHT_TIMEOUT = 240_000

const CASES = HUNTS.flatMap((hunt) => PERTURBATIONS.map((draws) => ({ hunt, draws })))

describe('the idle hunt on more spots and seeds', () => {
  it.each(CASES)('nobody aware of the fight stands idle: player $hunt.name (seed $hunt.seed, $draws extra draws)', ({ hunt, draws }) => {
    const world = createWorld(hunt.seed, 'complex')
    perturb(world, draws)
    const spot = hunt.place(world)
    world.structureChanged = true
    const report = scriptedFight(world, spot, 30)
    expect(report.engaged).toBeGreaterThan(0)
    expect(report.idle).toEqual([])
  }, FIGHT_TIMEOUT)
})
