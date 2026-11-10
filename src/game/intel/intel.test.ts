import { describe, expect, it } from 'vitest'
import { idleInput, type Input } from '../input'
import { stepWorld } from '../step'
import { setTile } from '../tiles'
import { centerOf } from '../types'
import { createWorld, type World } from '../world'
import { searchFilter } from './area'
import { recordClue } from './clues'
import { createIntel, hideCaseIn, objectiveText, searchArea, setupIntel, stepIntel } from './intel'
import { relocate } from './move'

const FRAME = 1 / 60

function freshWorld(seed: number, kind: 'complex' | 'outpost' = 'complex'): World {
  const world = createWorld(seed, kind)
  world.intel = createIntel()
  setupIntel(world)
  return world
}

function play(world: World, seconds: number, input: Partial<Input> = {}, until?: () => boolean): void {
  for (let frame = 0; frame < Math.round(seconds / FRAME); frame += 1) {
    stepWorld(world, { ...idleInput({ x: world.player.x + 5, y: world.player.y }), ...input }, FRAME)
    if (until?.()) return
  }
}

const SEEDS = [1, 2, 3, 4, 5, 6]

describe('the hidden case', () => {
  it('has several plausible places on the complex, the vault among them, and the case is not always in the vault', () => {
    const kinds = new Set<string>()
    for (const seed of SEEDS) {
      const world = freshWorld(seed)
      expect(world.intel.places.length).toBeGreaterThanOrEqual(4)
      expect(world.intel.places.some((place) => place.kind === 'vault')).toBe(true)
      kinds.add(world.intel.places[world.intel.real].kind)
    }
    expect(kinds.size).toBeGreaterThan(1)
  })

  it('keeps the outpost case in its vault, the only candidate', () => {
    const before = createWorld(1, 'outpost').loot
    const world = freshWorld(1, 'outpost')
    expect(world.intel.places).toHaveLength(1)
    expect(world.intel.places[0].kind).toBe('vault')
    expect(world.loot.x).toBeCloseTo(before.x)
    expect(world.loot.y).toBeCloseTo(before.y)
  })

  it.each(SEEDS)('seed %i: the case rests inside its room, can be picked up, and the heist can still be won', (seed) => {
    const world = freshWorld(seed)
    world.guards = []
    world.player.hp = 1e6
    const place = world.intel.places[world.intel.real]
    play(world, 0.5)
    const loot = centerOf(world.loot)
    expect(world.loot.onGround).toBe(true)
    expect(loot.x).toBeGreaterThan(place.x)
    expect(loot.x).toBeLessThan(place.x + place.w)
    expect(world.loot.y + world.loot.h).toBeCloseTo(place.floorY, 1)

    Object.assign(world.player, { x: world.loot.x, y: place.floorY - world.player.h - 0.01, vx: 0, vy: 0 })
    play(world, 0.2)
    expect(world.player.hasLoot).toBe(true)
    const zone = world.extraction
    Object.assign(world.player, { x: zone.x + zone.w / 2, y: world.groundY - world.player.h - 0.01, vx: 0, vy: 0 })
    play(world, 0.5, {}, () => world.status !== 'playing')
    expect(world.status).toBe('won')
  })

  it('is the same for the same seed', () => {
    const a = freshWorld(7)
    const b = freshWorld(7)
    expect(a.intel.real).toBe(b.intel.real)
    expect(a.loot.x).toBe(b.loot.x)
    expect([...a.intel.documents]).toEqual([...b.intel.documents])
    for (const world of [a, b]) recordClue(world, { source: 'interrogation', origin: 'x', sourceKey: 'x', detail: 'band', truth: 0.7 })
    expect(a.intel.clues).toEqual(b.intel.clues)
  })

  it('can be put in the vault for scripted runs', () => {
    const world = freshWorld(2)
    hideCaseIn(world, 'vault')
    const vault = world.rooms.find((room) => room.kind === 'vault')!
    expect(world.loot.x).toBeGreaterThan(vault.x)
    expect(world.loot.x).toBeLessThan(vault.x + vault.w)
  })
})

