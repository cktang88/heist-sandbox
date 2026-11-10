import { describe, expect, it } from 'vitest'
import { hurtGuard, restrainGuard } from '../guards'
import { deathFound } from './nerve'
import { enterCombat } from './combat'
import { feetOf, isActive, type Guard } from './model'
import { addGuard, addLamp, addRoom, addWall, arena, GROUND, putPlayer, run, runListening } from './testArena'
import { FEAR } from './tuning'

const saidAny = (lines: string[], words: string[]) => lines.some((line) => words.some((word) => line.includes(word)))
const said = (world: ReturnType<typeof arena>, words: string[]) => saidAny(world.security.barks.map((line) => line.text), words)

/** A guard in a fight with the player at `playerX`, frightened right down to nothing. */
function breakingGuard(playerX: number, guardX: number): { world: ReturnType<typeof arena>; guard: Guard } {
  const world = arena()
  putPlayer(world, playerX)
  addLamp(world, playerX)
  const guard = addGuard(world, guardX, -1, 'post', GROUND, 'rookie')
  enterCombat(world, guard, { x: playerX, y: GROUND - 1 })
  guard.shock = 0.9
  return { world, guard }
}

describe('panic and surrender', () => {
  it('a guard whose nerve breaks with the intruder far off runs for the security room and cowers there', () => {
    const { world, guard } = breakingGuard(10, 40)
    addRoom(world, { kind: 'security', building: 'b', x: 70, w: 12, floorY: GROUND })
    run(world, 0.5)
    expect(guard.mode).toBe('panic')
    expect(said(world, ['out of here', 'Screw this', 'Not dying', 'Run!'])).toBe(true)
    run(world, 12)
    expect(feetOf(guard).x).toBeGreaterThan(70)
    expect(feetOf(guard).x).toBeLessThan(82)
    expect(guard.crouching).toBe(true)
    expect(world.projectiles.some((shot) => !shot.fromPlayer)).toBe(false)
  })

  it('with the intruder right on him he drops his weapon and puts his hands up, and stays that way while watched', () => {
    const { world, guard } = breakingGuard(26, 30)
    run(world, 0.5)
    expect(guard.mode).toBe('surrendered')
    expect(guard.state).not.toBe('alert')
    expect(guard.droppedWeapon).not.toBeNull()
    expect(isActive(guard)).toBe(false)
    expect(said(world, ['give up', 'unarmed', 'done', 'Hands up'])).toBe(true)
    run(world, 30)
    expect(guard.mode).toBe('surrendered')
    expect(world.projectiles.some((shot) => !shot.fromPlayer)).toBe(false)
  })

  it('left unwatched, a surrendered guard picks his weapon back up, radios it in and goes looking', () => {
    const { world, guard } = breakingGuard(26, 30)
    run(world, 0.5)
    expect(guard.mode).toBe('surrendered')
    // The player walks off behind a wall.
    addWall(world, 15)
    putPlayer(world, 5)
    run(world, FEAR.rearmSeconds * 1.5 + 3, {}, () => guard.droppedWeapon === null)
    expect(guard.droppedWeapon).toBeNull()
    expect(guard.mode).toBe('searching')
    expect(guard.radio?.event.kind).toBe('sighting')
  })

  it('a tied-up guard never picks his weapon up again', () => {
    const { world, guard } = breakingGuard(26, 30)
    run(world, 0.5)
    restrainGuard(world, guard)
    putPlayer(world, 120)
    run(world, 40)
    expect(guard.mode).toBe('surrendered')
    expect(guard.droppedWeapon).not.toBeNull()
  })

  it('a panicking guard whose nerve recovers pulls himself together and goes back to work', () => {
    const { world, guard } = breakingGuard(10, 40)
    run(world, 0.5)
    expect(guard.mode).toBe('panic')
    guard.shock = 0
    run(world, 0.5)
    expect(guard.mode).toBe('searching')
    expect(said(world, ['Pull it together', 'Breathe', "I'm good"])).toBe(true)
  })
})

describe('low nerve on the way to trouble', () => {
  it('stops at the edge of a room where a colleague was just killed before going in', () => {
    const world = arena()
    putPlayer(world, 140)
    addRoom(world, { kind: 'office', building: 'b', x: 40, w: 20, floorY: GROUND })
    const victim = addGuard(world, 50, 1)
    const guard = addGuard(world, 25, 1)
    hurtGuard(world, victim, 1000, feetOf(victim))
    // The body was found and called in: that is how he knows to go there.
    deathFound(world, 0)
    guard.interest = { at: { x: 50, y: GROUND }, kind: 'body', priority: 5, reached: false, body: 0 }
    guard.mode = 'investigating'
    let waitedAt = -1
    let waited = 0
    const lines = runListening(world, 15, {}, () => {
      if (guard.hesitateSeconds > 0) {
        waitedAt = feetOf(guard).x
        waited += 1 / 60
      }
    })
    expect(waitedAt).toBeGreaterThan(40 - FEAR.hesitateReach - 0.5)
    expect(waitedAt).toBeLessThan(40)
    expect(waited).toBeGreaterThan(0.7)
    expect(saidAny(lines, ['not liking', 'got him', 'Careful', 'Easy'])).toBe(true)
    expect(Math.abs(feetOf(guard).x - 50)).toBeLessThan(2)
  })

  it('a shaken guard will not walk into gunfire alone: he calls a colleague over and waits for him', () => {
    const world = arena()
    putPlayer(world, 140)
    const guard = addGuard(world, 30, 1)
    const colleague = addGuard(world, 10, 1, 'patrol')
    colleague.route = [{ x: 5.5, y: GROUND }, { x: 15.5, y: GROUND }]
    guard.shock = 0.35
    guard.interest = { at: { x: 60, y: GROUND }, kind: 'gunfire', priority: 6, reached: false }
    guard.mode = 'investigating'
    let leftAlone = false
    const lines = runListening(world, 12, {}, () => {
      leftAlone ||= feetOf(guard).x > 32 && Math.abs(feetOf(colleague).x - feetOf(guard).x) > 6
      return feetOf(guard).x > 40
    })
    expect(saidAny(lines, ['alone', 'second man', 'Waiting for backup', 'solo'])).toBe(true)
    expect(colleague.follow).toBe(0)
    expect(leftAlone).toBe(false)
    expect(feetOf(guard).x).toBeGreaterThan(40)
  })
})
