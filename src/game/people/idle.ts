import { feetOf, type Guard } from '../security/model'
import { sameFloor } from '../security/places'
import { hasLineOfSight } from '../vision'
import type { World } from '../world'
import { bondsOf, otherIn } from './bonds'
import { reveal } from './knowledge'
import { say, type TalkKind } from './lines'
import { HANGOVER_SECONDS, effectOf } from './traits'
import type { ActName, BondKind, PeopleState, Person, TraitId } from './types'
import { stumble } from './effects'

/**
 * Little scenes when nothing is wrong: a yawn, a cigarette, a phone, two friends talking. Only a calm guard who is
 * pausing (a patrol at a waypoint) or standing his post does one, so the patrol code is never fought: the act just
 * holds his pause a little longer and may turn him away from his arc, which is the player's opening.
 */

const ACT_GAP_MIN = 45
const ACT_GAP_MAX = 100
const START_ODDS = 0.25
const CHAT_REACH = 18
const CHAT_CLOSE = 2.2
const CHAT_SECONDS = 9
const OFFICER_REACH = 5
const SHORTEST_ACT = 2.5

type ActPlan = { name: ActName; talk: TalkKind; seconds: number; turnsAway: boolean; trait?: TraitId }

const PLANS: Record<Exclude<ActName, 'chat' | 'scold' | 'trip'>, ActPlan> = {
  yawn: { name: 'yawn', talk: 'yawn', seconds: 3, turnsAway: false },
  stretch: { name: 'stretch', talk: 'stretch', seconds: 3, turnsAway: false },
  phone: { name: 'phone', talk: 'phone', seconds: 7, turnsAway: true },
  hum: { name: 'hum', talk: 'hum', seconds: 5, turnsAway: false },
  smoke: { name: 'smoke', talk: 'smoke', seconds: 12, turnsAway: true, trait: 'smoker' },
  coffee: { name: 'coffee', talk: 'coffee', seconds: 5, turnsAway: false },
  speech: { name: 'speech', talk: 'speech', seconds: 6, turnsAway: true },
  noticeboard: { name: 'noticeboard', talk: 'noticeboard', seconds: 6, turnsAway: true },
  lean: { name: 'lean', talk: 'lean', seconds: 9, turnsAway: false, trait: 'lazy' },
}

/** May this guard do something idle right now without upsetting what the patrol code has him doing? */
function idleOk(world: World, guard: Guard): boolean {
  if (guard.mode !== 'calm' || guard.interest || guard.station || guard.stairs || guard.stunSeconds > 0 || world.security.level > 1) return false
  if (guard.role === 'patrol') return guard.wait > SHORTEST_ACT && !guard.detour
  const feet = feetOf(guard)
  return sameFloor(feet, guard.home) && Math.abs(feet.x - guard.home.x) < 0.7
}

export function stepIdle(world: World, people: PeopleState, person: Person): void {
  const guard = person.guard
  if (person.act) {
    if (guard.mode !== 'calm' || world.clock >= person.act.until) person.act = null
    // A patrol's act lives inside his pause: when he walks on, it is over.
    else if (guard.role === 'patrol' && guard.wait <= 0) person.act = null
    return
  }
  if (person.traits.includes('byTheBook') && people.rng() < 0.7) return
  if (startChat(world, people, person)) return
  if (world.clock < person.nextActAt || !idleOk(world, guard)) return
  const effect = effectOf(person.traits, world.clock)
  person.nextActAt = world.clock + (ACT_GAP_MIN + people.rng() * (ACT_GAP_MAX - ACT_GAP_MIN)) / effect.idle
  if (people.rng() > START_ODDS * effect.idle) return
  if (person.traits.includes('clumsy') && people.rng() < 0.4) {
    stumble(world, people, person)
    return
  }
  if (guard.role === 'officer' && scold(world, people, person)) return
  begin(world, people, person, choosePlan(world, people, person))
}

/** The act that suits him: his traits first, otherwise any small thing. */
function choosePlan(world: World, people: PeopleState, person: Person): ActPlan {
  const traits = person.traits
  const roll = people.rng()
  if (traits.includes('smoker') && roll < 0.6) return PLANS.smoke
  if (traits.includes('hungover') && world.clock < HANGOVER_SECONDS && roll < 0.6) return { ...PLANS.yawn, talk: 'hungover', trait: 'hungover' }
  if (traits.includes('lazy') && roll < 0.5) return PLANS.lean
  if (traits.includes('green') && roll < 0.5) return { ...PLANS.hum, talk: 'green', trait: 'green' }
  if (traits.includes('byTheBook') && roll < 0.5) return PLANS.noticeboard
  const plain = [PLANS.yawn, PLANS.stretch, PLANS.phone, PLANS.hum, PLANS.coffee, PLANS.speech, PLANS.noticeboard]
  return plain[Math.floor(people.rng() * plain.length)]
}

