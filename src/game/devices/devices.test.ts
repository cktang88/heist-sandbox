import { describe, expect, it } from 'vitest'
import { idleInput, type Input } from '../input'
import { interact } from '../interact'
import { GROUND } from '../level'
import type { Room, RoomKind } from '../site'
import { stepWorld } from '../step'
import { tileAt } from '../tiles'
import { useTool } from '../tools'
import { createWorld, type Device, type World } from '../world'
import { chooseOption, openTerminal } from './terminal'
import { lampPowered, pressAlarmButton, restoreCircuit, revealedRooms, stepDevices, terminalConsumesInput } from './devices'

const FRAME = 1 / 60
const CIRCUIT = 7

function run(world: World, seconds: number, input: Partial<Input> = {}): void {
  for (let frame = 0; frame < Math.round(seconds / FRAME); frame += 1) {
    stepWorld(world, { ...idleInput({ x: world.player.x + 5, y: world.player.y }), ...input }, FRAME)
  }
}

function press(world: World, input: Partial<Input> = {}): void {
  run(world, FRAME, { interact: true, interactPressed: true, ...input })
}

/** A column on the outpost's ground floor with open floor around it, clear of partitions and doors. */
function clearSpot(world: World): number {
  for (let x = 76; x < 114; x += 1) {
    let clear = true
    for (let dx = -3; dx <= 3; dx += 1) {
      for (let y = GROUND - 3; y < GROUND; y += 1) if (tileAt(world.grid, x + dx, y) !== 'air') clear = false
    }
    if (clear) return x
  }
  throw new Error('no clear spot')
}

function addRoom(world: World, kind: RoomKind, storey: number): Room {
  const floorY = GROUND - storey * 6
  const room: Room = { id: world.rooms.length, kind, building: 'outpost', storey, x: 71, y: floorY - 5, w: 47, h: 5, floorY, security: 1 }
  world.rooms.push(room)
  return room
}

function addDevice(world: World, device: Omit<Device, 'id' | 'disabled' | 'hacked'>): Device {
  const made: Device = { ...device, id: world.devices.length, disabled: false, hacked: false }
  world.devices.push(made)
  return made
}

/** An outpost with no guards and the player standing on the ground floor at `x`. */
function setUp(): { world: World; x: number } {
  const world = createWorld(1)
  world.guards = []
  const x = clearSpot(world)
  Object.assign(world.player, { x: x - 0.35 + 0.5, y: GROUND - 1.6, vx: 0, vy: 0, hp: 1e6 })
  run(world, 0.1)
  return { world, x }
}


describe('fuse boxes and light switches', () => {
  it('cuts the power to a storey and restores it', () => {
    const { world, x } = setUp()
    const storeyLamps = world.lamps.filter((lamp) => lamp.x > 70 && lamp.x < 118 && lamp.y > GROUND - 6 && lamp.y < GROUND)
    const otherLamps = world.lamps.filter((lamp) => !storeyLamps.includes(lamp))
    expect(storeyLamps.length).toBeGreaterThan(0)
    for (const lamp of storeyLamps) lamp.circuit = CIRCUIT
    addDevice(world, { kind: 'fusebox', x, y: GROUND - 2, circuit: CIRCUIT })
    run(world, FRAME)
    expect(world.prompt).toBe('E: cut power')

    press(world)
    expect(storeyLamps.every((lamp) => !lampPowered(world, lamp))).toBe(true)
    expect(otherLamps.every((lamp) => lampPowered(world, lamp))).toBe(true)
    expect(world.sounds.some((sound) => sound.kind === 'switch')).toBe(true)
    expect(world.prompt).toBe('E: restore power')

    run(world, 0.1)
    press(world)
    expect(storeyLamps.every((lamp) => lampPowered(world, lamp))).toBe(true)
  })

  it('makes a nearby guard come to look when the breaker clunks', () => {
    const { world, x } = setUp()
    const fresh = createWorld(1).guards[0]
    Object.assign(fresh, { x: x + 3, y: GROUND - fresh.h, state: 'patrol' })
    world.guards = [fresh]
    addDevice(world, { kind: 'fusebox', x, y: GROUND - 2, circuit: CIRCUIT })
    press(world)
    expect(fresh.state).toBe('suspicious')
  })

  it('flips a light switch silently, and guards can flip it back', () => {
    const { world, x } = setUp()
    addDevice(world, { kind: 'lightSwitch', x, y: GROUND - 2, circuit: CIRCUIT })
    world.sounds = []
    press(world)
    expect(world.deadCircuits.has(CIRCUIT)).toBe(true)
    expect(world.sounds.some((sound) => sound.kind === 'switch')).toBe(false)
    restoreCircuit(world, CIRCUIT)
    expect(world.deadCircuits.has(CIRCUIT)).toBe(false)
  })
})

