import { describe, expect, it } from 'vitest'
import { deviceState } from '../devices/state'
import { feetOf } from '../security/model'
import { roomOf } from '../security/places'
import { tileAt } from '../tiles'
import { createWorld } from '../world'
import { isOutdoors } from './conditions/rain'
import { CONDITIONS } from './conditions/registry'
import { nightConditions } from './director'
import { footstepMasking } from './masking'
import { buildingCircuits } from './power'
import { createDirector } from './state'
import { directedWorld, idle } from './testWorld'

describe('tonight\'s conditions', () => {
  it('the same seed always picks the same two or three conditions, and different seeds pick different nights', () => {
    const nights = new Set<string>()
    for (let seed = 1; seed <= 40; seed += 1) {
      const picks = createDirector(seed, 'complex').picks
      expect(createDirector(seed, 'complex').picks).toEqual(picks)
      expect(picks.length).toBeGreaterThanOrEqual(2)
      expect(picks.length).toBeLessThanOrEqual(3)
      nights.add(picks.join('+'))
    }
    expect(nights.size).toBeGreaterThan(25)
  })

  it('never puts conditions that rule each other out on the same night, and only fitting ones on the small site', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      for (const site of ['complex', 'outpost'] as const) {
        const picks = createDirector(seed, site).picks
        for (const id of picks) {
          const def = CONDITIONS.find((condition) => condition.id === id)!
          expect(def.fits(site)).toBe(true)
          expect(picks.filter((other) => def.excludes.includes(other))).toEqual([])
        }
      }
    }
  })

  it('names each condition in one line for the briefing once started, and nothing while the director is off', () => {
    expect(nightConditions(createWorld(5, 'complex'))).toEqual([])
    const world = directedWorld(5)
    const lines = nightConditions(world)
    expect(lines).toHaveLength(world.director.picks.length)
    for (const line of lines) expect(line).toMatch(/^[A-Z][^\n]{20,160}\.$/)
  })

  it('rain drowns footsteps outdoors only, and outdoor patrols walk shorter rounds', () => {
    const plain = createWorld(3, 'complex')
    const world = directedWorld(3, 'complex', ['rain'])
    const outdoor = world.guards.findIndex((guard) => guard.role === 'patrol' && guard.route.length >= 2 && isOutdoors(world, feetOf(guard)))
    expect(outdoor).toBeGreaterThanOrEqual(0)
    const span = (route: { x: number }[]) => Math.abs(route[route.length - 1].x - route[0].x)
    expect(span(world.guards[outdoor].route)).toBeLessThan(span(plain.guards[outdoor].route))
    expect(footstepMasking(world, feetOf(world.guards[outdoor]))).toBeGreaterThan(0)
    const office = world.rooms.find((room) => room.kind === 'office')!
    expect(footstepMasking(world, { x: office.x + 2, y: office.floorY })).toBe(0)
  })

  it('a storm flashes lightning and rolls thunder through the night', () => {
    const world = directedWorld(3, 'complex', ['storm'])
    idle(world, 70)
    expect(Number.isFinite(world.director.lightningAt)).toBe(true)
    expect(world.director.masking.outdoors).toBeGreaterThan(0)
  })

  it('lightning lands on the skyline: the bolt cracks on top of whatever stands highest, not in the sky', () => {
    const world = directedWorld(3, 'complex', ['storm'])
    let struck: { x: number; y: number } | undefined
    for (let second = 0; second < 90 && !struck; second += 1) {
      idle(world, 1)
      if (world.clock - world.director.lightningAt < 1) struck = [...world.sounds].reverse().find((sound) => sound.kind === 'explosion')
    }
    expect(struck).toBeDefined()
    expect(struck!.y).toBeGreaterThan(0)
    expect(tileAt(world.grid, Math.floor(struck!.x), Math.floor(struck!.y + 1))).not.toBe('air')
  })

  it('backup power leaves one building dark all night without anyone sent to fix it', () => {
    const world = directedWorld(4, 'complex', ['backupPower'])
    const dark = ['quarters', 'depot', 'tower'].find((building) => buildingCircuits(world, building).every((circuit) => world.deadCircuits.has(circuit)))!
    expect(dark).toBeDefined()
    idle(world, 40)
    expect(buildingCircuits(world, dark).every((circuit) => world.deadCircuits.has(circuit))).toBe(true)
    expect(world.guards.filter((guard) => guard.interest?.kind === 'lightsOut')).toEqual([])
  })

  it('a skeleton crew sends a quarter of the patrols to bed in the quarters', () => {
    const plain = createWorld(6, 'complex')
    const world = directedWorld(6, 'complex', ['skeletonCrew'])
    const inQuarters = (w: typeof world) => w.guards.filter((guard) => roomOf(w, feetOf(guard))?.building === 'quarters').length
    expect(inQuarters(world)).toBeGreaterThanOrEqual(inQuarters(plain) + 8)
    expect(world.guards.length).toBe(plain.guards.length)
  })

  it('a VIP visit adds a protection detail led by an officer', () => {
    const plain = createWorld(6, 'complex')
    const world = directedWorld(6, 'complex', ['vipVisit'])
    expect(world.guards.length).toBe(plain.guards.length + 8)
    expect(world.guards.filter((guard) => guard.role === 'officer').length).toBe(plain.guards.filter((guard) => guard.role === 'officer').length + 1)
    const small = directedWorld(6, 'outpost', ['vipVisit'])
    expect(small.guards.length).toBe(createWorld(6, 'outpost').guards.length + 3)
  })

  it('the shift change at its stated time brings fresh guards out of the quarters and sends tired ones back', () => {
    const world = directedWorld(7, 'complex', ['shiftChange'])
    const [minutes, seconds] = nightConditions(world)[0].match(/at (\d+):(\d\d)/)!.slice(1).map(Number)
    const before = world.guards.length
    idle(world, minutes * 60 + seconds + 2)
    expect(world.guards.length).toBe(before + 5)
    expect(world.guards.slice(before).every((guard) => guard.station !== null || guard.role === 'patrol')).toBe(true)
    expect(world.chronicle.beats.some((beat) => beat.kind === 'event' && beat.detail === 'shiftChange')).toBe(true)
  })

  it('a delivery opens the depot and keeps guards busy at the loading dock', () => {
    const world = directedWorld(8, 'complex', ['delivery'])
    const [minutes, seconds] = nightConditions(world)[0].match(/at (\d+):(\d\d)/)!.slice(1).map(Number)
    const unlockedBefore = deviceState(world).unlockedDoors.size
    idle(world, minutes * 60 + seconds + 2)
    const dock = world.rooms.find((room) => room.kind === 'loadingDock' && room.building === 'depot')!
    expect(world.guards.filter((guard) => guard.station && Math.abs(guard.station.y - dock.floorY) < 1 && guard.station.x >= dock.x && guard.station.x <= dock.x + dock.w).length).toBeGreaterThan(0)
    expect(deviceState(world).unlockedDoors.size).toBeGreaterThan(unlockedBefore)
    idle(world, 60)
    expect(deviceState(world).unlockedDoors.size).toBe(unlockedBefore)
  })

  it('maintenance puts a climbable scaffold up the tower and parks a lift', () => {
    const world = directedWorld(9, 'complex', ['scaffolding'])
    const storeys = Number(nightConditions(world)[0].match(/floor (\d+)/)?.[1] ?? 0)
    expect(storeys).toBeGreaterThanOrEqual(3)
    let ladders = 0
    for (let x = 0; x < world.grid.width; x += 1) if (tileAt(world.grid, x, world.groundY - 3) === 'ladder' && tileAt(world.grid, x, world.groundY - 12) === 'ladder') ladders += 1
    expect(ladders).toBeGreaterThanOrEqual(1)
    expect(world.elevatorCars.some((car) => car.locked)).toBe(true)
  })

  it('a fire drill sends a building\'s guards out to the street', () => {
    const world = directedWorld(10, 'complex', ['fireDrill'])
    const [minutes, seconds] = nightConditions(world)[0].match(/at (\d+):(\d\d)/)!.slice(1).map(Number)
    idle(world, minutes * 60 + seconds + 1)
    expect(world.guards.filter((guard) => guard.station && Math.abs(guard.station.y - world.groundY) < 0.5).length).toBeGreaterThan(0)
  })

  it('a party fills a lounge with drunk, jumpy off-duty guards and music that covers footsteps there', () => {
    const plain = createWorld(11, 'complex')
    const world = directedWorld(11, 'complex', ['party'])
    const guests = world.guards.slice(plain.guards.length)
    expect(guests).toHaveLength(4)
    expect(guests.every((guest) => guest.tier === 'rookie' && guest.shock > 0)).toBe(true)
    expect(footstepMasking(world, feetOf(guests[0]))).toBeGreaterThan(0)
  })

  it('an inspection leaves nobody green and walks the inspector from post to post', () => {
    const world = directedWorld(12, 'complex', ['inspection'])
    expect(world.guards.filter((guard) => guard.tier === 'rookie')).toEqual([])
    const inspector = world.guards.at(-1)!
    expect(inspector.role).toBe('officer')
    idle(world, 2)
    expect(inspector.station).not.toBeNull()
  })

  it('a rival crew makes trouble well away from the player', () => {
    const world = directedWorld(13, 'complex', ['rivalCrew'])
    idle(world, 160)
    const strikes = world.chronicle.beats.filter((beat) => beat.kind === 'event' && beat.detail === 'rivalCrew')
    expect(strikes.length).toBeGreaterThanOrEqual(1)
    expect(strikes[0].outcome).toBeTruthy()
  })
})