function begin(world: World, people: PeopleState, person: Person, plan: ActPlan, withId: number | null = null): void {
  const guard = person.guard
  const seconds = fitInPause(guard, plan.seconds)
  person.act = { name: plan.name, until: world.clock + seconds, with: withId }
  if (plan.turnsAway) guard.facing = guard.facing === 1 ? -1 : 1
  if (say(world, people, person, plan.talk) && plan.trait) reveal(world, person, plan.trait)
}

/**
 * How long an act can last: a patrol's fits inside the pause he is already taking, so his rounds keep their timing;
 * a man on post just puts off his next turn.
 */
function fitInPause(guard: Guard, seconds: number): number {
  if (guard.role === 'patrol') return Math.min(seconds, guard.wait - 0.2)
  guard.wait = Math.max(guard.wait, seconds)
  return seconds
}

/** An officer standing near a subordinate finds something to say about him. */
function scold(world: World, people: PeopleState, person: Person): boolean {
  const feet = feetOf(person.guard)
  const target = people.persons.find((other) => other !== person && other.roster && other.guard.mode === 'calm' && other.guard.role !== 'officer'
    && sameFloor(feetOf(other.guard), feet) && Math.abs(feetOf(other.guard).x - feet.x) < OFFICER_REACH)
  if (!target) return false
  person.act = { name: 'scold', until: world.clock + fitInPause(person.guard, 4), with: target.id }
  person.guard.facing = feetOf(target.guard).x >= feet.x ? 1 : -1
  say(world, people, person, 'scold', { about: target })
  return true
}

const CHAT_TALK: Partial<Record<BondKind, TalkKind>> = {
  friends: 'chatFriends', partners: 'chatFriends', brothers: 'chatFriends', couple: 'chatCouple', debt: 'chatDebt', rivals: 'chatRivals', mentor: 'chatMentor',
}

/**
 * Two who know each other drift together when all is quiet: a patrolling man walks over to the other (a short
 * detour, which the patrol code already knows how to take), and when they are side by side both stop to talk.
 * That is when the player can listen in.
 */
function startChat(world: World, people: PeopleState, person: Person): boolean {
  const guard = person.guard
  if (guard.mode !== 'calm' || world.security.level > 0 || guard.station || guard.stairs) return false
  for (const bond of bondsOf(people.bonds, person.id)) {
    const talk = CHAT_TALK[bond.kind]
    const other = people.persons[otherIn(bond, person.id)]
    const them = other.guard
    if (!talk || !people.active.has(them) || them.mode !== 'calm' || other.act || them.stunSeconds > 0 || them.stairs) continue
    const mine = feetOf(guard)
    const theirs = feetOf(them)
    const gap = Math.abs(mine.x - theirs.x)
    if (!sameFloor(mine, theirs) || gap > CHAT_REACH) continue
    if (gap < CHAT_CLOSE && idleOk(world, guard) && idleOk(world, them)) {
      chat(world, people, person, other, talk)
      return true
    }
    // Walk over, now and then, if nothing is in the way.
    const keen = person.traits.includes('chatty') ? 2 : 1
    if (guard.role !== 'patrol' || guard.wait <= 1 || guard.detour || world.clock < person.nextActAt || people.rng() > 0.15 * keen) continue
    if (!hasLineOfSight(world.grid, { x: mine.x, y: mine.y - 1 }, { x: theirs.x, y: theirs.y - 1 })) continue
    guard.detour = { x: theirs.x + (mine.x < theirs.x ? -1.2 : 1.2), y: theirs.y }
    guard.wait = 0
    person.nextActAt = world.clock + 20
    return true
  }
  return false
}

function chat(world: World, people: PeopleState, person: Person, other: Person, talk: TalkKind): void {
  const seconds = CHAT_SECONDS * (person.traits.includes('chatty') || other.traits.includes('chatty') ? 1.6 : 1)
  for (const [one, two] of [[person, other], [other, person]] as const) {
    const until = world.clock + fitInPause(one.guard, seconds)
    one.act = { name: 'chat', until, with: two.id }
    one.guard.facing = feetOf(two.guard).x >= feetOf(one.guard).x ? 1 : -1
    one.nextActAt = until + ACT_GAP_MIN
  }
  say(world, people, person, talk, { about: other })
  if (person.traits.includes('chatty')) reveal(world, person, 'chatty')
}