describe('a wrecked fuse box', () => {
  function wrecked() {
    const { world, x } = setUp()
    addRoom(world, 'office', 0)
    const box = addDevice(world, { kind: 'fusebox', x: x + 20, y: GROUND - 2, circuit: CIRCUIT })
    const lightSwitch = addDevice(world, { kind: 'lightSwitch', x, y: GROUND - 2, circuit: CIRCUIT })
    world.deadCircuits.add(CIRCUIT)
    box.disabled = true
    return { world, lightSwitch }
  }

  it('cannot be bypassed with a light switch on its circuit', () => {
    const { world } = wrecked()
    run(world, FRAME)
    press(world)
    expect(world.deadCircuits.has(CIRCUIT)).toBe(true)
  })

  it('cannot be bypassed from a terminal', () => {
    const { world, x } = wrecked()
    const computer = addDevice(world, { kind: 'computer', x: x + 1, y: GROUND, roomId: 0 })
    computer.hacked = true
    world.terminal = { device: computer.id, title: '', options: [] }
    openTerminal(world, computer)
    const restore = world.terminal!.options.findIndex((option) => option.startsWith('Restore lights'))
    if (restore >= 0) chooseOption(world, restore)
    expect(world.deadCircuits.has(CIRCUIT)).toBe(true)
  })
})

describe('computers', () => {
  function hackedTerminal(kind: RoomKind = 'office') {
    const { world, x } = setUp()
    const room = addRoom(world, kind, 0)
    const upstairs = addRoom(world, 'office', 1)
    const camera = addDevice(world, { kind: 'camera', x: 100, y: GROUND - 4, roomId: room.id })
    const otherCamera = addDevice(world, { kind: 'camera', x: 100, y: GROUND - 10, roomId: upstairs.id })
    const computer = addDevice(world, { kind: 'computer', x, y: GROUND, roomId: room.id })
    run(world, FRAME)
    expect(world.prompt).toBe('Hold E: hack terminal')
    run(world, 1.6, { interact: true })
    return { world, camera, otherCamera, computer }
  }

  it('is hacked by holding E and opens a menu for this floor', () => {
    const { world, computer } = hackedTerminal()
    expect(computer.hacked).toBe(true)
    expect(world.terminal?.device).toBe(computer.id)
    expect(world.terminal?.options).toContain('Disable cameras on this floor')
    expect(world.sounds.some((sound) => sound.kind === 'keyboard')).toBe(true)
    expect(world.sounds.some((sound) => sound.kind === 'beep')).toBe(true)
  })

  it('picks options with the number keys without switching weapon, and the cameras come back later', () => {
    const { world, camera, otherCamera } = hackedTerminal()
    const index = world.terminal!.options.indexOf('Disable cameras on this floor')
    const toolBefore = world.player.tool
    // What step.ts does: the tools only see the number key when no terminal wants it.
    const input = { ...idleInput(), selectTool: index }
    interact(world, input, FRAME)
    expect(terminalConsumesInput(world)).toBe(true)
    useTool(world, terminalConsumesInput(world) ? { ...input, selectTool: null } : input, FRAME)
    expect(world.player.tool).toBe(toolBefore)
    expect(camera.disabled).toBe(true)
    expect(otherCamera.disabled).toBe(false)

    stepDevices(world, idleInput(), 200)
    expect(camera.disabled).toBe(false)
  })

  it('closes when the computer is wrecked under the player\'s hands', () => {
    const { world, computer } = hackedTerminal()
    expect(world.terminal).not.toBeNull()
    computer.disabled = true
    run(world, FRAME)
    expect(world.terminal).toBeNull()
  })

  it('closes when E is pressed again or the player walks away', () => {
    const { world } = hackedTerminal()
    press(world)
    expect(world.terminal).toBeNull()
    press(world)
    expect(world.terminal).not.toBeNull()
    run(world, 1, { right: true })
    expect(world.terminal).toBeNull()
  })

  it('from the security room shuts cameras down for good and can reveal the vault', () => {
    const { world, camera } = hackedTerminal('security')
    const vault = addRoom(world, 'vault', -1)
    const options = world.terminal!.options
    run(world, FRAME, { selectTool: options.indexOf('Shut down cameras on this floor') })
    run(world, FRAME, { selectTool: options.indexOf('Show vault location') })
    expect(revealedRooms(world).has(vault.id)).toBe(true)
    stepDevices(world, idleInput(), 1000)
    expect(camera.disabled).toBe(true)
  })

  it('can set off a false alarm on another floor', () => {
    const { world } = hackedTerminal()
    run(world, FRAME, { selectTool: world.terminal!.options.indexOf('Trigger false alarm on another floor') })
    // The control room believes shots were fired on another floor and puts the site on edge around it.
    expect(world.security.log.some((line) => /Shots fired on floor \d+/.test(line))).toBe(true)
    expect(world.security.level).toBe(2)
    expect(world.security.focus!.y).toBeLessThan(GROUND - 5)
  })
})

