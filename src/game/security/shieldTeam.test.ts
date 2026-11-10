import { describe, expect, it } from 'vitest'
import { hurtGuard } from '../guards'
import { GUNS } from '../guns'
import type { Projectile } from '../projectiles'
import { fillTiles } from '../tiles'
import type { World } from '../world'
import { feetOf, type Guard } from './model'
import { sendShieldTeam, shieldBlocks } from './shieldTeam'
import { addGuard, addLamp, arena, GROUND, putPlayer, run } from './testArena'

/** "Eventually call in a shield-heavy SWAT team to prevent getting mowed down at choke points." */

/** A round of the player's gun (penetration as in guns.ts) at a point, heading the given way. */
function round(gun: 'pistol' | 'rifle' | 'shotgun' | 'sniper', at: { x: number; y: number }, vx: number, vy: number): Pick<Projectile, 'x' | 'y' | 'vx' | 'vy' | 'kind' | 'power'> {
  return { ...at, vx, vy, kind: 'bullet', power: GUNS[gun]!.shot.penetration ?? 0 }
}

function shieldMan(world: World): Guard {
  const guard = addGuard(world, 30, -1, 'heavy')
  guard.shield = true
  return guard
}

const team = (world: World) => world.guards.filter((guard) => guard.stackLeader !== null)

describe('the ballistic shield', () => {
  it('stops pistol, rifle and shotgun rounds from the front', () => {
    const world = arena()
    const guard = shieldMan(world)
    const chest = { x: 30, y: GROUND - 1 }
    for (const gun of ['pistol', 'rifle', 'shotgun'] as const) expect(shieldBlocks(world, guard, round(gun, chest, 80, 0))).toBe(true)
  })

  it('does not stop a sniper round, a shot from behind, one plunging from above, or protect a man without one', () => {
    const world = arena()
    const guard = shieldMan(world)
    const chest = { x: 30, y: GROUND - 1 }
    expect(shieldBlocks(world, guard, round('sniper', chest, 150, 0))).toBe(false)
    expect(shieldBlocks(world, guard, round('rifle', chest, -80, 0))).toBe(false)
    expect(shieldBlocks(world, guard, round('rifle', chest, 30, 75))).toBe(false)
    guard.shield = false
    expect(shieldBlocks(world, guard, round('rifle', chest, 80, 0))).toBe(false)
  })
})

/** A wall at x 40 with a doorway, the player holding the room beyond it from x 52, and a squad being cut down in the doorway. */
function chokePoint(): World {
  const world = arena()
  fillTiles(world.grid, 40, GROUND - 6, 40, GROUND - 4, 'brick')
  putPlayer(world, 52)
  addLamp(world, 52)
  world.player.hp = 1e6
  // The getaway van is at the far end, so teams come in from the near (left) end of the street.
  world.extraction.x = 150
  world.security.lastKnown = { x: 52, y: GROUND - 1 }
  world.security.lastContactAt = 0
  return world
}

describe('escalation at a choke point', () => {
  it('after men keep dying in the same doorway the control room sends a four-man shield team', () => {
    const world = chokePoint()
    for (const x of [39.6, 40.4, 40.8]) hurtGuard(world, addGuard(world, x, 1), 1e4, { x: 52, y: GROUND - 1 })
    run(world, 1)
    const members = team(world)
    expect(members.length).toBe(4)
    expect(members.every((guard) => guard.armored && guard.mode === 'combat' && guard.combatRole === 'stack')).toBe(true)
    expect(members.filter((guard) => guard.shield).length).toBe(1)
    expect(world.security.log.some((line) => line.includes('Shield team'))).toBe(true)
  })

  it('the team moves as a slow column behind the shield and flashbangs the room before going through the door', () => {
    const world = chokePoint()
    const members = sendShieldTeam(world, { x: 52, y: GROUND - 1 })
    for (const guard of members) guard.hp = guard.maxHp = 1e5
    const leader = members[0]
    let flashBeforeDoor = false
    let fastest = 0
    let spreadOut = 0
    run(world, 40, {}, () => {
      const lead = feetOf(leader)
      if (lead.x < 39 && world.hazards.grenades.some((grenade) => grenade.thrower === 'guard' && grenade.kind === 'flash')) flashBeforeDoor = true
      fastest = Math.max(fastest, Math.abs(leader.vx))
      // Every man stays behind the shield (on the side away from the player), close up.
      for (const guard of members.slice(1)) if (!guard.stairs && Math.abs(lead.x - feetOf(guard).x) > 4.5) spreadOut += 1 / 60
      return lead.x > 41
    })
    expect(feetOf(leader).x).toBeGreaterThan(41)
    expect(flashBeforeDoor).toBe(true)
    expect(fastest).toBeLessThan(3)
    expect(members.slice(1).every((guard) => feetOf(guard).x < feetOf(leader).x)).toBe(true)
    expect(spreadOut).toBeLessThan(5)
  })
})