describe('what the player knows', () => {
  it('confirms a clue when an independent source agrees, but not when the same source repeats itself', () => {
    const world = freshWorld(1)
    const first = recordClue(world, { source: 'interrogation', origin: 'Reyes', sourceKey: 'guard:1', detail: 'band', truth: 1 })
    const same = recordClue(world, { source: 'interrogation', origin: 'Reyes', sourceKey: 'guard:1', detail: 'kind', truth: 1 })
    expect(first.confirmed || same.confirmed).toBe(false)
    const other = recordClue(world, { source: 'document', origin: 'note', sourceKey: 'prop:4', detail: 'kind', truth: 1 })
    expect(other.confirmed).toBe(true)
    expect(first.confirmed).toBe(true)
  })

  it('combines agreeing clues into one search area and shows nothing before any clue', () => {
    const world = freshWorld(1)
    expect(searchArea(world)).toBeNull()
    expect(objectiveText(world)).toMatch(/make someone talk/)
    recordClue(world, { source: 'interrogation', origin: 'a', sourceKey: 'a', detail: 'band', truth: 1 })
    recordClue(world, { source: 'document', origin: 'b', sourceKey: 'b', detail: 'kind', truth: 1 })
    const real = world.intel.places[world.intel.real]
    const area = searchArea(world)!
    expect(area.filter.building).toBe(real.building)
    expect(area.filter.kind).toBe(real.kind)
    expect(area.filter.storeys!.min).toBeLessThanOrEqual(real.storey)
    expect(area.filter.storeys!.max).toBeGreaterThanOrEqual(real.storey)
    expect(area.region).not.toBeNull()
    const middle = real.x + real.w / 2
    expect(middle).toBeGreaterThanOrEqual(area.region!.x)
    expect(middle).toBeLessThanOrEqual(area.region!.x + area.region!.w)
    expect(area.rooms.some((room) => room.id === real.roomId)).toBe(true)
    expect(objectiveText(world)).toMatch(/^Search the /)
  })

  it('marks every clue stale when the case moves', () => {
    const world = freshWorld(1)
    recordClue(world, { source: 'interrogation', origin: 'a', sourceKey: 'a', detail: 'room', truth: 1 })
    const to = world.intel.places.find((place) => place.id !== world.intel.real)!
    relocate(world, to)
    expect(world.intel.real).toBe(to.id)
    expect(world.intel.clues.every((clue) => clue.stale)).toBe(true)
    expect(searchFilter(world.intel)).toBeNull()
    expect(centerOf(world.loot).x).toBeGreaterThan(to.x)
    expect(centerOf(world.loot).x).toBeLessThan(to.x + to.w)
  })
})

describe('going loud', () => {
  it('makes security move the case, out of the player\'s sight, after a confirmed alarm', () => {
    const world = freshWorld(1)
    recordClue(world, { source: 'interrogation', origin: 'a', sourceKey: 'a', detail: 'room', truth: 1 })
    const before = world.intel.real
    Object.assign(world.player, { x: 5, y: world.groundY - 2 })
    world.security.level = 3
    for (let time = 0; time < 25; time += FRAME) stepIntel(world, FRAME)
    expect(world.intel.real).not.toBe(before)
    expect(world.intel.move.moves).toBe(1)
    expect(world.intel.clues[0].stale).toBe(true)
    expect(world.security.barks.some((bark) => bark.text.startsWith('Move the package'))).toBe(true)
  })

  it('does not move it while the player is right there, nor while the site is calm', () => {
    const world = freshWorld(1)
    for (let time = 0; time < 25; time += FRAME) stepIntel(world, FRAME)
    expect(world.intel.move.moves).toBe(0)
    Object.assign(world.player, { x: world.loot.x, y: world.loot.y - 1 })
    world.security.level = 3
    for (let time = 0; time < 25; time += FRAME) stepIntel(world, FRAME)
    expect(world.intel.move.moves).toBe(0)
  })

  it('moves it once when a freed guard says the intruder asked about it, not again a minute later', () => {
    const world = freshWorld(1)
    Object.assign(world.player, { x: 5, y: world.groundY - 2 })
    world.security.caseAskedAt = 0
    for (let time = 0; time < 1; time += FRAME) stepIntel(world, FRAME)
    expect(world.intel.move.moves).toBe(1)
    for (let time = 0; time < 120; time += FRAME) stepIntel(world, FRAME)
    expect(world.intel.move.moves).toBe(1)
  })

  it('does not move it while it is on the player\'s screen, even across the room', () => {
    const world = freshWorld(1)
    Object.assign(world.player, { x: world.loot.x + 18, y: world.loot.y - 1 })
    world.security.level = 3
    for (let time = 0; time < 25; time += FRAME) stepIntel(world, FRAME)
    expect(world.intel.move.moves).toBe(0)
  })

  it.each([1, 2, 3])('seed %i: moves it only to a room with floor left to set it down on', (seed) => {
    const world = freshWorld(seed)
    const keep = world.intel.places.filter((place) => place.id !== world.intel.real).at(-1)!
    for (const place of world.intel.places) {
      if (place.id === world.intel.real || place === keep) continue
      for (let x = place.x; x < place.x + place.w; x += 1) setTile(world.grid, x, place.floorY, 'air')
    }
    Object.assign(world.player, { x: 5, y: world.groundY - 2 })
    world.security.level = 3
    for (let time = 0; time < 25; time += FRAME) stepIntel(world, FRAME)
    expect(world.intel.real).toBe(keep.id)
  })
})
