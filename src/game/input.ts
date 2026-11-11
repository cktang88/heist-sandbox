import type { Vec } from './types'

/** One frame of player intent. The game core only ever sees this, never the keyboard. */
export type Input = {
  left: boolean
  right: boolean
  up: boolean
  down: boolean
  jumpPressed: boolean
  jumpHeld: boolean
  fire: boolean
  firePressed: boolean
  interact: boolean
  interactPressed: boolean
  detonatePressed: boolean
  reloadPressed: boolean
  focus: boolean
  /** Held to crouch: smaller, quieter, slower, and able to use low cover and crawl spaces. */
  crouch: boolean
  /** Close combat: a punch, a kick, and grabbing or throwing whatever is in reach. */
  punchPressed: boolean
  kickPressed: boolean
  /** Held to grab: drags furniture, or holds a guard as a shield. */
  grab: boolean
  throwPressed: boolean
  /** X: demand surrender while aiming a gun at a nearby guard; otherwise whistle to lure. */
  whistlePressed: boolean
  /** Where the player is pointing, in tile units. */
  aim: Vec
  selectTool: number | null
}

export function idleInput(aim: Vec = { x: 0, y: 0 }): Input {
  return {
    left: false, right: false, up: false, down: false, jumpPressed: false, jumpHeld: false, fire: false, firePressed: false,
    interact: false, interactPressed: false, detonatePressed: false, reloadPressed: false, focus: false, crouch: false,
    punchPressed: false, kickPressed: false, grab: false, throwPressed: false, whistlePressed: false, aim, selectTool: null,
  }
}
