import { objectiveText } from '../game/intel/intel'
import { describe, expect, it } from 'vitest'
import { idleInput, type Input } from '../game/input'
import { stepWorld } from '../game/step'
import { createWorld, type World } from '../game/world'
import { objectiveLine } from './drawHud'

const FRAME = 1 / 60

function play(world: World, seconds: number, input: Partial<Input> = {}): void {
  for (let frame = 0; frame < Math.round(seconds / FRAME); frame += 1) {
    stepWorld(world, { ...idleInput({ x: world.player.x + 5, y: world.player.y }), ...input }, FRAME)
  }
}

describe('the objective line', () => {
  it("names the vault's building and floor once a terminal has shown it", () => {
    const world = createWorld(1, 'complex')
    world.guards = []
    const terminal = world.devices.find((device) => device.kind === 'computer' && world.rooms.find((room) => room.id === device.roomId)?.kind === 'archive')!
    const room = world.rooms.find((candidate) => candidate.id === terminal.roomId)!
    Object.assign(world.player, { x: terminal.x + 0.15, y: room.floorY - 1.61, vx: 0, vy: 0, hp: 1e6 })
    expect(objectiveLine(world)).toBe(objectiveText(world))
    play(world, 1.7, { interact: true })
    const option = world.terminal!.options.indexOf('Show vault location')
    play(world, FRAME, { selectTool: option })
    const vault = world.rooms.find((candidate) => candidate.kind === 'vault')!
    expect(objectiveLine(world)).toContain(`vault: ${vault.building}`)
    world.player.hasLoot = true
    expect(objectiveLine(world)).toBe('Get back to the van')
  })
})
