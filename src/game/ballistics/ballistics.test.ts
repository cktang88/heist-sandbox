import { describe, expect, it } from 'vitest'
import { deviceState } from '../devices/state'
import { switchOff } from '../devices/terminal'
import { GUNS } from '../guns'
import { addGuard, addProp, bareWorld, run } from '../hazards/testWorld'
import { fireShot, stepProjectiles, type ShotSpec } from '../projectiles'
import type { Lamp } from '../site'
import { fillTiles, tileAt, type TileKind } from '../tiles'
import type { Device, World } from '../world'
import { isLampShot } from './lamps'
import { pierce } from './materials'

/** bareWorld's floor: people stand on row 22, so open rows are 17..21. */
const FLOOR = 22
const CHEST = 21
const FRAME = 1 / 60

function gun(id: 'pistol' | 'rifle' | 'sniper' | 'shotgun'): ShotSpec {
  const shot = GUNS[id]?.shot
  if (!shot) throw new Error(`no gun ${id}`)
  return { ...shot, spread: 0 }
}

/** Fires one round from the left along a row and lets it fly until it is spent. */
function shoot(world: World, spec: ShotSpec, y = CHEST, fromX = 8): void {
  fireShot(world, { x: fromX, y }, { x: 1, y: 0 }, spec)
  for (let frame = 0; frame < 240 && world.projectiles.length > 0; frame += 1) stepProjectiles(world, FRAME)
}

function wall(world: World, x: number, kind: TileKind): void {
  fillTiles(world.grid, x, FLOOR - 5, x, FLOOR - 1, kind)
}

function lamp(world: World, x: number, y: number): Lamp {
  const made: Lamp = { x, y, fixture: 'bareBulb', color: 0xffffff, radius: 6, strength: 1, hung: false }
  world.lamps.push(made)
  return made
}

function device(world: World, kind: Device['kind'], x: number, y: number, circuit?: number): Device {
  const made: Device = { kind, x, y, id: world.devices.length, disabled: false, hacked: false, circuit }
  world.devices.push(made)
  return made
}

