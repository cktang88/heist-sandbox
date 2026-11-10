import { isSolidAt, tileAt } from '../tiles'
import type { Vec } from '../types'
import type { World } from '../world'
import { blown, feet, FRAME, note, placeAt, tick, type Run } from './kit'
import { walkTo, type WalkOptions, type WalkResult } from './walker'

/**
 * The ways into the tower a stealth player can take, as scripted moves: where each one starts and the climbs that the
 * route planner (which only knows floors and staircases) cannot do on its own.
 */

/** A hatch, shut or opened: a door tile (or the gap it left) set in a floor, with a ladder under it. */
function isHatch(world: World, x: number, y: number): boolean {
  return (tileAt(world.grid, x, y) === 'door' || tileAt(world.grid, x, y) === 'air') && tileAt(world.grid, x, y + 1) === 'ladder'
}

/** The street manhole nearest the van: outside the fence, so nobody sees the player go down. */
export function streetManhole(world: World): Vec {
  const vanX = world.extraction.x + world.extraction.w / 2
  let best: Vec | null = null
  for (let x = 0; x < world.grid.width; x += 1) {
    if (!isHatch(world, x, world.groundY)) continue
    if (!best || Math.abs(x - vanX) < Math.abs(best.x - vanX)) best = { x, y: world.groundY }
  }
  if (!best) throw new Error('no manhole on the street')
  return best
}

/** The service hatch from the sewer up into the tower's lowest basement. */
export function basementHatch(world: World): Vec {
  const lowest = Math.max(...world.rooms.filter((room) => room.building === 'tower').map((room) => room.floorY))
  for (let x = 0; x < world.grid.width; x += 1) if (isHatch(world, x, lowest)) return { x, y: lowest }
  throw new Error('no hatch from the sewer into the tower')
}

/** The sewer's floor row (feet), read from its room. */
export function sewerFloor(world: World): number {
  return world.rooms.find((room) => room.kind === 'sewer')!.floorY
}

/**
 * Climbs the ladder in column `x` up or down to feet row `toY`, opening (picking) any hatch in the way, and steps off
 * onto the floor beside it at the top. Returns false if the run was blown or the climb stalled.
 */
export function climbLadder(run: Run, x: number, toY: number, maxAlert = 1): boolean {
  const { world } = run
  const up = toY < feet(world).y
  let stalled = 0
  let lastY = world.player.y
  for (let frame = 0; frame < 30 / FRAME; frame += 1) {
    if (blown(run, maxAlert)) return false
    const at = feet(world)
    if (Math.abs(at.y - toY) < 0.15 && world.player.onGround) return true
    const offCentre = x + 0.5 - at.x
    const prompt = world.prompt ?? ''
    const hatch = stalled > 0.2 && /lock|door/.test(prompt) && !/shut|close/.test(prompt)
    if (hatch) {
      tick(run, { interact: true, interactPressed: prompt.startsWith('E:') && frame % 2 === 0, crouch: false })
      continue
    }
    // At the top: step off the ladder onto the floor.
    const atTop = up && Math.abs(at.y - toY) < 0.6
    // Off the top toward whichever side has room to stand.
    const offRight = !isSolidAt(world.grid, x + 1, toY - 1)
    const side = atTop ? (offRight ? { right: true } : { left: true }) : Math.abs(offCentre) > 0.15 ? (offCentre > 0 ? { right: true } : { left: true }) : {}
    tick(run, { up: up && !atTop, down: !up, crouch: false, ...side })
    stalled = Math.abs(world.player.y - lastY) < 0.001 ? stalled + FRAME : 0
    lastY = world.player.y
    if (stalled > 6) {
      note(run, `stalled on the ladder at ${at.x.toFixed(1)},${at.y.toFixed(1)}`)
      return false
    }
  }
  return false
}

/** Down the street manhole, along the sewer, and up through the hatch into the tower's lowest basement. */
export function enterBySewer(run: Run, options: WalkOptions = {}): WalkResult {
  const { world } = run
  const manhole = streetManhole(world)
  const hatch = basementHatch(world)
  const sewer = sewerFloor(world)
  placeAt(world, manhole.x + 0.5 + (world.extraction.x < manhole.x ? -3 : 3), world.groundY)
  tick(run)
  if (walkTo(run, { x: manhole.x + 0.5, y: world.groundY }, options) !== 'arrived') return 'blown'
  if (!climbLadder(run, manhole.x, sewer, options.maxAlert)) return 'blown'
  note(run, 'in the sewer')
  if (walkTo(run, { x: hatch.x + 0.5, y: sewer }, options) !== 'arrived') return 'blown'
  if (!climbLadder(run, hatch.x, hatch.y, options.maxAlert)) return 'blown'
  note(run, 'up through the basement hatch')
  return 'arrived'
}

/** Landed on the tower roof (the parachute drop), a few steps from the main stairs. */
export function enterByRoof(run: Run): WalkResult {
  const { world } = run
  const roof = world.rooms.find((room) => room.kind === 'rooftop' && room.building === 'tower')!
  const well = world.stairwells.find((candidate) => candidate.building === 'tower' && candidate.stops.includes(roof.floorY))!
  const top = well.stops.indexOf(roof.floorY)
  const landing = top % 2 === 0 ? well.leftX : well.rightX
  placeAt(world, landing + 3, roof.floorY)
  tick(run)
  return 'arrived'
}
