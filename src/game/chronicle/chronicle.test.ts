import { describe, expect, it } from 'vitest'
import type { Guard } from '../security/model'
import { hurtGuard } from '../guards'
import { addGuard, arena, GROUND, putPlayer, run } from '../security/testArena'
import { toolIndex } from '../toolDefs'
import { createWorld, type World } from '../world'
import { debriefOf, debriefText } from './chronicle'
import { guardName } from './names'
import { placeName } from './place'
import { loudRun, parachuteIn, quietRun } from './scenarios'
import type { BeatKind } from './types'

const kinds = (world: World) => world.chronicle.beats.map((beat) => beat.kind)
const indexOf = (world: World, kind: BeatKind) => kinds(world).indexOf(kind)

describe('the chronicle', () => {
  it('writes down a quiet run as it happened: the drop, the takedown, the case and the escape, with no alarm', () => {
    const world = quietRun()
    expect(world.status).toBe('won')
    const order: BeatKind[] = ['landed', 'down', 'caseFound', 'escaped']
    const at = order.map((kind) => indexOf(world, kind))
    expect(at.every((index) => index >= 0)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(world.chronicle.beats.find((beat) => beat.kind === 'down')?.detail).toBe('takedown')
    expect(world.chronicle.beats.filter((beat) => beat.kind === 'alert')).toEqual([])
    expect(world.chronicle.beats.find((beat) => beat.kind === 'caseFound')?.place).toMatch(/vault/)
  })

  it('writes down a loud run: the blasts, the alarm they caused, and the guards they killed', () => {
    const world = loudRun()
    const alarm = world.chronicle.beats.find((beat) => beat.kind === 'alert' && (beat.n ?? 0) >= 3)
    expect(alarm?.detail).toBe('explosion')
    expect(indexOf(world, 'explosion')).toBeLessThan(kinds(world).indexOf('alert'))
    expect(world.chronicle.tally.explosions).toBeGreaterThanOrEqual(4)
    expect(world.chronicle.beats.some((beat) => beat.kind === 'down' && beat.detail === 'blast')).toBe(true)
    expect(world.chronicle.tally.alarms).toBe(1)
  })

  it('turns each run into a debrief that matches its style', () => {
    const quietWorld = quietRun()
    const quiet = debriefOf(quietWorld)
    const loud = debriefOf(loudRun())
    // The story names whoever the takedown really was.
    const victim = quietWorld.chronicle.beats.find((beat) => beat.kind === 'down')?.who ?? 'heavy'
    expect(quiet.verdict.style).toBe('quiet')
    expect(loud.verdict.style).toMatch(/loud|catastrophe/)
    expect(quiet.story.join(' ')).toContain(victim)
    expect(quiet.story.join(' ')).not.toMatch(/alarm went up|explosion/)
    expect(loud.story.join(' ')).toMatch(/explosion|blast/)
    expect(debriefText(loud)).toContain(loud.headline.toUpperCase())
  })

  it('records the parachute landing where it really came down', () => {
    const world = createWorld(3, 'complex')
    parachuteIn(world)
    const landed = world.chronicle.beats.find((beat) => beat.kind === 'landed')!
    expect(landed.place).toBe(placeName(world, { x: world.player.x + world.player.w / 2, y: world.player.y + world.player.h }))
  })

  it('calls guards by the name a people module gives them, falling back to the name colleagues shout', () => {
    const world = createWorld(3, 'complex')
    expect(guardName(world, 0)).toMatch(/^[A-Z]|^officer|^the /)
    Object.assign(world, { people: { nameOf: (guard: Guard) => (guard === world.guards[0] ? 'Dmitri Vale' : undefined) } })
    expect(guardName(world, 0)).toBe('Dmitri Vale')
    expect(guardName(world, 1)).not.toBe('Dmitri Vale')
  })

  it('does not call a man cut down by his own side beside the player a takedown, and a point-blank shot is a shot', () => {
    const world = arena()
    const shield = addGuard(world, 20.6, 1)
    putPlayer(world, 20)
    run(world, 0.1)
    hurtGuard(world, shield, 1000, { x: 30, y: GROUND - 1 }, 'hazard')
    run(world, 0.5)
    expect(world.chronicle.beats.find((beat) => beat.kind === 'down')?.detail).toBe('accident')

    const target = addGuard(world, 21.2, 1)
    world.player.tool = toolIndex('pistol')
    run(world, 0.5)
    run(world, 1 / 60, { fire: true, firePressed: true, aim: { x: 21.2, y: target.y + 0.3 } })
    run(world, 0.5)
    expect(target.mode).toBe('dead')
    expect(world.chronicle.beats.filter((beat) => beat.kind === 'down').at(-1)?.detail).toMatch(/^shot:/)
  })
})
