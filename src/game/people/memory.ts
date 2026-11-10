import { TOOLS } from '../toolDefs'
import { nearPlayer } from '../security/barks'
import { feetOf } from '../security/model'
import { centerOf, distance } from '../types'
import type { World } from '../world'
import { reveal } from './knowledge'
import { say, type Fill, type TalkKind } from './lines'
import type { Deed, Memory, MemoryKind, PeopleState, Person, Snapshot } from './types'

/**
 * What happened to each person tonight. Each tick compares his guard with the last snapshot and writes down
 * anything new (knocked out, woke, gave up, was let go, was hurt, saw the man...). Later, with a quiet moment and
 * the player in earshot, he talks about it: only about things that really happened to him.
 */

const SAW_CLOSE = 10
const WOUND_MEMORY_GAP = 10

export function remember(person: Person, kind: MemoryKind, clock: number, about?: number): void {
  person.memories.push(about === undefined ? { kind, clock } : { kind, clock, about })
}

export function has(person: Person, kind: MemoryKind, about?: number): boolean {
  return person.memories.some((memory) => memory.kind === kind && (about === undefined || memory.about === about))
}

export function count(person: Person, kind: MemoryKind): number {
  return person.memories.filter((memory) => memory.kind === kind).length
}

function last(person: Person, kind: MemoryKind): Memory | undefined {
  for (let i = person.memories.length - 1; i >= 0; i -= 1) if (person.memories[i].kind === kind) return person.memories[i]
  return undefined
}

/** Writes down what changed since the last tick, and says the first thing that comes to mind when it happens. */
export function noteChanges(world: World, people: PeopleState, person: Person, before: Snapshot): void {
  const guard = person.guard
  const clock = world.clock
  const stunned = guard.stunSeconds > 0
  if (guard.mode === 'dead') {
    if (before.mode !== 'dead') remember(person, 'killed', clock)
    return
  }
  if (stunned && !before.stunned) {
    remember(person, 'knockedOut', clock)
    if (distance(centerOf(guard), centerOf(world.player)) < 3) people.deeds.add('choke')
  }
  if (!stunned && before.stunned) {
    remember(person, 'woke', clock)
    say(world, people, person, 'woke', {}, true)
  }
  if (guard.mode === 'surrendered' && before.mode !== 'surrendered') remember(person, 'surrendered', clock)
  // Armed again and still alive: the man had him and let him be.
  if (before.mode === 'surrendered' && guard.mode !== 'surrendered' && !guard.restrained) remember(person, 'spared', clock)
  if (guard.restrained && !before.restrained) {
    remember(person, 'restrained', clock)
    people.deeds.add('tied')
  }
  if (world.melee.shield === guard && !has(person, 'hostage')) {
    remember(person, 'hostage', clock)
    people.deeds.add('shield')
  }
  const lastWound = last(person, 'wounded')
  if (guard.hp < before.hp && (!lastWound || clock - lastWound.clock > WOUND_MEMORY_GAP)) remember(person, 'wounded', clock)
  if (guard.seesPlayer && guard.awareness >= 1 && !has(person, 'sawPlayer') && distance(centerOf(guard), centerOf(world.player)) < SAW_CLOSE) remember(person, 'sawPlayer', clock)
  const calmedDown = (before.mode === 'investigating' || before.mode === 'noticed') && (guard.mode === 'calm' || guard.mode === 'caution')
  if (calmedDown && before.interest === 'noise') remember(person, 'falseAlarm', clock)
}

/** The story he most wants to tell, if there is one he has not told: the latest first. */
function storyToTell(person: Person): { kind: MemoryKind; talk: TalkKind } | null {
  const order: [MemoryKind, TalkKind][] = [
    ['woke', 'wokeTalk'], ['hostage', 'hostageAfter'], ['spared', person.guard.tier === 'veteran' ? 'sparedVeteran' : 'spared'],
    ['sawPlayer', 'sawPlayer'], ['wounded', 'wounded'],
  ]
  for (const [kind, talk] of order) if (has(person, kind) && !person.told.includes(kind)) return { kind, talk }
  if (count(person, 'falseAlarm') >= 2 && !person.told.includes('falseAlarm')) return { kind: 'falseAlarm', talk: 'falseAlarmTwice' }
  return null
}

/** With a quiet moment and the player close enough to hear, he says what happened to him tonight. */
export function tellStories(world: World, people: PeopleState, person: Person): void {
  const guard = person.guard
  if (guard.mode === 'dead' || guard.stunSeconds > 0 || guard.mode === 'combat' || !nearPlayer(world, feetOf(guard))) return
  const story = storyToTell(person)
  if (!story) return
  const values: Fill = { deed: describeIntruder(world, people) }
  if (say(world, people, person, story.talk, values)) {
    person.told.push(story.kind)
    if (story.kind === 'falseAlarm' && person.traits.includes('careful')) reveal(world, person, 'careful')
  }
}

const DEED_WORDS: Record<Deed, string> = {
  rope: 'He\'s got a rope', line: 'He came up on a grapple line', window: 'He cuts through windows', wall: 'He came through the wall',
  explosives: 'He\'s carrying charges', chute: 'He dropped in by parachute', dark: 'He kills the lights first',
  shield: 'He grabs people as shields', choke: 'He chokes people out', tied: 'He ties people up',
}

/** How the guards describe the intruder: by what they have seen him do, or else by what he carries. */
export function describeIntruder(world: World, people: PeopleState): string {
  const deeds = [...people.deeds]
  if (deeds.length > 0) return DEED_WORDS[deeds[deeds.length - 1]]
  const tool = TOOLS[world.player.tool]
  return tool ? `Masked, carrying a ${tool.name.toLowerCase()}` : 'Masked, armed'
}

/** What the guards have seen of the intruder's ways, from the security force's own notes. */
export function noteDeeds(world: World, people: PeopleState): void {
  const security = world.security
  if (security.ropesNoticed.size > 0) people.deeds.add('rope')
  if (security.lineNoticed) people.deeds.add('line')
  if (security.panesNoticed.size > 0) people.deeds.add('window')
  if (security.chargesSeen.size > 0) people.deeds.add('explosives')
  if (Number.isFinite(security.chuteReportedAt)) people.deeds.add('chute')
  if (security.circuitsNoticed.size > 0) people.deeds.add('dark')
  if (world.stats.tilesDestroyed > 20 && security.level >= 2) people.deeds.add('wall')
}
