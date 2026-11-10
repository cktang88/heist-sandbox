import { fireShot } from '../projectiles'
import { describe, expect, it } from 'vitest'
import type { Guard } from '../guards'
import { addProp } from '../hazards/testWorld'
import { propBox, propCenter } from '../hazards/props'
import { boxHitsSolid } from '../physics'
import { enterCombat, colleagueInLine } from '../security/combat'
import { eyeOf } from '../security/model'
import { addGuard, addWall, arena, GROUND, putPlayer, run } from '../security/testArena'
import { fillTiles, tileAt } from '../tiles'
import { toolIndex } from '../toolDefs'
import { centerOf } from '../types'
import type { World } from '../world'
import { KNOCKOUT_SECONDS } from './strikes'

/** The player a step to the left of a guard, facing him. */
function squareUp(guardX: number, facing: 1 | -1 = -1): { world: World; guard: Guard } {
  const world = arena()
  const guard = addGuard(world, guardX, facing)
  putPlayer(world, guardX - 0.9)
  run(world, 0.05)
  return { world, guard }
}

/** One press of a key, then the rest of the blow's cooldown. */
function press(world: World, key: 'punchPressed' | 'kickPressed' | 'throwPressed', seconds = 0.4, aimX?: number): void {
  const aim = { x: aimX ?? world.player.x + 5, y: world.player.y + 0.5 }
  run(world, 1 / 60, { [key]: true, aim })
  run(world, seconds, { aim })
}

const knockedOut = (guard: Guard) => guard.stunSeconds > KNOCKOUT_SECONDS / 2

describe('punching', () => {
  it('staggers a guard who is fighting, and a quick run of three punches knocks him out', () => {
    const { world, guard } = squareUp(15)
    enterCombat(world, guard, centerOf(world.player))
    press(world, 'punchPressed', 0)
    expect(guard.stunSeconds).toBeGreaterThan(0)
    expect(knockedOut(guard)).toBe(false)
    run(world, 0.4)
    putPlayer(world, guard.x + guard.w / 2 - 0.9)
    press(world, 'punchPressed')
    expect(knockedOut(guard)).toBe(false)
    putPlayer(world, guard.x + guard.w / 2 - 0.9)
    press(world, 'punchPressed')
    expect(knockedOut(guard)).toBe(true)
    expect(guard.mode).not.toBe('dead')
  })

  it('takes two punches to knock out a guard caught unaware from the front', () => {
    const { world, guard } = squareUp(15)
    press(world, 'punchPressed')
    expect(knockedOut(guard)).toBe(false)
    putPlayer(world, guard.x + guard.w / 2 - 0.9)
    press(world, 'punchPressed')
    expect(knockedOut(guard)).toBe(true)
  })

  it('misses a guard out of reach', () => {
    const { world, guard } = squareUp(15)
    putPlayer(world, 12)
    press(world, 'punchPressed')
    expect(guard.stunSeconds).toBe(0)
    expect(guard.hp).toBe(guard.maxHp)
  })
})

describe('kicking', () => {
  it('shoves a guard back off a ledge into the pit beyond', () => {
    const { world, guard } = squareUp(15)
    fillTiles(world.grid, 17, GROUND, 30, GROUND + 5, 'air')
    press(world, 'kickPressed', 2)
    expect(guard.y + guard.h).toBeGreaterThan(GROUND + 5)
  })

  it('sends a guard through a window, breaking the glass', () => {
    const { world, guard } = squareUp(15)
    fillTiles(world.grid, 17, GROUND - 3, 17, GROUND - 1, 'glass')
    press(world, 'kickPressed', 1.5)
    expect(tileAt(world.grid, 17, GROUND - 1)).toBe('air')
    expect(guard.x).toBeGreaterThan(17)
  })

  it('bursts a door open into the guard behind it', () => {
    const world = arena()
    addWall(world, 15)
    fillTiles(world.grid, 15, GROUND - 3, 15, GROUND - 1, 'door')
    const guard = addGuard(world, 16.8, -1)
    putPlayer(world, 14.4)
    run(world, 0.05)
    press(world, 'kickPressed', 0.05)
    expect(tileAt(world.grid, 15, GROUND - 2)).toBe('air')
    expect(guard.stunSeconds).toBeGreaterThan(0)
    expect(guard.hp).toBeLessThan(guard.maxHp)
  })

  it('sends a loose crate skidding', () => {
    const world = arena()
    const crate = addProp(world, 'crate', 12, GROUND)
    putPlayer(world, 11)
    run(world, 0.05)
    const before = propCenter(crate).x
    press(world, 'kickPressed', 1)
    expect(propCenter(crate).x).toBeGreaterThan(before + 1)
  })
})

