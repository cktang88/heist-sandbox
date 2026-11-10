import { describe, expect, it } from 'vitest'
import { idleInput, type Input } from './input'
import { GROUND } from './level'
import { stepWorld } from './step'
import { actionIndex, TOOLS, wheelSelection } from './toolDefs'
import { createWorld, type World } from './world'

/** Scripted play with the tools in hand: picking them, using them, running dry. */

const FRAME = 1 / 60

function play(world: World, seconds: number, input: Partial<Input> = {}): void {
  for (let frame = 0; frame < Math.round(seconds / FRAME); frame += 1) {
    stepWorld(world, { ...idleInput({ x: world.player.x + 5, y: world.player.y }), ...input }, FRAME)
  }
}

/** An outpost with no guards and the player standing on the street. */
function street(): World {
  const world = createWorld(1)
  world.guards = []
  Object.assign(world.player, { x: 30, y: GROUND - 1.61, vx: 0, vy: 0, hp: 1e6 })
  play(world, 0.2)
  return world
}

describe('picking a tool', () => {
  it('reaches the second-page tools with the wheel and throws a frag from there', () => {
    const world = street()
    world.player.tool = 9
    play(world, FRAME, { selectTool: wheelSelection(1) })
    expect(TOOLS[world.player.tool].name).toBe('Frag')
    play(world, FRAME, { fire: true, firePressed: true })
    expect(world.frags).toHaveLength(1)
    play(world, FRAME, { selectTool: wheelSelection(1) })
    expect(world.player.tool).toBe(actionIndex('rope'))
    play(world, FRAME, { selectTool: wheelSelection(1) })
    expect(world.player.tool).toBe(actionIndex('grapple'))
    play(world, FRAME, { selectTool: wheelSelection(1) })
    expect(world.player.tool).toBe(0)
  })

  it('swaps between the two tools on key 9 and key 7', () => {
    const world = street()
    const names: string[] = []
    for (const key of [8, 8, 8, 6, 6]) {
      play(world, FRAME, { selectTool: key })
      names.push(TOOLS[world.player.tool].name)
    }
    expect(names).toEqual(['Smoke', 'Frag', 'Smoke', 'Drill', 'Rope'])
  })
})
