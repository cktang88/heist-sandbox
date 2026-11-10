import { PointLight, type Group } from 'three'
import type { Flash } from '../../game/effects'
import { fireCells, flashViews, type FireCell } from '../../game/hazards/hazards'
import type { Vec } from '../../game/types'
import type { World } from '../../game/world'

/** Pooled lights for things that burst or burn: flashbangs, explosions, muzzle flashes and fires. */
export const EVENT_LIGHTS = 4
const FIRE_COLOR = 0xff8a3a
const MUZZLE_COLOR = 0xffc070
const BLAST_COLOR = 0xffa050
const FLASHBANG_COLOR = 0xf4f7ff
/** Fires and bursts farther than this from the view centre do not get a light, in tiles. */
const RANGE = 34

export type EventLights = { update(world: World, view: Vec): void }

function far(at: Vec, view: Vec): boolean {
  return Math.abs(at.x - view.x) > RANGE || Math.abs(at.y - view.y) > RANGE * 0.7
}

/** How much a fire matters: hot and near the middle of the view. */
function heat(cell: FireCell, view: Vec): number {
  return cell.intensity / (1 + Math.abs(cell.x - view.x) / 20)
}

/** The biggest burst not yet given a light, or -1. */
function biggestFlash(flashes: readonly Flash[], view: Vec, taken: Int32Array): number {
  let best = -1
  for (let index = 0; index < flashes.length; index += 1) {
    const flash = flashes[index]
    if (flash.kind === 'noise' || far(flash, view) || taken.includes(index)) continue
    if (best < 0 || flash.radius > flashes[best].radius) best = index
  }
  return best
}

export function createEventLights(group: Group): EventLights {
  const lights = Array.from({ length: EVENT_LIGHTS }, () => new PointLight(MUZZLE_COLOR, 0, 16, 1.6))
  group.add(...lights)
  const taken = new Int32Array(EVENT_LIGHTS)
  let used = 0
  const take = (x: number, y: number, z: number, color: number, intensity: number, distance: number) => {
    if (used >= EVENT_LIGHTS) return
    const light = lights[used]
    light.position.set(x, -y, z)
    light.color.setHex(color)
    light.intensity = intensity
    light.distance = distance
    used += 1
  }
  const fire = (cell: FireCell, seed: number, time: number) => {
    const t = time * 9 + seed * 1.7
    const flicker = 0.7 + 0.18 * Math.sin(t) + 0.12 * Math.sin(t * 2.3 + 1.1)
    take(cell.x + 0.5, cell.y + 0.3, -0.6, FIRE_COLOR, 40 * cell.intensity * flicker, 10)
  }

  return {
    update(world, view) {
      used = 0
      // A flashbang whites out the room for an instant, then fades fast.
      for (const bang of flashViews(world)) {
        if (!far(bang, view)) take(bang.x, bang.y, 0.3, FLASHBANG_COLOR, 2400 * bang.life * bang.life, 28)
      }
      // The two biggest fires near the view, flickering like flames. Never more, so bursts still get lights.
      const cells = fireCells(world)
      let first = -1
      let second = -1
      for (let index = 0; index < cells.length; index += 1) {
        if (far(cells[index], view)) continue
        if (first < 0 || heat(cells[index], view) > heat(cells[first], view)) {
          second = first
          first = index
        } else if (second < 0 || heat(cells[index], view) > heat(cells[second], view)) second = index
      }
      if (first >= 0) fire(cells[first], 0, world.clock)
      if (second >= 0) fire(cells[second], 1, world.clock)
      // Then the biggest bursts: an explosion lights up the whole floor, a muzzle flash the corridor.
      taken.fill(-1)
      for (let pick = 0; used < EVENT_LIGHTS; pick += 1) {
        const best = biggestFlash(world.effects.flashes, view, taken)
        if (best < 0) break
        taken[pick] = best
        const flash = world.effects.flashes[best]
        const left = flash.life / flash.duration
        if (flash.kind === 'explosion') take(flash.x, flash.y, 0.4, BLAST_COLOR, 500 * left, 22)
        else take(flash.x, flash.y, 0.4, MUZZLE_COLOR, 60 * left, 12)
      }
      for (let index = used; index < EVENT_LIGHTS; index += 1) lights[index].intensity = 0
    },
  }
}