describe('penetration', () => {
  it('spends power on each layer and stops when it cannot pay', () => {
    const round = { power: 5, damage: 100, tileDamage: 10 }
    expect(pierce(round, 3)).toBe(true)
    expect(round.power).toBe(2)
    expect(round.damage).toBeLessThan(100)
    expect(round.damage).toBeGreaterThanOrEqual(50)
    expect(pierce(round, 3)).toBe(false)
    expect(round.power).toBe(2)
    expect(pierce(round, Number.POSITIVE_INFINITY)).toBe(false)
  })

  it('a sniper round kills a guard standing behind a closed door', () => {
    const world = bareWorld()
    wall(world, 20, 'door')
    const guard = addGuard(world, 24, FLOOR, -1)
    shoot(world, gun('sniper'))
    expect(guard.mode).toBe('dead')
  })

  it('a pistol round stops in the door and only chips it', () => {
    const world = bareWorld()
    wall(world, 20, 'door')
    const guard = addGuard(world, 24, FLOOR, -1)
    shoot(world, gun('pistol'))
    expect(guard.hp).toBe(guard.maxHp)
    expect(tileAt(world.grid, 20, CHEST)).toBe('door')
    expect(world.grid.hp[CHEST * world.grid.width + 20]).toBeLessThan(50)
  })

  it('a pistol round goes through a window, a rifle round through a door but not a brick wall', () => {
    const windowed = bareWorld()
    wall(windowed, 20, 'glass')
    const behindGlass = addGuard(windowed, 24, FLOOR, -1)
    shoot(windowed, gun('pistol'))
    expect(behindGlass.hp).toBeLessThan(behindGlass.maxHp)

    const doored = bareWorld()
    wall(doored, 20, 'door')
    const behindDoor = addGuard(doored, 24, FLOOR, -1)
    shoot(doored, gun('rifle'))
    expect(behindDoor.hp).toBeLessThan(behindDoor.maxHp)

    const bricked = bareWorld()
    wall(bricked, 20, 'brick')
    const behindBrick = addGuard(bricked, 24, FLOOR, -1)
    shoot(bricked, gun('rifle'))
    expect(behindBrick.hp).toBe(behindBrick.maxHp)
  })

  it('a sniper round gets through a brick partition and the door beyond it, but not a concrete wall', () => {
    const world = bareWorld()
    wall(world, 18, 'brick')
    wall(world, 21, 'door')
    const guard = addGuard(world, 25, FLOOR, -1)
    shoot(world, gun('sniper'))
    expect(guard.mode).toBe('dead')

    const concrete = bareWorld()
    wall(concrete, 18, 'concrete')
    const safe = addGuard(concrete, 25, FLOOR, -1)
    shoot(concrete, gun('sniper'))
    expect(safe.hp).toBe(safe.maxHp)
  })

  it('nothing goes through the reinforced skeleton', () => {
    const world = bareWorld()
    wall(world, 20, 'reinforced')
    const guard = addGuard(world, 24, FLOOR, -1)
    for (const id of ['pistol', 'rifle', 'sniper', 'shotgun'] as const) shoot(world, gun(id))
    expect(guard.hp).toBe(guard.maxHp)
    expect(tileAt(world.grid, 20, CHEST)).toBe('reinforced')
  })

  it('shotgun pellets stop at a window, shattering it', () => {
    const world = bareWorld()
    wall(world, 20, 'glass')
    const guard = addGuard(world, 24, FLOOR, -1)
    shoot(world, { ...gun('shotgun'), life: 3 })
    expect(guard.hp).toBe(guard.maxHp)
    expect(tileAt(world.grid, 20, CHEST)).toBe('air')
    expect(world.sounds.some((sound) => sound.kind === 'glass')).toBe(true)
  })

  it('a sniper round goes through the first guard into the second; a pistol round does not', () => {
    const sniped = bareWorld()
    const first = addGuard(sniped, 20, FLOOR, -1)
    const second = addGuard(sniped, 24, FLOOR, -1)
    shoot(sniped, gun('sniper'))
    expect(first.mode).toBe('dead')
    expect(second.mode).toBe('dead')

    const pistoled = bareWorld()
    addGuard(pistoled, 20, FLOOR, -1)
    const behind = addGuard(pistoled, 24, FLOOR, -1)
    shoot(pistoled, gun('pistol'))
    expect(behind.hp).toBe(behind.maxHp)
  })

  it('a sniper round punches through a filing cabinet that stops a pistol round', () => {
    for (const [id, hurt] of [['pistol', false], ['sniper', true]] as const) {
      const world = bareWorld()
      addProp(world, 'filingCabinet', 18, FLOOR)
      const guard = addGuard(world, 24, FLOOR, -1)
      shoot(world, gun(id))
      expect(guard.hp < guard.maxHp).toBe(hurt)
    }
  })
})

describe('shooting out lights', () => {
  it('a round passing close to a lamp smashes it for good, with sparks and the sound of glass', () => {
    const world = bareWorld()
    const hit = lamp(world, 20, 18.2)
    const missed = lamp(world, 30, 19.5)
    shoot(world, gun('pistol'), 18)
    expect(isLampShot(world, hit)).toBe(true)
    expect(isLampShot(world, missed)).toBe(false)
    expect(world.sounds.some((sound) => sound.kind === 'glass')).toBe(true)
    expect(world.effects.particles.some((particle) => particle.color === '#ffd36b')).toBe(true)
  })

  it('a guard nearby hears the bulb pop', () => {
    const world = bareWorld()
    lamp(world, 20, 18)
    const guard = addGuard(world, 22, FLOOR, -1)
    shoot(world, gun('pistol'), 18, 15)
    expect(guard.hp).toBe(guard.maxHp)
    expect(guard.mode).not.toBe('calm')
  })
})

