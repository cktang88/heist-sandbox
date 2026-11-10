import { describe, expect, it } from 'vitest'
import { explode, ROCKET_BLAST } from '../explosions'
import { emitNoise } from '../noise'
import { fireShot } from '../projectiles'
import { normalize } from '../vision'
import { enterCombat } from './combat'
import { eyeOf, type Guard } from './model'
import { addGuard, addLamp, arena, GROUND, putPlayer, run } from './testArena'
import { RESPONSE } from './tuning'

const goingToLook = (guards: Guard[]) => guards.filter((guard) => guard.interest !== null && (guard.mode === 'noticed' || guard.mode === 'investigating'))

describe('proportionate responses', () => {
  it('a small sound sends one guard to look; the others who heard it only turn their heads', () => {
    const world = arena()
    putPlayer(world, 140)
    const guards = [40, 44, 48, 52].map((x) => addGuard(world, x, 1))
    emitNoise(world, { x: 46, y: GROUND - 1 }, 9)
    run(world, 0.5)
    expect(goingToLook(guards).length).toBe(1)
    expect(guards.filter((guard) => guard.mode === 'calm').length).toBe(3)
  })

  it('gunfire brings the few nearest guards who heard it, not everyone in earshot', () => {
    const world = arena()
    putPlayer(world, 140)
    const guards = [30, 34, 38, 42, 46, 50, 54, 58].map((x) => addGuard(world, x, 1))
    emitNoise(world, { x: 44, y: GROUND - 1 }, 28)
    run(world, 0.5)
    expect(goingToLook(guards).length).toBe(RESPONSE.gunfire)
    expect(guards.every((guard) => guard.mode !== 'calm')).toBe(true)
  })

  it('an explosion is called in, brings the response team, and locks the site down once the lifts are recalled', () => {
    const world = arena()
    putPlayer(world, 140)
    const guards = [30, 36, 70].map((x) => addGuard(world, x, 1))
    explode(world, { x: 50, y: GROUND - 2 }, ROCKET_BLAST)
    run(world, 5)
    expect(world.security.level).toBe(3)
    expect(world.guards.filter((guard) => guard.armored).length).toBe(3)
    expect(world.security.log.some((line) => line.includes('Explosion'))).toBe(true)
    expect(guards.some((guard) => guard.radio?.event.kind === 'explosion' || guard.mode !== 'calm')).toBe(true)
    run(world, RESPONSE.lockdownDelay)
    expect(world.security.level).toBe(4)
  })

  it('a guard pinned down on his own radios for backup and the control room sends someone', () => {
    const world = arena()
    putPlayer(world, 20)
    addLamp(world, 20)
    const pinned = addGuard(world, 30, -1)
    const spare = addGuard(world, 90, 1, 'patrol')
    spare.route = [{ x: 85.5, y: GROUND }, { x: 95.5, y: GROUND }]
    enterCombat(world, pinned, { x: 20, y: GROUND - 1 })
    for (let shot = 0; shot < 8; shot += 1) {
      const from = { x: 20.3, y: GROUND - 1.2 }
      const head = eyeOf(pinned)
      fireShot(world, from, normalize(head.x - from.x, head.y - 0.9 - from.y), { kind: 'bullet', fromPlayer: true, speed: 80, damage: 26, tileDamage: 0, spread: 0, push: 0 })
      run(world, 0.1)
    }
    run(world, 4)
    expect(world.security.log.some((line) => line.includes('Need backup'))).toBe(true)
    expect(spare.mode).not.toBe('calm')
    expect(spare.interest?.kind ?? 'order').toBe('order')
  })
})
