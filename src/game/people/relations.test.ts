import { describe, expect, it } from 'vitest'
import { COMMS } from '../security/tuning'
import { hurtGuard, stunGuard, type Guard } from '../guards'
import { enterCombat } from '../security/combat'
import { addGuard, addWall, arena, GROUND, putPlayer, run, runListening } from '../security/testArena'
import { knockOutCold } from '../stealth/bodies'
import type { World } from '../world'
import { TALK, type TalkKind } from './lines'
import { callName, enlist } from './people'
import type { BondKind, Person, TraitId } from './types'

function person(world: World, x: number, traits: TraitId[] = [], role: Guard['role'] = 'post', facing: 1 | -1 = -1): Person {
  return enlist(world, addGuard(world, x, facing, role), traits)
}

function bond(world: World, a: Person, b: Person, kind: BondKind): void {
  world.people!.bonds.push({ kind, a: a.id, b: b.id })
}

function said(lines: string[], kind: TalkKind, about?: Person, world?: World): boolean {
  const name = about && world ? callName(world.people!, about) : 'him'
  return lines.some((line) => (TALK[kind] as readonly string[]).some((template) => template.replaceAll('{other}', name) === line))
}

describe('bonds between guards change what they do', () => {
  it('a brave man who sees his friend shot goes berserk: no fear, and he shoots at once', () => {
    const world = arena()
    putPlayer(world, 10)
    const friend = person(world, 40, ['brave'])
    const victim = person(world, 44)
    bond(world, friend, victim, 'friends')
    run(world, 0.3)
    const heard = runListening(world, 0.6, {}, () => {
      if (victim.guard.mode !== 'dead') hurtGuard(world, victim.guard, 1000, { x: 10, y: GROUND - 1 })
    })
    expect(said(heard, 'griefBerserk', victim, world)).toBe(true)
    expect(friend.berserkUntil).toBeGreaterThan(world.clock)
    expect(friend.guard.shock).toBe(0)
    enterCombat(world, friend.guard, { x: 10, y: GROUND - 1 })
    run(world, 0.3)
    expect(friend.guard.drawSeconds).toBeLessThan(0.3)
  })

  it('a coward who sees his friend die falls apart and runs, beyond what a stranger\'s death does', () => {
    const world = arena()
    putPlayer(world, 5)
    const coward = person(world, 40, ['coward'])
    const victim = person(world, 44)
    const stranger = person(world, 36, ['coward'])
    bond(world, coward, victim, 'friends')
    run(world, 0.3)
    hurtGuard(world, victim.guard, 1000, { x: 5, y: GROUND - 1 })
    const heard = runListening(world, 1)
    expect(said(heard, 'griefBreak', victim, world)).toBe(true)
    expect(coward.guard.mode).toBe('panic')
    expect(stranger.guard.mode).not.toBe('panic')
  })

  it('a guard told to partner his rival refuses, and says so', () => {
    const world = arena()
    const a = person(world, 40)
    const b = person(world, 50)
    bond(world, a, b, 'rivals')
    run(world, 0.3)
    a.guard.follow = world.guards.indexOf(b.guard)
    const heard = runListening(world, 0.5)
    expect(a.guard.follow).toBeNull()
    expect(said(heard, 'rivalNoHelp', b, world)).toBe(true)
  })

  it('a mentor near his rookie in a fight steadies him', () => {
    const shockAfter = (withMentor: boolean): number => {
      const world = arena()
      putPlayer(world, 5)
      const rookie = person(world, 40, [], 'post')
      rookie.guard.tier = 'rookie'
      if (withMentor) {
        const mentor = person(world, 42)
        mentor.guard.tier = 'veteran'
        bond(world, mentor, rookie, 'mentor')
      }
      run(world, 0.3)
      enterCombat(world, rookie.guard, { x: 5, y: GROUND - 1 })
      rookie.guard.shock = 0.5
      run(world, 2)
      return rookie.guard.shock
    }
    expect(shockAfter(true)).toBeLessThan(shockAfter(false) - 0.1)
  })

  it('a patrol partner stands over his knocked-out partner until he comes round', () => {
    const world = arena()
    const a = person(world, 40)
    const b = person(world, 44)
    bond(world, a, b, 'partners')
    run(world, 0.3)
    stunGuard(b.guard, 5)
    const heard = runListening(world, 1)
    expect(a.guard.station).not.toBeNull()
    expect(Math.abs(a.guard.station!.x - (b.guard.x + b.guard.w / 2))).toBeLessThan(1)
    expect(said(heard, 'partnerStays', b, world)).toBe(true)
    run(world, 6)
    expect(b.guard.stunSeconds).toBe(0)
    expect(a.guard.station).toBeNull()
  })

  it('a partner does not sense his knocked-out partner through a wall, nor one stuffed in a cupboard', () => {
    for (const where of ['behind a wall', 'in a cupboard'] as const) {
      const world = arena()
      const a = person(world, 40)
      const b = person(world, 45)
      bond(world, a, b, 'partners')
      if (where === 'behind a wall') addWall(world, 43)
      run(world, 0.3)
      knockOutCold(world, b.guard, 30)
      if (where === 'in a cupboard') b.guard.hiddenIn = 0
      const heard = runListening(world, 2)
      expect(a.guard.station).toBeNull()
      expect(said(heard, 'partnerStays', b, world)).toBe(false)
    }
  })

  it('a guard whose friend is held as a human shield pleads, and hesitates to shoot once he is let go', () => {
    const world = arena()
    putPlayer(world, 30)
    const friend = person(world, 40)
    const hostage = person(world, 30.9, [], 'post', 1)
    bond(world, friend, hostage, 'friends')
    run(world, 0.3)
    stunGuard(hostage.guard, 30)
    enterCombat(world, friend.guard, { x: 30, y: GROUND - 1 })
    const heard = runListening(world, 1.5, { grab: true, aim: { x: 40, y: GROUND - 1 } })
    expect(world.melee.shield).toBe(hostage.guard)
    expect(said(heard, 'shieldFriend', hostage, world)).toBe(true)
    run(world, 0.3, { grab: false, aim: { x: 40, y: GROUND - 1 } })
    expect(world.melee.shield).toBeNull()
    expect(friend.guard.drawSeconds).toBeGreaterThan(1)
  })

  it('two friends standing their posts side by side stop and talk while all is quiet', () => {
    const world = arena()
    const a = person(world, 40, [], 'post', 1)
    const b = person(world, 41.6, [], 'post', -1)
    bond(world, a, b, 'friends')
    const heard = runListening(world, 3)
    expect(a.act?.name).toBe('chat')
    expect(b.act?.name).toBe('chat')
    expect(said(heard, 'chatFriends', b, world) || said(heard, 'chatFriends', a, world)).toBe(true)
  })

  it('a patrolling guard drifts over to a friend on post nearby to chat', () => {
    const world = arena()
    const walker = person(world, 40, ['chatty'], 'patrol', 1)
    const friend = person(world, 52, [], 'post', -1)
    bond(world, walker, friend, 'friends')
    let chatted = false
    run(world, 240, {}, () => {
      chatted ||= walker.act?.name === 'chat'
      return chatted
    })
    expect(chatted).toBe(true)
  })

  it('a friend covers on the radio for a man who missed his check-in, which holds the control room off', () => {
    const world = arena()
    const friend = person(world, 40)
    const missing = person(world, 60)
    bond(world, friend, missing, 'friends')
    run(world, 0.3)
    stunGuard(missing.guard, 120)
    missing.guard.checkInAt = world.clock + 0.1
    run(world, 1)
    const poll = world.security.polls.find((each) => world.guards[each.guard] === missing.guard)!
    expect(poll.at - world.clock).toBeGreaterThan(40)
    expect(world.security.log.some((line) => line.includes(`${friend.last}:`) && line.includes(missing.last))).toBe(true)
    // The control room's own call names him too.
    expect(world.security.log.some((line) => line.includes(`Control: ${missing.last}, check in.`))).toBe(true)
  })

  it('by-the-book men never cover for anyone', () => {
    const world = arena()
    const friend = person(world, 40, ['byTheBook'])
    const missing = person(world, 60)
    bond(world, friend, missing, 'friends')
    run(world, 0.3)
    stunGuard(missing.guard, 120)
    missing.guard.checkInAt = world.clock + 0.1
    run(world, 1)
    const poll = world.security.polls.find((each) => world.guards[each.guard] === missing.guard)!
    expect(poll.at - world.clock).toBeLessThan(COMMS.pollSeconds + 1)
  })
})