describe('shooting devices', () => {
  it('wrecks a camera for good, like a cut cable', () => {
    const world = bareWorld()
    const camera = device(world, 'camera', 20, 18)
    shoot(world, gun('pistol'), 18.5)
    expect(camera.disabled).toBe(true)
    expect(deviceState(world).offTimers.has(camera.id)).toBe(false)
    expect(world.sounds.some((sound) => sound.kind === 'spark')).toBe(true)
  })

  it('a camera a hack switched off for a while is wrecked for good when shot', () => {
    const world = bareWorld()
    const camera = device(world, 'camera', 20, 18)
    switchOff(world, [camera], 30)
    shoot(world, gun('pistol'), 18.5)
    expect(camera.disabled).toBe(true)
    expect(deviceState(world).offTimers.has(camera.id)).toBe(false)
  })

  it('wrecks alarm buttons, radio relays and elevator panels, and a fuse box kills its circuit', () => {
    const world = bareWorld()
    const devices = [device(world, 'alarmButton', 14, 19), device(world, 'radioRelay', 18, 19), device(world, 'elevatorPanel', 22, 19)]
    const fusebox = device(world, 'fusebox', 26, 19, 7)
    shoot(world, gun('sniper'), 19.5)
    expect(devices.every((one) => one.disabled)).toBe(true)
    expect(fusebox.disabled).toBe(true)
    expect(world.deadCircuits.has(7)).toBe(true)
  })

  it('a pistol round stops in the first box it wrecks', () => {
    const world = bareWorld()
    device(world, 'radioRelay', 16, 19)
    const relay = device(world, 'radioRelay', 22, 19)
    shoot(world, gun('pistol'), 19.5)
    expect(relay.disabled).toBe(false)
  })

  it('guards nearby hear the device being shot up', () => {
    const world = bareWorld()
    device(world, 'camera', 20, 17)
    const guard = addGuard(world, 22, FLOOR, -1)
    shoot(world, gun('pistol'), 17.5, 15)
    expect(guard.mode).not.toBe('calm')
  })
})

describe('reactive props', () => {
  it('shooting a fuel drum next to a guard blows him up', () => {
    const world = bareWorld()
    addProp(world, 'explosiveBarrel', 20, FLOOR)
    const guard = addGuard(world, 22, FLOOR, -1)
    guard.hp = 100
    shoot(world, gun('pistol'), 21.5)
    expect(world.props[0].broken).toBe(true)
    run(world, 0.5)
    expect(guard.mode).toBe('dead')
  })

  it('a gas cylinder, which gives no cover, is still hit by a round passing through it', () => {
    const world = bareWorld()
    const cylinder = addProp(world, 'gasCylinder', 20, FLOOR)
    shoot(world, gun('pistol'), 21.5)
    expect(cylinder.broken).toBe(true)
    expect(world.hazards.blasts.length).toBe(1)
  })

  it('a stove leaks gas when shot', () => {
    const world = bareWorld()
    addProp(world, 'stove', 20, FLOOR)
    shoot(world, gun('sniper'), 21.5)
    expect(world.hazards.leaks.length).toBeGreaterThan(0)
  })

  it('wall extinguishers burst under the player\'s fire but not a guard\'s stray rounds', () => {
    const world = bareWorld()
    const extinguisher = addProp(world, 'fireExtinguisher', 20, 19)
    shoot(world, { ...gun('rifle'), fromPlayer: false }, 19.5)
    expect(extinguisher.broken).toBe(false)
    shoot(world, gun('pistol'), 19.5)
    expect(extinguisher.broken).toBe(true)
    expect(world.hazards.sprays.length).toBeGreaterThan(0)
  })
})

describe('determinism', () => {
  it('the same shots in the same world give the same result', () => {
    const outcome = (): string => {
      const world = bareWorld()
      wall(world, 20, 'brick')
      addProp(world, 'explosiveBarrel', 26, FLOOR)
      addGuard(world, 28, FLOOR, -1)
      for (let index = 0; index < 4; index += 1) shoot(world, gun('sniper'), 20.5 + index * 0.2)
      run(world, 1)
      return JSON.stringify([world.guards.map((guard) => guard.hp), Array.from(world.grid.hp.slice(0, 24 * 60))])
    }
    expect(outcome()).toBe(outcome())
  })
})
