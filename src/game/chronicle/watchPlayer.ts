import { searchFilter } from '../intel/area'
import { describeFilter } from '../intel/describe'
import { TOOLS } from '../toolDefs'
import { centerOf, distance } from '../types'
import type { World } from '../world'
import { note } from './note'

/**
 * The player's own moments: touching down, the first shot, a brush with death, a bullet that just missed, picking
 * up the case, and how it ended. All compared against last frame's few numbers, so it costs next to nothing.
 */

const LOW_HEALTH = 20
const RECOVERED = 50
const NEAR_MISS = 0.75

export function watchPlayer(world: World): void {
  const seen = world.chronicle.player
  const player = world.player
  if (!seen.landed && player.onGround) {
    seen.landed = true
    note(world, 'landed', player)
  }
  const rounds = totalRounds(world)
  if (seen.rounds >= 0 && rounds < seen.rounds) {
    const tool = TOOLS[player.tool]?.name ?? 'gun'
    if (world.chronicle.tally.shots === 0) note(world, 'firstShot', player, { detail: tool })
    world.chronicle.tally.shots += seen.rounds - rounds
    seen.lastShotAt = world.clock
    seen.lastShotTool = tool
  }
  seen.rounds = rounds
  watchHealth(world)
  watchBullets(world)
  if (!seen.hasLoot && player.hasLoot) {
    seen.hasLoot = true
    const filter = searchFilter(world.intel)
    note(world, 'caseFound', player, { detail: filter ? describeFilter(filter) : undefined })
  }
  if (seen.status === 'playing' && world.status !== 'playing') {
    seen.status = world.status
    note(world, world.status === 'won' ? 'escaped' : 'died', player)
  }
}

/** Rounds in magazines and spares together: a reload moves rounds between them, firing or throwing spends one. */
function totalRounds(world: World): number {
  let total = 0
  const { ammo, mags } = world.player
  for (let index = 0; index < ammo.length; index += 1) if (Number.isFinite(ammo[index])) total += ammo[index] + (mags[index] ?? 0)
  return total
}

function watchHealth(world: World): void {
  const seen = world.chronicle.player
  const hp = world.player.hp
  if (!seen.lowHealth && hp > 0 && hp < LOW_HEALTH) {
    seen.lowHealth = true
    world.chronicle.tally.closeCalls += 1
    note(world, 'lowHealth', world.player, { n: Math.ceil(hp) })
  } else if (seen.lowHealth && hp > RECOVERED) seen.lowHealth = false
}

/** A guard's round that came within a hand's width and flew on. */
function watchBullets(world: World): void {
  const seen = world.chronicle.player
  if (world.projectiles.length === 0 && seen.nearby.size === 0) return
  const body = centerOf(world.player)
  const close = new Set<object>()
  for (const shot of world.projectiles) {
    if (shot.fromPlayer || distance(shot, body) > NEAR_MISS) continue
    close.add(shot)
  }
  for (const shot of seen.nearby) {
    if (close.has(shot) || !world.projectiles.includes(shot as World['projectiles'][number])) continue
    world.chronicle.tally.closeCalls += 1
    if (!world.chronicle.beats.some((beat) => beat.kind === 'nearMiss')) note(world, 'nearMiss', world.player)
  }
  seen.nearby = close
}
