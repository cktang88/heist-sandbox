import { describe, expect, it } from 'vitest'
import { feetOf, type Guard } from '../security/model'
import { placeAt, startRun, wait, type Run } from '../stealthRuns/kit'
import { knockOutCold, layBodyAt } from './bodies'
import { spotFeet, spotKind } from './spots'
import { quickKill } from './takedown'

/**
 * Bodies on the real complex, every guard on duty: one left in a corridor is found within a minute or so by whoever
 * walks past; the same body stuffed in a locker stays unfound by patrols, check-ins and all, unless a search opens it.
 */

/** A patrol in the tower with a hiding place on his route: the victim, and the cupboard. */
function victimAndCupboard(run: Run): { victim: Guard; cupboard: Run['world']['props'][number] } {
  const { world } = run
  for (const guard of world.guards) {
    if (guard.role !== 'patrol' || world.rooms[guard.roomId ?? -1]?.building !== 'tower') continue
    const feet = feetOf(guard)
    const cupboard = world.props.find((prop) => spotKind(prop.kind)?.how === 'inside' && Math.abs(spotFeet(prop).y - feet.y) < 0.5 && Math.abs(spotFeet(prop).x - feet.x) < 8)
    if (cupboard) return { victim: guard, cupboard }
  }
  throw new Error('no patrol with a cupboard near')
}

/** A patrol in the tower standing on another patrol's beat: whoever walks it will come across him. */
function onAnotherBeat(run: Run): Guard {
  const { world } = run
  const patrols = world.guards.filter((guard) => guard.role === 'patrol' && world.rooms[guard.roomId ?? -1]?.building === 'tower')
  const victim = patrols.find((guard) => patrols.some((other) => {
    if (other === guard || Math.abs(other.home.y - feetOf(guard).y) > 0.5) return false
    const xs = other.route.map((point) => point.x)
    return feetOf(guard).x > Math.min(...xs) + 1 && feetOf(guard).x < Math.max(...xs) - 1
  }))
  if (!victim) throw new Error('no patrol on another one\'s beat')
  return victim
}

/** The player waits it out in the sewer, out of everyone's way. */
function playerAway(run: Run): void {
  const sewer = run.world.rooms.find((room) => room.kind === 'sewer')!
  placeAt(run.world, sewer.x + 2, sewer.floorY)
}

describe('bodies on the site', () => {
  it.each([1, 2])('seed %i: a man choked out, tied and hidden in a cupboard stays unfound for three minutes, check-ins and all', (seed) => {
    const run = startRun(seed)
    const { victim, cupboard } = victimAndCupboard(run)
    // Choked out and tied (no blood to follow), then stuffed in.
    knockOutCold(run.world, victim, 1000)
    victim.restrained = true
    victim.hiddenIn = cupboard.id
    layBodyAt(victim, spotFeet(cupboard), 1)
    playerAway(run)
    wait(run, 180)
    expect(run.world.stealth.found.has(run.world.guards.indexOf(victim)), run.world.security.log.join(' / ')).toBe(false)
    expect(run.world.security.log.some((line) => line.includes('Man down'))).toBe(false)
  }, 60_000)

  it.each([1, 2])('seed %i: a body left lying where another patrol walks is found within a couple of minutes', (seed) => {
    const run = startRun(seed)
    const victim = onAnotherBeat(run)
    quickKill(run.world, victim)
    playerAway(run)
    const found = wait(run, 150, () => run.world.stealth.found.has(run.world.guards.indexOf(victim)))
    expect(found).toBe(true)
  }, 60_000)
})
