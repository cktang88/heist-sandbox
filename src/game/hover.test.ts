import { describe, expect, it } from 'vitest'
import { createProps } from './cover'
import { actionTarget, deviceBox, hoveredTarget, outlineTarget, targetOfAction } from './hover'
import { createRagdoll } from './ragdoll'
import { addDevice, addGuard, arena, GROUND, putPlayer, run } from './security/testArena'
import { fillTiles } from './tiles'
import { centerOf } from './types'

describe('what the cursor is over', () => {
  it('finds a device by its box, and nothing beside it', () => {
    const world = arena()
    const fuse = addDevice(world, { kind: 'fusebox', x: 20, y: GROUND - 2, circuit: 0 })
    expect(hoveredTarget(world, { x: 20.5, y: GROUND - 1.5 })).toMatchObject({ kind: 'device', device: fuse, key: `device:${fuse.id}` })
    expect(hoveredTarget(world, { x: 23.5, y: GROUND - 1.5 })).toBeNull()
  })

  it('skips a device with nothing left to do, and uses the wall aim for wall devices', () => {
    const world = arena()
    const keypad = addDevice(world, { kind: 'keypad', x: 20, y: GROUND - 2, hacked: true })
    expect(hoveredTarget(world, { x: 20.5, y: GROUND - 1.5 })).toBeNull()
    keypad.hacked = false
    // The lane cursor is elsewhere, but where it meets the back wall is on the keypad.
    expect(hoveredTarget(world, { x: 22.5, y: GROUND - 1.5 }, { x: 20.5, y: GROUND - 1.5 })?.kind).toBe('device')
  })

  it('looks devices up by tile, among hundreds', () => {
    const world = arena()
    for (let index = 0; index < 400; index += 1) addDevice(world, { kind: 'lightSwitch', x: 5 + (index % 150), y: 2 + Math.floor(index / 150) * 3, circuit: 0 })
    const target = addDevice(world, { kind: 'computer', x: 60, y: GROUND })
    const box = deviceBox(target)
    expect(hoveredTarget(world, centerOf(box))).toMatchObject({ kind: 'device', device: target })
  })

  it('outlines a shut door as its whole column of door tiles', () => {
    const world = arena()
    fillTiles(world.grid, 30, GROUND - 3, 30, GROUND - 1, 'door')
    const target = hoveredTarget(world, { x: 30.5, y: GROUND - 2.5 })
    expect(target).toMatchObject({ kind: 'door', box: { x: 30, y: GROUND - 3, w: 1, h: 3 } })
  })

  it('outlines a hiding place and an unread paper, but not plain furniture', () => {
    const world = arena()
    world.props = createProps([{ kind: 'wallLocker', x: 40, y: GROUND }, { kind: 'crate', x: 44, y: GROUND }])
    expect(hoveredTarget(world, { x: 40.5, y: GROUND - 0.5 })).toMatchObject({ kind: 'prop', prop: world.props[0] })
    expect(hoveredTarget(world, { x: 44.5, y: GROUND - 0.3 })).toBeNull()
  })

  it('outlines a body lying in the open, not a guard on his feet', () => {
    const world = arena()
    const guard = addGuard(world, 50, 1)
    expect(hoveredTarget(world, centerOf(guard))).toBeNull()
    guard.mode = 'dead'
    guard.ragdoll = createRagdoll({ x: 50, y: GROUND }, { x: 0, y: 0 }, world.rng)
    const target = hoveredTarget(world, { x: 50, y: GROUND - 0.3 })
    expect(target).toMatchObject({ kind: 'person', guard })
  })

  it('outlines the loot case', () => {
    const world = arena()
    expect(hoveredTarget(world, centerOf(world.loot))?.kind).toBe('loot')
  })
})

describe('what E acts on', () => {
  it('reads the target back from the action key', () => {
    const world = arena()
    const fuse = addDevice(world, { kind: 'fusebox', x: 20, y: GROUND - 2, circuit: 0 })
    expect(targetOfAction(world, `device:${fuse.id}:rig`)).toMatchObject({ kind: 'device', device: fuse })
    fillTiles(world.grid, 30, GROUND - 3, 30, GROUND - 1, 'door')
    expect(targetOfAction(world, 'door:30', { x: 30, y: GROUND - 0.5 })).toMatchObject({ kind: 'door' })
  })

  it('is noted each step, and the cursor wins over it', () => {
    const world = arena()
    const fuse = addDevice(world, { kind: 'fusebox', x: 20, y: GROUND - 2, circuit: 0 })
    const button = addDevice(world, { kind: 'alarmButton', x: 40, y: GROUND - 2 })
    putPlayer(world, 20.5)
    run(world, 0.1)
    expect(world.prompt).not.toBeNull()
    expect(actionTarget(world)).toMatchObject({ kind: 'device', device: fuse })
    // Nothing under the cursor: what E acts on is outlined.
    expect(outlineTarget(world, { x: 80, y: 5 })).toMatchObject({ target: { device: fuse }, hovered: false })
    expect(outlineTarget(world, { x: 40.5, y: GROUND - 1.5 })).toMatchObject({ target: { device: button }, hovered: true })
    // Walked away: nothing in reach, nothing outlined.
    putPlayer(world, 100)
    run(world, 0.1)
    expect(actionTarget(world)).toBeNull()
  })
})