describe('human shield', () => {
  /** An unaware guard facing right, the player right behind him holding grab, and a gunman further right. */
  function hostage(): { world: World; shield: Guard; gunman: Guard } {
    const world = arena()
    const shield = addGuard(world, 15, 1)
    const gunman = addGuard(world, 30, -1)
    putPlayer(world, 14.3)
    run(world, 0.05)
    run(world, 0.1, { grab: true })
    return { world, shield, gunman }
  }

  /** A guard's bullet flying left at chest height toward the player. */
  function incoming(world: World, gunman: Guard): void {
    const eye = eyeOf(gunman)
    fireShot(world, { x: eye.x - 1, y: world.player.y + 0.6 }, { x: -1, y: 0 }, { kind: 'bullet', fromPlayer: false, speed: 24, damage: 12, tileDamage: 6, spread: 0, push: 0 })
  }

  it('takes an unaware guard from behind, and his body stops bullets meant for the player', () => {
    const { world, shield, gunman } = hostage()
    expect(world.melee.shield).toBe(shield)
    const hp = world.player.hp
    incoming(world, gunman)
    run(world, 1, { grab: true })
    expect(world.player.hp).toBe(hp)
    expect(shield.hp).toBeLessThan(shield.maxHp)
  })

  it('leaves the player exposed without one', () => {
    const world = arena()
    const gunman = addGuard(world, 30, -1)
    putPlayer(world, 14.3)
    run(world, 0.05)
    const hp = world.player.hp
    incoming(world, gunman)
    run(world, 1)
    expect(world.player.hp).toBeLessThan(hp)
  })

  it('makes other guards hold fire, since he is in their line', () => {
    const { world, gunman } = hostage()
    expect(colleagueInLine(world, gunman, eyeOf(gunman), centerOf(world.player))).toBe(true)
  })

  it('can drag off a guard who is out cold, who stays out when dropped', () => {
    const world = arena()
    const guard = addGuard(world, 15, -1)
    putPlayer(world, 14.1)
    run(world, 0.05)
    press(world, 'punchPressed')
    putPlayer(world, guard.x + guard.w / 2 - 0.9)
    press(world, 'punchPressed')
    expect(knockedOut(guard)).toBe(true)
    run(world, 0.2, { grab: true })
    expect(world.melee.shield).toBe(guard)
    run(world, 0.2)
    expect(world.melee.shield).toBeNull()
    expect(knockedOut(guard)).toBe(true)
  })

  it('slows the player and leaves him only the pistol', () => {
    const world = arena()
    addGuard(world, 15, 1)
    putPlayer(world, 14.3)
    world.player.tool = toolIndex('rifle')
    run(world, 0.05)
    const start = world.player.x
    run(world, 1, { grab: true, right: true })
    expect(world.melee.shield).not.toBeNull()
    expect(world.player.x - start).toBeLessThan(3.5)
    expect(world.player.tool).toBe(toolIndex('pistol'))
  })

  it('cannot be taken from the front of a guard who is watching', () => {
    const world = arena()
    const guard = addGuard(world, 15, -1)
    enterCombat(world, guard, { x: 14, y: GROUND - 1 })
    putPlayer(world, 14.3)
    run(world, 0.1, { grab: true })
    expect(world.melee.shield).toBeNull()
  })

  it('turns on the player when let go, and is knocked out by a punch or shoved off by a kick', () => {
    const released = hostage()
    run(released.world, 0.1)
    expect(released.world.melee.shield).toBeNull()
    expect(released.shield.state).toBe('alert')

    const punched = hostage()
    run(punched.world, 1 / 60, { grab: true, punchPressed: true })
    expect(punched.world.melee.shield).toBeNull()
    expect(knockedOut(punched.shield)).toBe(true)

    const kicked = hostage()
    const before = kicked.shield.x
    run(kicked.world, 1 / 60, { grab: true, kickPressed: true })
    run(kicked.world, 0.6)
    expect(kicked.world.melee.shield).toBeNull()
    expect(kicked.shield.x).toBeGreaterThan(before + 1)
  })
})

