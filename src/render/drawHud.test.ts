import { objectiveText } from '../game/intel/intel'
import { describe, expect, it } from 'vitest'
import { idleInput, type Input } from '../game/input'
import { stepWorld } from '../game/step'
import { createWorld, type World } from '../game/world'
import { clockText, helpTop, wrapLine, hurtAlpha, nextHurt, hudUnit, intelTop, objectiveLine, optionKey, visibility } from './drawHud'

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

describe('the vitals', () => {
  it('read fully hidden while shut in a hiding place, whatever the light outside', () => {
    const world = createWorld(1, 'outpost')
    world.player.hidden = true
    expect(visibility(world)).toBe(0)
  })

  it('leave room for the stealth tags above the Intel panel', () => {
    const unit = 15
    // A tag's box ends 0.45 of its text size (0.62 units) under the tag's baseline at 5.9 units.
    const tagBottom = unit * 5.9 + unit * 0.62 * 0.45
    expect(intelTop(unit, true)).toBeGreaterThan(tagBottom)
    expect(intelTop(unit, false)).toBeGreaterThan(unit * 5.1)
  })
})

describe('the first-seconds help panel', () => {
  it('stays below the middle of the screen, where the player falls, and above the action prompt', () => {
    for (const [width, height] of [[1280, 720], [900, 700], [1920, 1080], [2560, 1440]]) {
      const unit = hudUnit(height)
      const panelHeight = Math.min(unit, (width - unit * 4) / 62) * 13.2
      const top = helpTop(unit, height, panelHeight)
      expect(top, `${width}x${height}`).toBeGreaterThan(height / 2 + unit * 2)
      // The prompt's panel reaches up to 6.3 units above the bottom.
      expect(top + panelHeight, `${width}x${height}`).toBeLessThanOrEqual(height - unit * 6.3)
    }
  })
})

describe('the terminal menu', () => {
  it('numbers options by the key that picks them: 1-9, then 0, then none', () => {
    expect([0, 8, 9, 10].map(optionKey)).toEqual(['1', '9', '0', null])
  })
})

describe('the end screen', () => {
  it('writes the time as minutes and seconds, like the debrief', () => {
    expect([0.3, 21.9, 734.2, 3600].map(clockText)).toEqual(['0:00', '0:21', '12:14', '60:00'])
  })
})

describe('the hit flash', () => {
  it('flashes harder for a bigger hit and fades within a moment', () => {
    const start = nextHurt(undefined, 100, 0)
    expect(hurtAlpha(start, 0)).toBe(0)
    const graze = nextHurt(start, 95, 1)
    const heavy = nextHurt(start, 60, 1)
    expect(hurtAlpha(heavy, 1)).toBeGreaterThan(hurtAlpha(graze, 1))
    expect(hurtAlpha(heavy, 1.3)).toBeLessThan(hurtAlpha(heavy, 1))
    expect(hurtAlpha(heavy, 2)).toBe(0)
  })

  it('does not flash when healing', () => {
    expect(hurtAlpha(nextHurt(nextHurt(undefined, 50, 0), 80, 1), 1)).toBe(0)
  })
})

describe('the objective line', () => {
  const widthOf = (text: string) => text.length * 10
  it('stays one line when it fits, and breaks at a space onto a second when it does not', () => {
    expect(wrapLine('Find the gold case', 300, widthOf)).toEqual(['Find the gold case'])
    const lines = wrapLine('Search the tower · floors 10 to 14 · east wing · an executive safe', 400, widthOf)
    expect(lines).toHaveLength(2)
    for (const line of lines) expect(widthOf(line)).toBeLessThanOrEqual(400)
    expect(lines.join(' ')).toBe('Search the tower · floors 10 to 14 · east wing · an executive safe')
  })
})
