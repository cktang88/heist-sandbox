import { isVehicle } from '../vehicles/vehicles'
import type { World } from '../world'
import { note } from './note'

/**
 * Big destruction: explosions (each new blast flash), storeys coming down (a burst of falling structure), fires that
 * take hold and how big they got, and vehicles wrecked.
 */

/** Blasts this close together are one moment in the story. */
const BLAST_BEAT_GAP = 8
/** Falling tiles at once that make a collapse worth telling, rather than a few loose bricks. */
const COLLAPSE_TILES = 30
/** Burning tiles at once that make a fire worth telling. */
const BLAZE_TILES = 12

/** Every step: a blast flash lives only a moment. */
export function watchBlasts(world: World): void {
  const seen = world.chronicle.destruction
  for (const flash of world.effects.flashes) {
    if (flash.kind !== 'explosion' || seen.blasts.has(flash)) continue
    seen.blasts.add(flash)
    seen.lastBlast = { x: flash.x, y: flash.y, t: world.clock }
    world.chronicle.tally.explosions += 1
    if (world.clock - seen.lastBlastBeat < BLAST_BEAT_GAP) continue
    seen.lastBlastBeat = world.clock
    note(world, 'explosion', { x: flash.x, y: flash.y + 1 }, { n: world.chronicle.tally.explosions })
  }
}

/** A few times a second. */
export function watchWreckage(world: World): void {
  const seen = world.chronicle.destruction
  const falling = world.falling.length
  if (!seen.falling && falling >= COLLAPSE_TILES) {
    seen.falling = true
    world.chronicle.tally.collapses += 1
    const middle = world.falling[Math.floor(falling / 2)]
    note(world, 'collapse', { x: middle.x + 0.5, y: middle.y + 1 }, { n: falling })
  } else if (seen.falling && falling === 0) seen.falling = false
  watchFire(world)
  watchVehicles(world)
}

function watchFire(world: World): void {
  const seen = world.chronicle.destruction
  const tally = world.chronicle.tally
  const burning = world.hazards.fires.size
  tally.maxFire = Math.max(tally.maxFire, burning)
  if (!seen.blaze && burning >= BLAZE_TILES) {
    seen.blaze = true
    const first = world.hazards.fires.values().next().value
    if (first) note(world, 'fire', { x: first.x + 0.5, y: first.y + 1 }, { n: burning })
  } else if (seen.blaze) {
    const beat = [...world.chronicle.beats].reverse().find((old) => old.kind === 'fire')
    if (beat) beat.n = Math.max(beat.n ?? 0, burning)
    if (burning === 0) seen.blaze = false
  }
}

function watchVehicles(world: World): void {
  const seen = world.chronicle.destruction
  seen.vehicles ??= world.props.filter(isVehicle).map((prop) => prop.id)
  for (const id of seen.vehicles) {
    const prop = world.props[id]?.id === id ? world.props[id] : world.props.find((candidate) => candidate.id === id)
    if (!prop?.broken || seen.wrecked.has(id)) continue
    seen.wrecked.add(id)
    world.chronicle.tally.vehiclesLost += 1
    note(world, 'vehicle', { x: prop.x + 1, y: prop.y }, { detail: prop.kind })
  }
}
