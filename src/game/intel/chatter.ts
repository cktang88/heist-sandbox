import type { Guard } from '../guards'
import { bark, nameOf } from '../security/barks'
import { feetOf } from '../security/model'
import { distance } from '../types'
import type { World } from '../world'
import { recordClue } from './clues'
import { spokenLine } from './describe'
import { detailKnownBy, truthOf } from './interrogate'

/**
 * Overheard talk: staying unseen close to two calm guards chatting for a few seconds picks up what they know.
 * Each pair says it once. It is as reliable as anything people say.
 */

const TICK = 0.25
const LISTEN_RANGE = 6
const PAIR_RANGE = 5
const SAME_FLOOR = 1
const LISTEN_SECONDS = 3
/** Above this a guard is paying too much attention to be chatting. */
const UNEASY = 0.3

export function stepChatter(world: World, dt: number): void {
  const intel = world.intel
  intel.chatterTick -= dt
  if (intel.chatterTick > 0) return
  intel.chatterTick = TICK
  const pair = chattingPair(world)
  if (!pair) {
    intel.chatter = null
    return
  }
  const key = pairKey(world, pair)
  intel.chatter = intel.chatter?.pair === key ? { pair: key, seconds: intel.chatter.seconds + TICK } : { pair: key, seconds: TICK }
  if (intel.chatter.seconds >= LISTEN_SECONDS) overhear(world, pair, key)
}

/** Two calm guards near each other and near the player, on his floor, neither of them aware of him. */
function chattingPair(world: World): [Guard, Guard] | null {
  const player = feetOf(world.player)
  const near = world.guards.filter((guard) => calm(guard) && Math.abs(feetOf(guard).y - player.y) < SAME_FLOOR && distance(feetOf(guard), player) < LISTEN_RANGE)
  for (let a = 0; a < near.length; a += 1) {
    for (let b = a + 1; b < near.length; b += 1) {
      const pair: [Guard, Guard] = [near[a], near[b]]
      if (distance(feetOf(pair[0]), feetOf(pair[1])) < PAIR_RANGE && !world.intel.used.has(pairKey(world, pair))) return pair
    }
  }
  return null
}

function calm(guard: Guard): boolean {
  return guard.mode === 'calm' && !guard.seesPlayer && guard.awareness < UNEASY && guard.stunSeconds <= 0
}

function pairKey(world: World, pair: [Guard, Guard]): string {
  return `chatter:${pair.map((guard) => world.guards.indexOf(guard)).join('-')}`
}

/** The better informed of the two lets it slip. */
function overhear(world: World, pair: [Guard, Guard], key: string): void {
  world.intel.used.add(key)
  world.intel.chatter = null
  const [speaker, listener] = rank(pair)
  const index = world.guards.indexOf(speaker)
  const clue = recordClue(world, { source: 'chatter', origin: `${nameOf(index)} (overheard)`, sourceKey: `guard:${index}`, detail: detailKnownBy(world, speaker), truth: truthOf(world, speaker) })
  bark(world, listener, 'Hear where they put the package?', true)
  bark(world, speaker, `Word is... ${spokenLine(clue.filter, 'plain')}`, true)
}

const TIER_RANK = { rookie: 0, regular: 1, veteran: 2 } as const

function rank(pair: [Guard, Guard]): [Guard, Guard] {
  return TIER_RANK[pair[1].tier] > TIER_RANK[pair[0].tier] ? [pair[1], pair[0]] : pair
}
