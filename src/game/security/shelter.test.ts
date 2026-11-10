import { describe, expect, it } from 'vitest'
import { createProps } from '../cover'
import { hurtGuard } from '../guards'
import { enterCombat } from './combat'
import { eyeOf, feetOf, type Guard } from './model'
import { exposedTo } from './lineOfFire'
import { addGuard, addLamp, arena, GROUND, playerFires, playerHand, putPlayer, run } from './testArena'
import type { World } from '../world'

/** "Never stand in the open under fire": cover that blocks the shooter's line, kneel, peek to shoot; or get out of the way. */

/** Rifle rounds just over a guard's head, `rounds` of them, while the game runs. Returns seconds he spent standing still in the open. */
function fireOverHead(world: World, guard: Guard, rounds: number, every = 0.3): { exposedStill: number; peekShots: number } {
  let exposedStill = 0
  let peekShots = 0
  for (let shot = 0; shot < rounds; shot += 1) {
    const head = eyeOf(guard)
    playerFires(world, { x: head.x, y: head.y - 0.9 })
    run(world, every, {}, () => {
      if (world.clock > 1.5 && exposedTo(world, playerHand(world), feetOf(guard), guard.crouching) && !guard.peeking && Math.abs(guard.vx) < 0.3) exposedStill += 1 / 60
      if (guard.peeking && guard.kick > 0.69) peekShots += 1
    })
  }
  return { exposedStill, peekShots }
}

function litFloor(): World {
  const world = arena()
  putPlayer(world, 20)
  addLamp(world, 20)
  addLamp(world, 34)
  return world
}

describe('under fire', () => {
  it('a guard shot at in the open runs to cover that blocks the line, kneels behind it, and peeks out to fire back', () => {
    const world = litFloor()
    world.props = createProps([{ kind: 'desk', x: 27, y: GROUND }, { kind: 'filingCabinet', x: 37, y: GROUND }])
    // A veteran, so thirty rounds over his head do not simply break his nerve (fear.ts has its own tests).
    const guard = addGuard(world, 33, -1, 'post', GROUND, 'veteran')
    guard.hp = guard.maxHp = 1e5
    // Slow enough fire that he is not simply pinned flat the whole time.
    const seen = fireOverHead(world, guard, 15, 0.8)
    expect(guard.mode).toBe('combat')
    expect(guard.shelter?.hidden).toBe(true)
    expect(exposedTo(world, playerHand(world), guard.shelter!, true)).toBe(false)
    expect(seen.exposedStill).toBeLessThan(1)
    expect(seen.peekShots).toBeGreaterThan(0)
  })

  it('with no cover in reach he gets out of the line of fire rather than standing in it', () => {
    const world = litFloor()
    const guard = addGuard(world, 30, -1)
    guard.hp = guard.maxHp = 1e5
    fireOverHead(world, guard, 10)
    expect(Math.abs(feetOf(guard).x - 20)).toBeGreaterThan(18)
  })

  it('seeing a colleague hit sends a fighting guard to cover too', () => {
    const world = litFloor()
    world.props = createProps([{ kind: 'filingCabinet', x: 34, y: GROUND }])
    const victim = addGuard(world, 27, -1)
    const witness = addGuard(world, 31, -1)
    for (const guard of [victim, witness]) enterCombat(world, guard, { x: 20, y: GROUND - 1 })
    run(world, 0.1)
    hurtGuard(world, victim, 30, { x: 20, y: GROUND - 1 })
    run(world, 2.5)
    expect(witness.shelter?.hidden).toBe(true)
    expect(witness.shelter!.x).toBeGreaterThan(35)
  })
})
