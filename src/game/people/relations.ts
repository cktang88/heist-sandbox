import { knownDead } from '../security/checkins'
import { isShielded } from '../security/combat'
import { breakDown } from '../security/fear'
import { eyeOf, feetOf, isActive, type Guard } from '../security/model'
import { frighten } from '../security/nerve'
import { clearView } from '../security/perception'
import { sameFloor } from '../security/places'
import { centerOf, distance } from '../types'
import type { World } from '../world'
import { bondsOf, CLOSE, otherIn } from './bonds'
import { reveal } from './knowledge'
import { radio, say } from './lines'
import { has, remember } from './memory'
import { callName } from './people'
import type { Bond, PeopleState, Person } from './types'

/**
 * Bonds at work. A man who sees his friend die (or finds the body) goes berserk or falls apart; rivals sneer and
 * will not partner up; a mentor steadies his rookie; a partner will not leave a wounded or knocked-out partner;
 * friends hold fire when the intruder holds one of them as a shield, and cover for each other on the radio.
 */

const WITNESS = 16
const NEAR = 12
const BERSERK_SECONDS = 60
/** Grief that breaks a man: far more fright than the usual rule gives for a colleague's death. */
const GRIEF_SHOCK = 0.7
const MENTOR_STEADY = 0.04
const PARTNER_SHOCK_CAP = 0.2
const SHIELD_FRIGHT = 0.05
const HESITATE_AFTER_SHIELD = 1.5
/** How long a friend's cover story holds the control room off. */
const COVER_SECONDS = 45

function trouble(guard: Guard): boolean {
  return guard.mode === 'combat' || guard.mode === 'searching' || guard.mode === 'investigating'
}

function near(a: Guard, b: Guard, reach: number): boolean {
  const fa = feetOf(a)
  const fb = feetOf(b)
  return sameFloor(fa, fb) && Math.abs(fa.x - fb.x) < reach
}

/** Every bond of this living person, acted on once per tick. */
export function actOnBonds(world: World, people: PeopleState, person: Person): void {
  const guard = person.guard
  if (!isActive(guard)) return
  for (const bond of bondsOf(people.bonds, person.id)) {
    const other = people.persons[otherIn(bond, person.id)]
    if (!people.active.has(other.guard)) continue
    if (other.guard.mode === 'dead') mournIfWitnessed(world, people, person, other, bond)
    else actOnBond(world, people, person, other, bond)
  }
  if (person.guarding !== null) keepGuarding(people, person)
}

function actOnBond(world: World, people: PeopleState, person: Person, other: Person, bond: Bond): void {
  const guard = person.guard
  const them = other.guard
  if (bond.kind === 'mentor' && bond.a === person.id && isActive(them) && trouble(them) && near(guard, them, NEAR)) {
    them.shock = Math.max(0, them.shock - MENTOR_STEADY)
    say(world, people, person, 'mentorShield', { about: other })
  }
  if (bond.kind === 'partners' || bond.kind === 'couple' || bond.kind === 'brothers') {
    const down = them.stunSeconds > 0 || them.hp < them.maxHp * 0.5
    if (down && near(guard, them, 8) && inSight(world, guard, them)) {
      if (guard.shock > PARTNER_SHOCK_CAP) {
        guard.nerve = Math.min(1, guard.nerve + guard.shock - PARTNER_SHOCK_CAP)
        guard.shock = PARTNER_SHOCK_CAP
      }
      const starts = them.stunSeconds > 0 && (guard.mode === 'calm' || guard.mode === 'caution') && person.guarding === null
      if (starts) {
        person.guarding = other.id
        guard.station = feetOf(them)
      }
      say(world, people, person, 'partnerStays', { about: other }, starts)
    }
  }
  // Told to partner his rival, he will not.
  if (bond.kind === 'rivals' && guard.follow !== null && world.guards[guard.follow] === them) {
    guard.follow = null
    say(world, people, person, 'rivalNoHelp', { about: other }, true)
  }
}

/** Can he see the man where he lies: not stuffed out of sight, not on the intruder's shoulder, nothing in between? */
function inSight(world: World, guard: Guard, them: Guard): boolean {
  if (them.hiddenIn !== null || world.guards[world.stealth.carried ?? -1] === them) return false
  return clearView(world, eyeOf(guard), centerOf(them))
}

/** Standing over a knocked-out partner until he comes round. */
function keepGuarding(people: PeopleState, person: Person): void {
  const other = people.persons[person.guarding!]
  if (other.guard.stunSeconds > 0 && other.guard.mode !== 'dead' && person.guard.station) return
  person.guarding = null
  if (person.guard.mode === 'calm' || person.guard.mode === 'caution') person.guard.station = null
}