describe('keypads and secure doors', () => {
  const FRONT_DOOR = { x: 70, y: GROUND - 1 }

  function atFrontDoor(keypadX: number) {
    const world = createWorld(1)
    world.guards = []
    Object.assign(world.player, { x: 68.2, y: GROUND - 1.6, vx: 0, vy: 0, hp: 1e6 })
    const keypad = addDevice(world, { kind: 'keypad', x: keypadX, y: GROUND - 2, target: FRONT_DOOR })
    run(world, 0.1)
    return { world, keypad }
  }

  it('resists a quick lockpick but gives way to a long one', () => {
    const { world } = atFrontDoor(60)
    expect(world.prompt).toBe('Hold E: pick secure lock')
    run(world, 2, { interact: true })
    expect(tileAt(world.grid, 70, GROUND - 1)).toBe('door')
    run(world, 4.5, { interact: true })
    expect(tileAt(world.grid, 70, GROUND - 1)).toBe('air')
  })

  it('opens at a touch once its keypad is hacked', () => {
    const { world, keypad } = atFrontDoor(68)
    expect(world.prompt).toBe('Hold E: hack keypad')
    run(world, 3.2, { interact: true })
    expect(keypad.hacked).toBe(true)
    expect(tileAt(world.grid, 70, GROUND - 1)).toBe('door')
    run(world, 0.1)
    expect(world.prompt).toBe('E: open door')
    press(world)
    expect(tileAt(world.grid, 70, GROUND - 1)).toBe('air')
  })

  it('is unlocked by a server-room terminal on its floor', () => {
    const { world } = setUp()
    const room = addRoom(world, 'server', 0)
    const keypad = addDevice(world, { kind: 'keypad', x: 68, y: GROUND - 2, target: FRONT_DOOR })
    addDevice(world, { kind: 'computer', x: Math.floor(world.player.x + 0.35), y: GROUND, roomId: room.id })
    run(world, 1.6, { interact: true })
    run(world, FRAME, { selectTool: world.terminal!.options.indexOf('Unlock doors on this floor') })
    expect(keypad.hacked).toBe(true)
    expect(tileAt(world.grid, 70, GROUND - 1)).toBe('door')
  })
})

describe('alarm buttons and cameras', () => {
  it('a disabled alarm button does not report', () => {
    const { world, x } = setUp()
    const button = addDevice(world, { kind: 'alarmButton', x, y: GROUND - 2 })
    expect(pressAlarmButton(world, button)).toBe(true)
    expect(world.security.level).toBe(3)
    expect(world.alarm).toBe(true)
    expect(world.security.lastKnown).toMatchObject({ x: x + 0.5 })
    run(world, FRAME)
    expect(world.prompt).toBe('Hold E: disable alarm button')
    run(world, 1.1, { interact: true })
    expect(button.disabled).toBe(true)
    const contactAt = world.security.lastContactAt
    expect(pressAlarmButton(world, button)).toBe(false)
    expect(world.security.lastContactAt).toBe(contactAt)
    expect(world.security.log.filter((line) => line.includes('Alarm button')).length).toBe(1)
  })

  it('a disabled alarm button leaves a quiet site quiet', () => {
    const { world, x } = setUp()
    const button = addDevice(world, { kind: 'alarmButton', x, y: GROUND - 2 })
    button.disabled = true
    expect(pressAlarmButton(world, button)).toBe(false)
    expect(world.security.level).toBe(0)
    expect(world.security.lastKnown).toBeNull()
    expect(world.security.log).toEqual([])
  })

  it('cuts a camera cable by holding E under it', () => {
    const { world, x } = setUp()
    const camera = addDevice(world, { kind: 'camera', x, y: GROUND - 4 })
    run(world, 1.1, { interact: true })
    expect(camera.disabled).toBe(true)
    stepDevices(world, idleInput(), 1000)
    expect(camera.disabled).toBe(true)
  })
})
