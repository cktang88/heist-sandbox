import { describe, expect, it } from 'vitest'
import { stunGuard } from '../guards'
import { surrender } from '../security/fear'
import { addGuard, arena, putPlayer, run } from '../security/testArena'
import { dossier } from './dossier'
import { enlist } from './people'

describe('the dossier', () => {
  it('holds only guards the player has been close to, and only what he has learned about them', () => {
    const world = arena()
    putPlayer(world, 34)
    const near = enlist(world, addGuard(world, 38, -1), ['jumpy', 'loyal'])
    enlist(world, addGuard(world, 120, -1), [])
    run(world, 0.5)
    const cards = dossier(world)
    expect(cards).toHaveLength(1)
    expect(cards[0]).toMatchObject({ name: 'Name unknown', rank: near.rank, background: null, traits: [] })
  })

  it('a trait shown within earshot goes in the file', () => {
    const world = arena()
    putPlayer(world, 34)
    const man = enlist(world, addGuard(world, 38, -1), ['jumpy'])
    run(world, 0.3)
    man.guard.interest = { at: { x: 30, y: 30 }, kind: 'noise', priority: 4, reached: false }
    man.guard.mode = 'noticed'
    run(world, 0.5)
    expect(dossier(world)[0].traits).toContain('jumpy')
  })

  it('his papers give his name and life; questioning shows who will not talk', () => {
    const world = arena()
    putPlayer(world, 34)
    const man = enlist(world, addGuard(world, 34.5, -1), ['loyal', 'smoker'])
    run(world, 0.3)
    stunGuard(man.guard, 30)
    run(world, 0.5)
    const card = dossier(world)[0]
    expect(card.name).toBe(`${man.first} ${man.last}`)
    expect(card.background).toContain(man.life)
    expect(card.tonight.some((line) => line.includes('Knocked out'))).toBe(true)
    man.guard.stunSeconds = 0
    surrender(world, man.guard)
    world.intel.questioned.add(man.guard)
    run(world, 0.5)
    expect(dossier(world)[0].traits).toContain('loyal')
    expect(dossier(world)[0].traits).not.toContain('smoker')
  })

  it('bonds overheard are listed with the colleague\'s name', () => {
    const world = arena()
    putPlayer(world, 34)
    const a = enlist(world, addGuard(world, 38, 1, 'post'), [])
    const b = enlist(world, addGuard(world, 39.6, -1, 'post'), [])
    world.people!.bonds.push({ kind: 'friends', a: a.id, b: b.id })
    run(world, 3)
    const cards = dossier(world)
    expect(cards.some((card) => card.bonds.some((line) => line.includes('friend')))).toBe(true)
  })
})