/** He saw it happen, or has found the body: grief, or a rival's shrug. Once per death. */
function mournIfWitnessed(world: World, people: PeopleState, person: Person, dead: Person, bond: Bond): void {
  if (has(person, 'friendDied', dead.id)) return
  const guard = person.guard
  const body = dead.guard.ragdoll?.points[2] ?? centerOf(dead.guard)
  const index = world.guards.indexOf(dead.guard)
  const found = index >= 0 && guard.bodiesSeen.includes(index)
  const saw = distance(eyeOf(guard), body) < WITNESS && clearView(world, eyeOf(guard), body) && world.clock - deathClock(world, index) < 2
  if (!found && !saw) return
  remember(person, 'friendDied', world.clock, dead.id)
  if (CLOSE.has(bond.kind)) grieve(world, people, person, dead)
  else if (bond.kind === 'rivals') say(world, people, person, 'rivalDown', { about: dead })
  else if (bond.kind === 'debt' && bond.b === person.id) say(world, people, person, 'debtDown', { about: dead })
}

function deathClock(world: World, index: number): number {
  for (let i = world.security.deaths.length - 1; i >= 0; i -= 1) if (world.security.deaths[i].victim === index) return world.security.deaths[i].clock
  return -Infinity
}

/** Rage or collapse, beyond what the ordinary rule for a colleague's death does. */
function grieve(world: World, people: PeopleState, person: Person, dead: Person): void {
  const traits = person.traits
  const steady = traits.includes('brave') || (person.guard.tier === 'veteran' && !traits.includes('coward'))
  const rage = !traits.includes('coward') && (steady || people.rng() < 0.4)
  if (rage) {
    person.berserkUntil = world.clock + BERSERK_SECONDS
    remember(person, 'berserk', world.clock, dead.id)
    say(world, people, person, 'griefBerserk', { about: dead }, true)
    if (traits.includes('brave')) reveal(world, person, 'brave')
    return
  }
  remember(person, 'brokeDown', world.clock, dead.id)
  say(world, people, person, 'griefBreak', { about: dead }, true)
  frighten(person.guard, GRIEF_SHOCK)
  if (person.guard.mode !== 'surrendered') breakDown(world, person.guard)
  if (traits.includes('coward')) reveal(world, person, 'coward')
}

/**
 * The human shield: friends of the man held plead and hold fire, and once he is let go they hesitate before
 * shooting; a rival is less sentimental about it.
 */
export function watchShield(world: World, people: PeopleState): void {
  const shield = world.melee.shield
  if (shield !== people.shieldWas) {
    if (!shield) for (const guard of people.hesitant) if (guard.mode === 'combat') guard.drawSeconds = Math.max(guard.drawSeconds, HESITATE_AFTER_SHIELD)
    people.hesitant.clear()
    people.shieldWas = shield
  }
  if (!shield || shield.mode === 'dead') return
  const held = people.byGuard.get(shield)
  if (!held?.roster) return
  for (const bond of bondsOf(people.bonds, held.id)) {
    const person = people.persons[otherIn(bond, held.id)]
    const guard = person.guard
    if (!isActive(guard) || guard.mode !== 'combat' || people.hesitant.has(guard) || !isShielded(world, guard)) continue
    if (CLOSE.has(bond.kind)) {
      people.hesitant.add(guard)
      frighten(guard, SHIELD_FRIGHT)
      say(world, people, person, 'shieldFriend', { about: held }, true)
    } else if (bond.kind === 'rivals') {
      people.hesitant.add(guard)
      say(world, people, person, 'shieldRival', { about: held }, true)
    }
  }
}

/**
 * The control room is polling a man who missed his check-in. A friend who is calm and on the net covers for him,
 * which buys the player time (by-the-book men never do). Once the poll runs out anyway, the friend says so.
 */
export function coverForFriends(world: World, people: PeopleState): void {
  for (const poll of world.security.polls) {
    if (people.covered.has(poll.guard)) continue
    const missing = people.byGuard.get(world.guards[poll.guard])
    if (!missing?.roster) continue
    people.covered.add(poll.guard)
    const friend = closeFriends(people, missing).find((person) => calmAndOnline(person.guard) && !person.traits.includes('byTheBook'))
    if (!friend) continue
    poll.at += COVER_SECONDS
    radio(world, people, friend, 'coverFriend', { other: callName(people, missing) })
  }
  for (const person of people.persons) {
    if (!person.roster || !person.guard.missing || people.lamented.has(person.id) || !people.covered.has(world.guards.indexOf(person.guard))) continue
    if (world.security.polls.some((poll) => world.guards[poll.guard] === person.guard)) continue
    people.lamented.add(person.id)
    // His body has been found: nobody asks where he has got to.
    if (knownDead(world, world.guards.indexOf(person.guard))) continue
    const friend = closeFriends(people, person).find((other) => calmAndOnline(other.guard) || trouble(other.guard))
    if (!friend) continue
    const down = world.guards.filter((guard) => guard.mode === 'dead' || guard.missing).length
    radio(world, people, friend, down >= 2 ? 'downCount' : 'friendGone', { other: callName(people, person), count: down })
  }
}

function closeFriends(people: PeopleState, person: Person): Person[] {
  return bondsOf(people.bonds, person.id).filter((bond) => CLOSE.has(bond.kind)).map((bond) => people.persons[otherIn(bond, person.id)])
}

function calmAndOnline(guard: Guard): boolean {
  return isActive(guard) && (guard.mode === 'calm' || guard.mode === 'caution')
}
