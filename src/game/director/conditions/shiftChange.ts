import { lastEvent, note } from '../../chronicle/note'
import { createGuard, type Guard } from '../../security/model'
import type { Room } from '../../site'
import type { Vec } from '../../types'
import type { World } from '../../world'
import { arrived, idleGuards, onErrand, release, sendTo, spotIn } from '../crew'
import { clockText } from '../clockText'
import { radio, say } from '../say'
import type { ConditionDef } from '../types'

/**
 * A shift change at a set time: a column of fresh guards walks from the quarters to the tower while the tired ones
 * walk back. Each post stands empty from the moment its man leaves until his relief gets there, then is held by
 * someone wide awake.
 */

const EARLIEST = 110
const SPREAD = 110
const WARNING = 40
const COLUMN = 5
const GIVE_UP = 150

type Handover = { tired: Guard; fresh: Guard; post: Post; home: Vec; done: boolean; taken: boolean }
type Post = Pick<Guard, 'home' | 'homeX' | 'route' | 'role' | 'roomId' | 'patrolRange' | 'facing'>

export const shiftChange: ConditionDef = {
  id: 'shiftChange',
  fits: (site) => site === 'complex',
  excludes: [],
  start(_world, rng) {
    const at = Math.round(EARLIEST + rng() * SPREAD)
    let phase: 'waiting' | 'warned' | 'walking' | 'over' = 'waiting'
    let handovers: Handover[] = []
    return {
      id: 'shiftChange',
      line: `Shift change at ${clockText(at)}: posts in the tower stand empty while the fresh team walks over from the quarters.`,
      step(stepWorld) {
        if (phase === 'waiting' && stepWorld.clock >= at - WARNING) {
          phase = 'warned'
          radio(stepWorld, `Control: Shift change at ${clockText(at)}. Night team, get your kit on.`)
        } else if (phase === 'warned' && stepWorld.clock >= at) {
          phase = 'walking'
          handovers = beginHandover(stepWorld)
          if (handovers.length === 0) phase = 'over'
        } else if (phase === 'walking') {
          for (const handover of handovers) stepHandover(handover)
          const settled = handovers.every((handover) => handover.done && !onErrand(handover.tired, handover.home))
          if (settled || stepWorld.clock > at + GIVE_UP) {
            phase = 'over'
            // Whoever is still on the way when it is called (a tired man who cannot reach the quarters, a relief who
            // cannot reach his post) is not left walking there all night.
            for (const handover of handovers) {
              release(handover.tired, handover.home)
              release(handover.fresh, handover.post.home)
            }
            const taken = handovers.filter((handover) => handover.taken).length
            const beat = lastEvent(stepWorld, 'shiftChange')
            if (beat) beat.outcome = taken === handovers.length ? 'every post was handed over' : `only ${taken} of ${handovers.length} posts were handed over`
          }
        }
      },
    }
  },
}

function beginHandover(world: World): Handover[] {
  const quarters = groundRoom(world, 'quarters') ?? groundRoom(world, 'tower')
  if (!quarters) return []
  const tired = idleGuards(world).filter((guard) => guard.role === 'patrol' && towerRoom(world, guard)).slice(0, COLUMN)
  const door = spotIn(quarters, 0.5)
  const handovers = tired.map((guard, index) => {
    const fresh = createGuard({ x: Math.floor(door.x) + (index % 3) - 1, y: door.y, facing: 1, role: 'post', roomId: quarters.id })
    fresh.tier = fresh.tier === 'rookie' ? 'regular' : fresh.tier
    world.guards.push(fresh)
    const post: Post = { home: { ...guard.home }, homeX: guard.homeX, route: guard.route.map((point) => ({ ...point })), role: guard.role, roomId: guard.roomId, patrolRange: guard.patrolRange, facing: guard.facing }
    sendTo(guard, door)
    sendTo(fresh, post.home)
    return { tired: guard, fresh, post, home: door, done: false, taken: false }
  })
  const first = handovers[0]
  if (first) {
    say(world, first.tired, 'That\'s us. Clocking off.')
    radio(world, 'Control: Shift change. Fresh team, take your posts.')
    note(world, 'event', door, { detail: 'shiftChange' })
  }
  return handovers
}

/** The tired man goes off duty when he reaches the quarters; his relief takes over the post when he reaches it. */
function stepHandover(handover: Handover): void {
  const { tired, fresh, post } = handover
  if (onErrand(tired, handover.home) && arrived(tired, handover.home)) {
    release(tired, handover.home)
    Object.assign(tired, { home: { ...handover.home }, homeX: handover.home.x, role: 'post', route: [] })
  }
  if (handover.done) return
  // Called away (an alarm, a fight): the post stays empty.
  if (!onErrand(fresh, post.home)) {
    handover.done = true
    return
  }
  if (!arrived(fresh, post.home)) return
  release(fresh, post.home)
  Object.assign(fresh, { ...post, home: { ...post.home }, route: post.route.map((point) => ({ ...point })), routeIndex: 0, shock: 0 })
  handover.done = true
  handover.taken = true
}

function groundRoom(world: World, building: string): Room | null {
  return world.rooms.filter((room) => room.building === building && room.storey === 0 && room.kind !== 'stairwell').sort((a, b) => b.w - a.w)[0] ?? null
}

function towerRoom(world: World, guard: Guard): boolean {
  const room = guard.roomId === null ? undefined : world.rooms.find((candidate) => candidate.id === guard.roomId)
  return room?.building === 'tower' && room.storey >= 0
}
