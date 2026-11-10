import { describe, expect, it } from 'vitest'
import { fanMode, FAN_UNITS } from '../systems/fans'
import { createWorld } from '../world'
import { chooseOption, openTerminal } from './terminal'

describe('ventilation from a terminal', () => {
  it('a computer in a room with a fan steps its ventilation through extract, push left, push right and off', () => {
    const world = createWorld(1, 'complex')
    const fanRooms = new Set(world.props.filter((prop) => FAN_UNITS.has(prop.kind)).map((prop) => prop.roomId))
    const computer = world.devices.find((device) => device.kind === 'computer' && fanRooms.has(device.roomId ?? undefined))!
    expect(computer).toBeDefined()
    const room = computer.roomId!
    const modes: string[] = []
    for (let step = 0; step < 4; step += 1) {
      openTerminal(world, computer)
      const index = world.terminal!.options.findIndex((option) => option.startsWith('Ventilation'))
      expect(index).toBeGreaterThanOrEqual(0)
      chooseOption(world, index)
      modes.push(fanMode(world, room))
    }
    expect(modes).toEqual(['extract', 'left', 'right', 'off'])
  })
})
