import { describe, expect, it } from 'vitest'
import { propSpec } from '../propCatalog'
import { createWorld, type World } from '../world'
import { stepChatter } from './chatter'
import { createIntel, setupIntel } from './intel'
import { readAction, terminalClue, terminalLine } from './sources'

function freshWorld(seed: number): World {
  const world = createWorld(seed, 'complex')
  world.intel = createIntel()
  setupIntel(world)
  return world
}

describe('quiet sources', () => {
  it('a hacked computer gives one written clue, right about 90% of the time', () => {
    const world = freshWorld(1)
    const computer = world.devices.find((device) => device.kind === 'computer')!
    const clue = terminalClue(world, computer)!
    expect(clue.source).toBe('terminal')
    expect(terminalLine(clue)).toMatch(/roster|manifest/)
    expect(terminalClue(world, computer)).toBeNull()

    let right = 0
    const tries = 2000
    for (let attempt = 0; attempt < tries; attempt += 1) {
      world.intel.used.clear()
      if (terminalClue(world, computer)!.about === world.intel.real) right += 1
    }
    expect(right / tries).toBeGreaterThan(0.86)
    expect(right / tries).toBeLessThan(0.94)
  })

  it('only some papers hold anything useful, and each can be read once', () => {
    const world = freshWorld(1)
    expect(world.intel.documents.size).toBeGreaterThan(0)
    const useful = world.props.find((prop) => world.intel.documents.has(prop.id))!
    const spec = propSpec(useful.kind)
    const middleY = spec.mount === 'floor' ? useful.y - spec.h / 2 : useful.y + spec.h / 2
    Object.assign(world.player, { x: useful.x + 0.5 - world.player.w / 2, y: middleY - world.player.h / 2 })
    const action = readAction(world)!
    expect(action.prompt).toBe('Hold E: read')
    action.run()
    expect(world.intel.clues).toHaveLength(1)
    expect(world.intel.clues[0].source).toBe('document')
    expect(readAction(world)?.key).not.toBe(action.key)
  })

  it('a paper with nothing useful says so and adds no clue', () => {
    const world = freshWorld(1)
    const dull = world.props.find((prop) => prop.kind === 'noticeBoard' && !world.intel.documents.has(prop.id))!
    Object.assign(world.player, { x: dull.x, y: dull.y })
    const action = readAction(world)!
    action.run()
    expect(world.intel.clues).toHaveLength(0)
    expect(world.security.barks.length).toBeGreaterThan(0)
  })

  it('two calm guards chatting near a hidden player give something away after a few seconds, once', () => {
    const world = freshWorld(1)
    const [a, b] = world.guards
    world.guards = [a, b]
    const feet = world.groundY
    Object.assign(a, { x: 60, y: feet - a.h, mode: 'calm', state: 'patrol', awareness: 0, seesPlayer: false })
    Object.assign(b, { x: 62, y: feet - b.h, mode: 'calm', state: 'patrol', awareness: 0, seesPlayer: false })
    Object.assign(world.player, { x: 65, y: feet - world.player.h })
    for (let time = 0; time < 2; time += 0.05) stepChatter(world, 0.05)
    expect(world.intel.clues).toHaveLength(0)
    for (let time = 0; time < 1.5; time += 0.05) stepChatter(world, 0.05)
    expect(world.intel.clues).toHaveLength(1)
    expect(world.intel.clues[0].source).toBe('chatter')
    for (let time = 0; time < 5; time += 0.05) stepChatter(world, 0.05)
    expect(world.intel.clues).toHaveLength(1)
  })

  it('guards who have noticed the player do not chat', () => {
    const world = freshWorld(1)
    const [a, b] = world.guards
    world.guards = [a, b]
    const feet = world.groundY
    Object.assign(a, { x: 60, y: feet - a.h, mode: 'calm', awareness: 0.6 })
    Object.assign(b, { x: 62, y: feet - b.h, mode: 'calm', awareness: 0 })
    Object.assign(world.player, { x: 65, y: feet - world.player.h })
    for (let time = 0; time < 5; time += 0.05) stepChatter(world, 0.05)
    expect(world.intel.clues).toHaveLength(0)
  })
})
