import { describe, expect, it } from 'vitest'
import { createProps, hurtPropsInRadius, isInCover, shotHitsProp, sightBlockedByProps } from './cover'
import { GROUND } from './level'
import type { PropKind } from './propCatalog'
import { createWorld, type World } from './world'

/** The outpost on its street, with one prop standing at x 30 (a crate's box spans 29.9..31.1, up to 1.1 tall) and nobody near it. */
function streetWith(kind: PropKind): World {
  const world = createWorld(1)
  world.guards = []
  world.props = createProps([{ kind, x: 30, y: GROUND }])
  Object.assign(world.player, { x: 5, y: GROUND - 1.6 })
  return world
}

/** A shot point flying right at a given height above the street. */
const shotAt = (x: number, height: number, fromPlayer = false) => ({ x, y: GROUND - height, vx: 40, vy: 0, fromPlayer })

describe('shots and cover', () => {
  it('stops a shot that crosses a low prop below its top, and lets one above it pass', () => {
    const world = streetWith('crate')
    expect(shotHitsProp(world, shotAt(30, 0.5), 10)).toBe(true)
    expect(shotHitsProp(world, shotAt(30, 1.4), 10)).toBe(false)
    expect(world.props[0].hp).toBe(50)
  })

  it('lets someone fire over their own cover', () => {
    const world = streetWith('crate')
    Object.assign(world.player, { x: 28.6, y: GROUND - 0.9, h: 0.9, crouching: true })
    expect(shotHitsProp(world, shotAt(30, 0.5, true), 10)).toBe(false)
    Object.assign(world.player, { x: 10 })
    expect(shotHitsProp(world, shotAt(30, 0.5, true), 10)).toBe(true)
  })

  it('catches a thin partition between two shot steps', () => {
    const world = streetWith('partition')
    expect(shotHitsProp(world, shotAt(30.75, 1), 5)).toBe(true)
  })

  it('breaks a prop that runs out of hp: it gives no more cover, thuds and throws debris', () => {
    const world = streetWith('crate')
    expect(shotHitsProp(world, shotAt(30, 0.5), 60)).toBe(true)
    expect(world.props[0].broken).toBe(true)
    expect(world.sounds.some((sound) => sound.kind === 'impact')).toBe(true)
    expect(world.effects.particles.length).toBeGreaterThan(5)
    expect(shotHitsProp(world, shotAt(30, 0.5), 10)).toBe(false)
  })

  it('never breaks indestructible cover', () => {
    const world = streetWith('jerseyBarrier')
    expect(shotHitsProp(world, shotAt(30, 0.5), 1e6)).toBe(true)
    expect(world.props[0].broken).toBe(false)
  })

  it('ignores props without cover and wall props', () => {
    const world = createWorld(1)
    world.guards = []
    world.props = createProps([{ kind: 'plant', x: 30, y: GROUND }, { kind: 'whiteboard', x: 40, y: GROUND - 3 }])
    expect(shotHitsProp(world, shotAt(30, 0.5), 10)).toBe(false)
    expect(shotHitsProp(world, shotAt(40, 2.5), 10)).toBe(false)
  })

  it('lets explosions damage and break props within their radius', () => {
    const world = createWorld(1)
    world.props = createProps([{ kind: 'crate', x: 30, y: GROUND }, { kind: 'crate', x: 34, y: GROUND }, { kind: 'whiteboard', x: 30, y: GROUND - 3 }])
    hurtPropsInRadius(world, { x: 30.5, y: GROUND - 1 }, 3, 100)
    expect(world.props[0].broken).toBe(true)
    expect(world.props[1].broken).toBe(false)
    expect(world.props[2].broken).toBe(true)
  })
})

describe('sight and cover', () => {
  const eye = { x: 45, y: GROUND - 1.25 }

  it('hides a crouching player behind low cover but not a standing one', () => {
    const world = streetWith('crate')
    Object.assign(world.player, { x: 29, y: GROUND - 0.9, h: 0.9, crouching: true })
    const crouched = { x: 29.35, y: GROUND - 0.45 }
    expect(sightBlockedByProps(world, eye, crouched)).toBe(true)
    Object.assign(world.player, { y: GROUND - 1.6, h: 1.6, crouching: false })
    expect(sightBlockedByProps(world, eye, { x: 29.35, y: GROUND - 0.8 })).toBe(false)
  })

  it('hides a standing person behind high cover, only from the far side', () => {
    const world = streetWith('bookshelf')
    const behind = { x: 29.2, y: GROUND - 0.8 }
    expect(sightBlockedByProps(world, eye, behind)).toBe(true)
    expect(sightBlockedByProps(world, { x: 20, y: GROUND - 1.25 }, behind)).toBe(false)
  })

  it('does not hide someone who is nowhere near the prop', () => {
    const world = streetWith('bookshelf')
    expect(sightBlockedByProps(world, eye, { x: 20, y: GROUND - 0.8 })).toBe(false)
  })

  it('tells the HUD when the player is in cover', () => {
    const world = streetWith('crate')
    Object.assign(world.player, { x: 29, y: GROUND - 1.6, h: 1.6, crouching: false })
    expect(isInCover(world, world.player)).toBe(false)
    Object.assign(world.player, { y: GROUND - 0.9, h: 0.9, crouching: true })
    expect(isInCover(world, world.player)).toBe(true)
    Object.assign(world.player, { x: 20 })
    expect(isInCover(world, world.player)).toBe(false)
  })
})
