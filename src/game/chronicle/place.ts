import { roomOf } from '../security/places'
import type { RoomKind } from '../site'
import type { Vec } from '../types'
import type { World } from '../world'

/** Where something happened, in the words a newspaper would use: "the 6th-floor office of the tower". */

const KIND_WORDS: Partial<Record<RoomKind, string>> = {
  breakRoom: 'break room', loadingDock: 'loading dock', elevatorLobby: 'lift lobby', mechanical: 'plant room',
  electrical: 'electrical room', executive: 'executive suite', conference: 'conference room', security: 'security office',
  server: 'server room', lockers: 'locker room', cells: 'holding cells', janitor: 'janitor closet', lab: 'laboratory', storage: 'store room',
}

const STOREY_ROWS = 6

/** A spot in a wall or doorway between rooms still belongs to the room beside it. */
const BESIDE = 3

export function placeName(world: World, feet: Vec): string {
  const room = roomOf(world, feet) ?? roomOf(world, { x: feet.x - BESIDE, y: feet.y }) ?? roomOf(world, { x: feet.x + BESIDE, y: feet.y })
  if (!room) return looseSpot(world, feet)
  const building = room.building
  switch (room.kind) {
    case 'rooftop': return `the ${building} roof`
    case 'street': return 'the street'
    case 'yard': return 'the yard'
    case 'sewer': return 'the sewer'
    case 'silo': return 'a grain silo'
    case 'gatehouse': return 'the gatehouse'
  }
  const kind = KIND_WORDS[room.kind] ?? room.kind
  if (room.storey === -1) return `the ${building}'s basement ${kind}`
  if (room.storey < -1) return `the ${kind} on basement level ${-room.storey} of the ${building}`
  return `the ${storeyWord(room.storey)} ${kind} of the ${building}`
}

/** "6th-floor", "ground-floor", "basement". */
export function storeyWord(storey: number): string {
  if (storey === 0) return 'ground-floor'
  if (storey < 0) return storey === -1 ? 'basement' : `level-${-storey} basement`
  return `${ordinal(storey)}-floor`
}

export function ordinal(value: number): string {
  const tens = value % 100
  if (tens >= 11 && tens <= 13) return `${value}th`
  return `${value}${['th', 'st', 'nd', 'rd'][value % 10] ?? 'th'}`
}

/** Outside every recorded room (the small outpost has none): judged by height. */
function looseSpot(world: World, feet: Vec): string {
  if (feet.y > world.groundY + 1) return 'the tunnels under the site'
  const storey = Math.round((world.groundY - feet.y) / STOREY_ROWS)
  if (storey <= 0) return 'the street'
  return `a ${storeyWord(storey)} corridor`
}
