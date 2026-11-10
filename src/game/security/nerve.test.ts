import { describe, expect, it } from 'vitest'
import { explode, ROCKET_BLAST } from '../explosions'
import { hurtGuard } from '../guards'
import { fireShot } from '../projectiles'
import { normalize } from '../vision'
import type { World } from '../world'
import { enterCombat } from './combat'
import { createGuard, eyeOf, feetOf, type Guard } from './model'
import { addGuard, addLamp, arena, GROUND, putPlayer, run } from './testArena'
import { NERVE, TIERS, TIMING } from './tuning'

/** Rifle rounds from the player that pass just over a guard's head. */
function fireOverHead(world: World, guard: Guard, rounds: number, every = 0.1): void {
  for (let shot = 0; shot < rounds; shot += 1) {
    const from = { x: world.player.x + 0.35, y: world.player.y + 0.4 }
    const head = eyeOf(guard)
    fireShot(world, from, normalize(head.x - from.x, head.y - 0.9 - from.y), { kind: 'bullet', fromPlayer: true, speed: 80, damage: 26, tileDamage: 0, spread: 0, push: 0 })
    run(world, every)
  }
}

describe('nerve and experience', () => {
  it('rookies start shakier than regulars, and veterans (responders, heavies, officers) steadiest', () => {
    const responder = createGuard({ x: 10, y: GROUND, facing: 1 }, true)
    const officer = createGuard({ x: 10, y: GROUND, facing: 1, role: 'officer' })
    expect(responder.tier).toBe('veteran')
    expect(officer.tier).toBe('veteran')
    expect(TIERS.rookie.nerve).toBeLessThan(TIERS.regular.nerve)
    expect(TIERS.regular.nerve).toBeLessThan(TIERS.veteran.nerve)
    const tiers = new Set(Array.from({ length: 40 }, (_, index) => createGuard({ x: index * 7, y: GROUND, facing: 1 }).tier))
    expect(tiers).toEqual(new Set(['rookie', 'regular', 'veteran']))
  })

  it('a veteran fires sooner after "Contact!" and aims tighter than a rookie', () => {
    const world = arena()
    const rookie = addGuard(world, 30, -1, 'post', GROUND, 'rookie')
    const veteran = addGuard(world, 40, -1, 'post', GROUND, 'veteran')
    enterCombat(world, rookie, { x: 20, y: GROUND - 1 })
    enterCombat(world, veteran, { x: 20, y: GROUND - 1 })
    expect(veteran.drawSeconds).toBeLessThan(rookie.drawSeconds)
    expect(veteran.drawSeconds).toBeGreaterThan(0.7 * TIMING.drawSeconds)
    expect(TIERS.veteran.spread).toBeLessThan(TIERS.rookie.spread)
  })

  it('seeing a colleague killed shakes a guard; colleagues around him steady him', () => {
    const lonely = arena()
    addLamp(lonely, 30)
    const victimA = addGuard(lonely, 30, -1)
    const alone = addGuard(lonely, 36, -1)
    const crowded = arena()
    addLamp(crowded, 30)
    const victimB = addGuard(crowded, 30, -1)
    const withFriends = addGuard(crowded, 36, -1)
    addGuard(crowded, 38, -1)
    addGuard(crowded, 40, -1)
    for (const [world, victim] of [[lonely, victimA], [crowded, victimB]] as const) {
      putPlayer(world, 5)
      hurtGuard(world, victim, 1000, feetOf(victim))
    }
    expect(alone.nerve).toBeLessThan(TIERS.regular.nerve - NERVE.colleagueKilled + 0.01)
    expect(lonely.security.barks.some((line) => line.text.includes('Reyes'))).toBe(true)
    run(lonely, 2)
    run(crowded, 2)
    expect(withFriends.nerve).toBeGreaterThan(alone.nerve + 0.15)
  })

  it('a blast close by frightens far more than one down the corridor', () => {
    const world = arena()
    const near = addGuard(world, 40, 1)
    const far = addGuard(world, 70, 1)
    explode(world, { x: 34, y: GROUND - 2 }, ROCKET_BLAST)
    expect(near.shock).toBeGreaterThan(far.shock + 0.2)
  })

  it('rounds cracking past pin a guard: he ducks, stops aiming and loses nerve, even though nothing hit him', () => {
    const world = arena()
    putPlayer(world, 20)
    addLamp(world, 20)
    const guard = addGuard(world, 30, -1)
    run(world, 3, {}, () => guard.mode === 'combat' && guard.drawSeconds <= 0)
    const steady = guard.nerve
    const hp = guard.hp
    let aimedWhilePinned = false
    fireOverHead(world, guard, 12, 0.08)
    run(world, 0.05, {}, () => {
      aimedWhilePinned ||= guard.suppression > 0.55 && world.security.shooters.includes(0) && world.projectiles.some((shot) => !shot.fromPlayer && shot.life > 2.95)
    })
    expect(guard.hp).toBe(hp)
    expect(guard.suppression).toBeGreaterThan(0.55)
    expect(guard.crouching).toBe(true)
    expect(guard.nerve).toBeLessThan(steady - 0.1)
    expect(aimedWhilePinned).toBe(false)
  })

  it('a calm guard that a stray round cracks past knows someone is shooting at him', () => {
    const world = arena()
    putPlayer(world, 20)
    const guard = addGuard(world, 34, 1)
    fireOverHead(world, guard, 1)
    run(world, 0.2)
    expect(guard.mode).not.toBe('calm')
    expect(guard.interest?.kind ?? 'combat').not.toBe('noise')
  })
})