describe('throwing', () => {
  it('throws a bin along the aim; where it lands, a guard comes to investigate', () => {
    const world = arena()
    const bin = addProp(world, 'bin', 11, GROUND)
    const guard = addGuard(world, 26, 1)
    putPlayer(world, 10.5)
    run(world, 0.05)
    press(world, 'throwPressed', 2, 30)
    expect(propCenter(bin).x).toBeGreaterThan(15)
    expect(bin.y).toBe(GROUND)
    expect(guard.mode).not.toBe('calm')
  })

  it('spoils the aim of a guard it hits', () => {
    const world = arena()
    addProp(world, 'bin', 11, GROUND)
    const guard = addGuard(world, 15, -1)
    enterCombat(world, guard, { x: 10, y: GROUND - 1 })
    guard.shootCooldown = 0
    putPlayer(world, 10.5)
    run(world, 1 / 60, { throwPressed: true, aim: { x: 30, y: world.player.y + 0.4 } })
    run(world, 0.3)
    expect(guard.hitFlash > 0 || guard.shootCooldown > 0.5).toBe(true)
    expect(guard.hp).toBeLessThan(guard.maxHp)
    expect(guard.stunSeconds).toBe(0)
  })

  it('knocks a guard off his feet with something heavy', () => {
    const world = arena()
    addProp(world, 'officeChair', 11, GROUND)
    const guard = addGuard(world, 15, -1)
    putPlayer(world, 10.5)
    run(world, 0.05)
    run(world, 1 / 60, { throwPressed: true, aim: { x: 30, y: world.player.y + 0.4 } })
    run(world, 0.3)
    expect(guard.stunSeconds).toBeGreaterThan(0)
  })

  it('finds nothing to throw when nothing small is in reach', () => {
    const world = arena()
    addWall(world, 40)
    addProp(world, 'desk', 11, GROUND)
    putPlayer(world, 10.5)
    run(world, 1 / 60, { throwPressed: true })
    expect([...world.physProps.loose.values()].some((loose) => loose.flying)).toBe(false)
  })
})

describe('throwing against a wall', () => {
  it.each([1, -1])('a chair thrown point-blank into the wall the player leans on (side %i) drops to the floor, not into the wall', (side) => {
    const world = arena()
    const wallX = 20
    addWall(world, wallX)
    // Leaning on the wall: the chair, wider than the player, sticks out into it once it is in his hands.
    const playerX = side > 0 ? wallX - 0.351 : wallX + 1.351
    const chair = addProp(world, 'officeChair', Math.floor(playerX - side * 1.2), GROUND)
    putPlayer(world, playerX)
    run(world, 1 / 60, { throwPressed: true, aim: { x: playerX + side * 5, y: world.player.y + 0.5 } })
    run(world, 2)
    const box = propBox(chair)
    expect(boxHitsSolid(world.grid, { x: box.x + 0.01, y: box.y + 0.01, w: box.w - 0.02, h: box.h - 0.02 })).toBe(false)
    expect(chair.y).toBe(GROUND)
  })
})
